"""
Bulk Upload Routes
API endpoints for Excel template generation and bulk upload processing
"""
from flask import Blueprint, request, g, send_file
from io import BytesIO
from app.database import db
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.services.bulk_upload import (
    generate_excel_template, parse_excel_file,
    validate_customer_data, validate_employee_data,
    validate_service_data, validate_product_data
)
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.catalog import Service, Product
from datetime import datetime
import logging

logger = logging.getLogger(__name__)
bulk_upload_bp = Blueprint("bulk_upload", __name__)

@bulk_upload_bp.route("/bulk-upload/template/<module_name>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def get_template(module_name):
    """Generate and download Excel template for the specified module"""
    try:
        # Validate module name
        valid_modules = ['customers', 'employees', 'services', 'products']
        if module_name not in valid_modules:
            return error_response(
                error_code="INVALID_MODULE",
                message=f"Invalid module. Must be one of: {', '.join(valid_modules)}",
                status_code=400
            )
        
        branch_id = request.args.get("branch_id")
        excel_data = generate_excel_template(module_name, tenant_id=getattr(g, "parlour_id", None), branch_id=branch_id)
        
        # Return file
        from flask import Response
        return Response(
            excel_data,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            headers={
                "Content-Disposition": f'attachment; filename="{module_name}_template.xlsx"'
            }
        )
    except Exception as e:
        logger.error(f"Error generating template for {module_name}: {str(e)}")
        return error_response(
            error_code="TEMPLATE_ERROR",
            message=f"Failed to generate template: {str(e)}",
            status_code=500
        )

@bulk_upload_bp.route("/bulk-upload/customers", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def bulk_upload_customers():
    """Process bulk upload of customers from Excel file"""
    try:
        # Check for file
        if 'file' not in request.files:
            return error_response(
                error_code="NO_FILE",
                message="No file provided",
                status_code=400
            )
        
        file = request.files['file']
        if file.filename == '':
            return error_response(
                error_code="NO_FILE",
                message="No file selected",
                status_code=400
            )
        
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            return error_response(
                error_code="INVALID_FILE_TYPE",
                message="Only Excel files (.xlsx, .xls) are allowed",
                status_code=400
            )
        
        # Parse Excel file
        file_data = file.read()
        success, data, parse_errors = parse_excel_file(file_data, 'customers')
        
        if not success:
            return error_response(
                error_code="PARSE_ERROR",
                message=parse_errors,
                status_code=400
            )
        
        # Validate each row
        validation_errors = []
        valid_customers = []
        
        for idx, row_data in enumerate(data, 2):  # Start from row 2 (1-based indexing)
            errors = validate_customer_data(row_data, g.parlour_id, g.branch_id)
            if errors:
                validation_errors.append({
                    'row': idx,
                    'errors': errors,
                    'data': row_data
                })
            else:
                valid_customers.append(row_data)
        
        # Check subscription plan customer limit
        max_cust = None
        try:
            with db.get_master_engine().connect() as conn:
                from sqlalchemy import text
                res = conn.execute(text("""
                    SELECT sp.max_customers FROM tenants t 
                    LEFT JOIN subscription_plans sp ON t.subscription_plan_id = sp.id 
                    WHERE t.id = :id
                """), {"id": g.parlour_id}).fetchone()
                if res and res[0] is not None:
                    max_cust = res[0]
        except Exception as err:
            logger.warning(f"Failed to fetch customer limit: {err}")

        if max_cust is not None:
            current_count = get_tenant_query(Customer).count()
            if current_count + len(valid_customers) > max_cust:
                remaining = max(0, max_cust - current_count)
                return error_response(
                    error_code="PLAN_LIMIT_EXCEEDED",
                    message=f"Subscription plan customer limit ({max_cust}) reached. Current: {current_count}, Uploading: {len(valid_customers)}. Remaining capacity: {remaining}.",
                    status_code=400
                )

        # Insert valid customers
        successful_count = 0
        failed_count = len(validation_errors)
        
        for customer_data in valid_customers:
            try:
                # Parse date of birth if provided
                dob = None
                if customer_data.get('date_of_birth'):
                    try:
                        dob = datetime.strptime(customer_data['date_of_birth'], '%Y-%m-%d').date()
                    except ValueError:
                        pass
                
                customer = Customer(
                    tenant_id=g.parlour_id,
                    branch_id=g.branch_id if g.role in ["BranchAdmin"] else None,
                    first_name=customer_data['first_name'],
                    last_name=customer_data.get('last_name'),
                    phone=customer_data['phone'],
                    email=customer_data.get('email'),
                    gender=customer_data.get('gender'),
                    date_of_birth=dob,
                    address=customer_data.get('address'),
                    notes=customer_data.get('notes'),
                    spot=customer_data.get('spot')
                )
                db.session.add(customer)
                successful_count += 1
            except Exception as e:
                logger.error(f"Error inserting customer: {str(e)}")
                failed_count += 1
                validation_errors.append({
                    'row': valid_customers.index(customer_data) + 2,
                    'errors': [f"Database error: {str(e)}"],
                    'data': customer_data
                })
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error committing customers: {str(e)}")
            return error_response(
                error_code="DATABASE_ERROR",
                message=f"Failed to save customers: {str(e)}",
                status_code=500
            )
        
        return success_response({
            'total_rows': len(data) + len(parse_errors),
            'successful': successful_count,
            'failed': failed_count,
            'validation_errors': validation_errors,
            'parse_errors': parse_errors
        })
        
    except Exception as e:
        logger.error(f"Error in bulk upload customers: {str(e)}")
        db.session.rollback()
        return error_response(
            error_code="UPLOAD_ERROR",
            message=f"Bulk upload failed: {str(e)}",
            status_code=500
        )

@bulk_upload_bp.route("/bulk-upload/employees", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def bulk_upload_employees():
    """Process bulk upload of employees from Excel file"""
    try:
        # Check for file
        if 'file' not in request.files:
            return error_response(
                error_code="NO_FILE",
                message="No file provided",
                status_code=400
            )
        
        file = request.files['file']
        if file.filename == '':
            return error_response(
                error_code="NO_FILE",
                message="No file selected",
                status_code=400
            )
        
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            return error_response(
                error_code="INVALID_FILE_TYPE",
                message="Only Excel files (.xlsx, .xls) are allowed",
                status_code=400
            )
        
        # Parse Excel file
        file_data = file.read()
        success, data, parse_errors = parse_excel_file(file_data, 'employees')
        
        if not success:
            return error_response(
                error_code="PARSE_ERROR",
                message=parse_errors,
                status_code=400
            )
        
        # Validate each row
        validation_errors = []
        valid_employees = []
        
        for idx, row_data in enumerate(data, 2):
            errors = validate_employee_data(row_data, g.parlour_id, g.branch_id)
            if errors:
                validation_errors.append({
                    'row': idx,
                    'errors': errors,
                    'data': row_data
                })
            else:
                valid_employees.append(row_data)
        
        # Check subscription plan employee limit
        max_emp = None
        try:
            with db.get_master_engine().connect() as conn:
                from sqlalchemy import text
                res = conn.execute(text("""
                    SELECT sp.max_employees FROM tenants t 
                    LEFT JOIN subscription_plans sp ON t.subscription_plan_id = sp.id 
                    WHERE t.id = :id
                """), {"id": g.parlour_id}).fetchone()
                if res and res[0] is not None:
                    max_emp = res[0]
        except Exception as err:
            logger.warning(f"Failed to fetch employee limit: {err}")

        if max_emp is not None:
            current_count = get_tenant_query(Employee).count()
            if current_count + len(valid_employees) > max_emp:
                remaining = max(0, max_emp - current_count)
                return error_response(
                    error_code="PLAN_LIMIT_EXCEEDED",
                    message=f"Subscription plan employee limit ({max_emp}) reached. Current: {current_count}, Uploading: {len(valid_employees)}. Remaining capacity: {remaining}.",
                    status_code=400
                )

        # Insert valid employees
        successful_count = 0
        failed_count = len(validation_errors)
        
        for employee_data in valid_employees:
            try:
                # Parse joining date if provided
                joining_date = None
                if employee_data.get('joining_date'):
                    try:
                        joining_date = datetime.strptime(employee_data['joining_date'], '%Y-%m-%d').date()
                    except ValueError:
                        pass
                
                employee = Employee(
                    tenant_id=g.parlour_id,
                    branch_id=g.branch_id if g.role == "BranchAdmin" else None,
                    first_name=employee_data['first_name'],
                    last_name=employee_data.get('last_name'),
                    phone=employee_data['phone'],
                    specialization=employee_data.get('specialization'),
                    role=employee_data.get('role'),
                    salary=float(employee_data.get('salary', 0)),
                    commission_percentage=float(employee_data.get('commission_percentage', 0)),
                    status=employee_data.get('status', 'active')
                )
                if joining_date:
                    employee.joining_date = joining_date
                
                db.session.add(employee)
                successful_count += 1
            except Exception as e:
                logger.error(f"Error inserting employee: {str(e)}")
                failed_count += 1
                validation_errors.append({
                    'row': valid_employees.index(employee_data) + 2,
                    'errors': [f"Database error: {str(e)}"],
                    'data': employee_data
                })
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error committing employees: {str(e)}")
            return error_response(
                error_code="DATABASE_ERROR",
                message=f"Failed to save employees: {str(e)}",
                status_code=500
            )
        
        return success_response({
            'total_rows': len(data) + len(parse_errors),
            'successful': successful_count,
            'failed': failed_count,
            'validation_errors': validation_errors,
            'parse_errors': parse_errors
        })
        
    except Exception as e:
        logger.error(f"Error in bulk upload employees: {str(e)}")
        db.session.rollback()
        return error_response(
            error_code="UPLOAD_ERROR",
            message=f"Bulk upload failed: {str(e)}",
            status_code=500
        )

@bulk_upload_bp.route("/bulk-upload/services", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def bulk_upload_services():
    """Process bulk upload of services from Excel file"""
    try:
        # Check for file
        if 'file' not in request.files:
            return error_response(
                error_code="NO_FILE",
                message="No file provided",
                status_code=400
            )
        
        file = request.files['file']
        if file.filename == '':
            return error_response(
                error_code="NO_FILE",
                message="No file selected",
                status_code=400
            )
        
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            return error_response(
                error_code="INVALID_FILE_TYPE",
                message="Only Excel files (.xlsx, .xls) are allowed",
                status_code=400
            )
        
        # Parse Excel file
        file_data = file.read()
        success, data, parse_errors = parse_excel_file(file_data, 'services')
        
        if not success:
            return error_response(
                error_code="PARSE_ERROR",
                message=parse_errors,
                status_code=400
            )
        
        # Validate each row
        validation_errors = []
        valid_services = []
        
        for idx, row_data in enumerate(data, 2):
            errors = validate_service_data(row_data, g.parlour_id)
            if errors:
                validation_errors.append({
                    'row': idx,
                    'errors': errors,
                    'data': row_data
                })
            else:
                valid_services.append(row_data)
        
        # Check subscription plan service limit
        max_svc = None
        try:
            with db.get_master_engine().connect() as conn:
                from sqlalchemy import text
                res = conn.execute(text("""
                    SELECT sp.max_services FROM tenants t 
                    LEFT JOIN subscription_plans sp ON t.subscription_plan_id = sp.id 
                    WHERE t.id = :id
                """), {"id": g.parlour_id}).fetchone()
                if res and res[0] is not None:
                    max_svc = res[0]
        except Exception as err:
            logger.warning(f"Failed to fetch service limit: {err}")

        if max_svc is not None:
            current_count = get_tenant_query(Service).count()
            if current_count + len(valid_services) > max_svc:
                remaining = max(0, max_svc - current_count)
                return error_response(
                    error_code="PLAN_LIMIT_EXCEEDED",
                    message=f"Subscription plan service limit ({max_svc}) reached. Current: {current_count}, Uploading: {len(valid_services)}. Remaining capacity: {remaining}.",
                    status_code=400
                )

        # Insert valid services
        successful_count = 0
        failed_count = len(validation_errors)
        
        for service_data in valid_services:
            try:
                service = Service(
                    tenant_id=g.parlour_id,
                    category_id=service_data.get('category_id'),
                    name=service_data['name'],
                    price=float(service_data.get('price', 0)),
                    duration_minutes=int(service_data.get('duration_minutes', 30)),
                    description=service_data.get('description'),
                    status=service_data.get('status', 'active')
                )
                db.session.add(service)
                db.session.flush()

                # Process optional membership plan discount mapping if provided
                plan_name = service_data.get('membership_plan_name')
                if plan_name:
                    from app.models.membership import MembershipPlan, MembershipPlanService
                    plan_obj = MembershipPlan.query.filter_by(tenant_id=g.parlour_id, status='active').filter(
                        MembershipPlan.name.ilike(plan_name)
                    ).first()
                    if plan_obj:
                        disc_pct = float(service_data.get('membership_discount_percentage') or 0)
                        disc_amt = float(service_data.get('membership_discount_amount') or 0)
                        price_val = float(service_data.get('price', 0))

                        # Vice-versa auto calculation if one is left blank
                        if disc_pct > 0 and disc_amt == 0 and price_val > 0:
                            disc_amt = round(price_val * (disc_pct / 100.0), 2)
                        elif disc_amt > 0 and disc_pct == 0 and price_val > 0:
                            disc_pct = round((disc_amt / price_val) * 100.0, 2)

                        mps = MembershipPlanService(
                            tenant_id=g.parlour_id,
                            membership_plan_id=plan_obj.id,
                            service_id=service.id,
                            discount_percentage=disc_pct,
                            discount_amount=disc_amt
                        )
                        db.session.add(mps)

                successful_count += 1
            except Exception as e:
                logger.error(f"Error inserting service: {str(e)}")
                failed_count += 1
                validation_errors.append({
                    'row': valid_services.index(service_data) + 2,
                    'errors': [f"Database error: {str(e)}"],
                    'data': service_data
                })
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error committing services: {str(e)}")
            return error_response(
                error_code="DATABASE_ERROR",
                message=f"Failed to save services: {str(e)}",
                status_code=500
            )
        
        return success_response({
            'total_rows': len(data) + len(parse_errors),
            'successful': successful_count,
            'failed': failed_count,
            'validation_errors': validation_errors,
            'parse_errors': parse_errors
        })
        
    except Exception as e:
        logger.error(f"Error in bulk upload services: {str(e)}")
        db.session.rollback()
        return error_response(
            error_code="UPLOAD_ERROR",
            message=f"Bulk upload failed: {str(e)}",
            status_code=500
        )

@bulk_upload_bp.route("/bulk-upload/products", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def bulk_upload_products():
    """Process bulk upload of products from Excel file"""
    try:
        # Check for file
        if 'file' not in request.files:
            return error_response(
                error_code="NO_FILE",
                message="No file provided",
                status_code=400
            )
        
        file = request.files['file']
        if file.filename == '':
            return error_response(
                error_code="NO_FILE",
                message="No file selected",
                status_code=400
            )
        
        # Validate file type
        if not file.filename.endswith(('.xlsx', '.xls')):
            return error_response(
                error_code="INVALID_FILE_TYPE",
                message="Only Excel files (.xlsx, .xls) are allowed",
                status_code=400
            )
        
        # Parse Excel file
        file_data = file.read()
        success, data, parse_errors = parse_excel_file(file_data, 'products')
        
        if not success:
            return error_response(
                error_code="PARSE_ERROR",
                message=parse_errors,
                status_code=400
            )
        
        # Validate each row
        validation_errors = []
        valid_products = []
        
        for idx, row_data in enumerate(data, 2):
            errors = validate_product_data(row_data, g.parlour_id)
            if errors:
                validation_errors.append({
                    'row': idx,
                    'errors': errors,
                    'data': row_data
                })
            else:
                valid_products.append(row_data)
        
        # Insert valid products
        successful_count = 0
        failed_count = len(validation_errors)
        
        for product_data in valid_products:
            try:
                product = Product(
                    tenant_id=g.parlour_id,
                    name=product_data['name'],
                    category=product_data.get('category'),
                    sku=product_data.get('sku'),
                    barcode=product_data.get('barcode'),
                    cost_price=float(product_data.get('cost_price', 0)),
                    selling_price=float(product_data.get('selling_price', 0)),
                    mrp=float(product_data.get('mrp', 0)),
                    stock_quantity=int(product_data.get('stock_quantity', 0)),
                    low_stock_threshold=int(product_data.get('low_stock_threshold', 5)),
                    status=product_data.get('status', 'active')
                )
                db.session.add(product)
                successful_count += 1
            except Exception as e:
                logger.error(f"Error inserting product: {str(e)}")
                failed_count += 1
                validation_errors.append({
                    'row': valid_products.index(product_data) + 2,
                    'errors': [f"Database error: {str(e)}"],
                    'data': product_data
                })
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error committing products: {str(e)}")
            return error_response(
                error_code="DATABASE_ERROR",
                message=f"Failed to save products: {str(e)}",
                status_code=500
            )
        
        return success_response({
            'total_rows': len(data) + len(parse_errors),
            'successful': successful_count,
            'failed': failed_count,
            'validation_errors': validation_errors,
            'parse_errors': parse_errors
        })
        
    except Exception as e:
        logger.error(f"Error in bulk upload products: {str(e)}")
        db.session.rollback()
        return error_response(
            error_code="UPLOAD_ERROR",
            message=f"Bulk upload failed: {str(e)}",
            status_code=500
        )