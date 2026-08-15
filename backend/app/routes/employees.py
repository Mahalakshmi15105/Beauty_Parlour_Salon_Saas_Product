from flask import Blueprint, request, g
from app.database import db
from app.models.employee import Employee
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.utils.query import paginate_query
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
employees_bp = Blueprint("employees", __name__)

@employees_bp.route("/employees", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"])
def get_employees():
    q = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")
    sort = request.args.get("sort", "first_name")

    query = get_branch_query(Employee)

    if q:
        query = query.filter(
            (Employee.first_name.ilike(f"%{q}%")) |
            (Employee.last_name.ilike(f"%{q}%")) |
            (Employee.phone.ilike(f"%{q}%")) |
            (Employee.specialization.ilike(f"%{q}%"))
        )

    if status:
        query = query.filter(Employee.status == status)

    sort_field = "id"
    sort_desc = False
    if sort.startswith("-"):
        sort_field = sort[1:]
        sort_desc = True
    else:
        sort_field = sort

    employees, next_cursor = paginate_query(
        query=query,
        model=Employee,
        limit_val=limit,
        cursor=cursor,
        sort_field=sort_field,
        sort_desc=sort_desc
    )

    data = [
        {
            "id": emp.id,
            "first_name": emp.first_name,
            "last_name": emp.last_name,
            "phone": emp.phone,
            "specialization": emp.specialization,
            "role": emp.role,
            "salary": float(emp.salary),
            "commission_percentage": float(emp.commission_percentage),
            "joining_date": emp.joining_date.isoformat(),
            "status": emp.status,
            "created_at": emp.created_at.isoformat()
        } for emp in employees
    ]

    return success_response({
        "items": data,
        "next_cursor": next_cursor
    })


@employees_bp.route("/employees/<int:employee_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_employee(employee_id):
    employee = get_branch_query(Employee).filter_by(id=employee_id).first()
    if not employee:
        return error_response(
            error_code="EMPLOYEE_NOT_FOUND",
            message="Employee not found or access denied.",
            status_code=404
        )
    return success_response({
        "id": employee.id,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "phone": employee.phone,
        "specialization": employee.specialization,
        "role": employee.role,
        "salary": float(employee.salary),
        "commission_percentage": float(employee.commission_percentage),
        "joining_date": employee.joining_date.isoformat(),
        "status": employee.status,
        "created_at": employee.created_at.isoformat()
    })


@employees_bp.route("/employees", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_employee():
    data = request.get_json() or {}
    first_name = data.get("first_name", "").strip()
    phone = data.get("phone", "").strip()
    salary = data.get("salary", 0.00)
    commission = data.get("commission_percentage", 0.00)

    if not first_name or not phone:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="First name and phone number are required.",
            status_code=400
        )

    # Validate numbers
    try:
        salary_val = float(salary)
        comm_val = float(commission)
        if salary_val < 0 or comm_val < 0 or comm_val > 100:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Salary must be >= 0 and commission must be between 0 and 100.",
            status_code=400
        )

    # Check phone duplicates
    dup = get_branch_query(Employee).filter_by(phone=phone).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"An employee with phone number {phone} already exists.",
            status_code=400
        )

    joining_date = None
    if data.get("joining_date"):
        try:
            joining_date = datetime.strptime(data["joining_date"], "%Y-%m-%d").date()
        except ValueError:
            return error_response(
                error_code="VALIDATION_FAILED",
                message="Joining date must be in YYYY-MM-DD format.",
                status_code=400
            )

    # Determine & validate branch_id
    target_branch_id = None
    if g.role == "BranchAdmin":
        target_branch_id = g.branch_id
    elif data.get("branch_id"):
        try:
            bid = int(data["branch_id"])
            from app.models.branch import Branch
            b_exists = Branch.query.filter_by(id=bid, tenant_id=g.parlour_id, is_deleted=False).first()
            if not b_exists:
                return error_response(
                    error_code="INVALID_BRANCH",
                    message="The specified branch does not belong to your parlour.",
                    status_code=400
                )
            target_branch_id = bid
        except ValueError:
            pass

    try:
        employee = Employee(
            tenant_id=g.parlour_id,
            branch_id=target_branch_id,
            first_name=first_name,
            last_name=data.get("last_name"),
            phone=phone,
            specialization=data.get("specialization"),
            role=data.get("role"),
            salary=salary_val,
            commission_percentage=comm_val,
            status=data.get("status", "active")
        )
        if joining_date:
            employee.joining_date = joining_date

        db.session.add(employee)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating employee: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to create employee record.",
            status_code=500
        )

    return success_response({
        "id": employee.id,
        "first_name": employee.first_name,
        "phone": employee.phone
    }, 201)


@employees_bp.route("/employees/<int:employee_id>", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_employee(employee_id):
    employee = get_branch_query(Employee).filter_by(id=employee_id).first()
    if not employee:
        return error_response(
            error_code="EMPLOYEE_NOT_FOUND",
            message="Employee not found or access denied.",
            status_code=404
        )

    data = request.get_json() or {}
    first_name = data.get("first_name", "").strip()
    phone = data.get("phone", "").strip()
    salary = data.get("salary", 0.00)
    commission = data.get("commission_percentage", 0.00)

    if not first_name or not phone:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="First name and phone number are required.",
            status_code=400
        )

    try:
        salary_val = float(salary)
        comm_val = float(commission)
        if salary_val < 0 or comm_val < 0 or comm_val > 100:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Salary must be >= 0 and commission must be between 0 and 100.",
            status_code=400
        )

    # Check duplicates
    dup = get_branch_query(Employee).filter(Employee.phone == phone, Employee.id != employee_id).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"Another employee with phone number {phone} already exists.",
            status_code=400
        )

    joining_date = None
    if data.get("joining_date"):
        try:
            joining_date = datetime.strptime(data["joining_date"], "%Y-%m-%d").date()
        except ValueError:
            return error_response(
                error_code="VALIDATION_FAILED",
                message="Joining date must be in YYYY-MM-DD format.",
                status_code=400
            )

    if g.role == "ParlourAdmin" and "branch_id" in data:
        bid = data.get("branch_id")
        if bid is None:
            employee.branch_id = None
        else:
            try:
                bid = int(bid)
                from app.models.branch import Branch
                b_exists = Branch.query.filter_by(id=bid, tenant_id=g.parlour_id, is_deleted=False).first()
                if not b_exists:
                    return error_response(
                        error_code="INVALID_BRANCH",
                        message="The specified branch does not belong to your parlour.",
                        status_code=400
                    )
                employee.branch_id = bid
            except ValueError:
                pass

    try:
        employee.first_name = first_name
        employee.last_name = data.get("last_name")
        employee.phone = phone
        employee.specialization = data.get("specialization")
        employee.role = data.get("role")
        employee.salary = salary_val
        employee.commission_percentage = comm_val
        employee.status = data.get("status", "active")
        if joining_date:
            employee.joining_date = joining_date

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating employee: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update employee record.",
            status_code=500
        )

    return success_response({"message": "Employee updated successfully."})


@employees_bp.route("/employees/<int:employee_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_employee(employee_id):
    employee = get_branch_query(Employee).filter_by(id=employee_id).first()
    if not employee:
        return error_response(
            error_code="EMPLOYEE_NOT_FOUND",
            message="Employee not found or access denied.",
            status_code=404
        )

    try:
        employee.soft_delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting employee: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete employee record.",
            status_code=500
        )

    return success_response({"message": "Employee soft-deleted successfully."})
