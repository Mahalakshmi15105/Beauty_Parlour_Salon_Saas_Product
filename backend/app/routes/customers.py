from flask import Blueprint, request, g
from app.database import db
from app.models.customer import Customer
from app.models.billing import Invoice
from app.models.user import TenantSetting
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query
from app.utils.query import paginate_query
from datetime import datetime, timedelta, timezone
from sqlalchemy import func, or_, and_
import logging

logger = logging.getLogger(__name__)
customers_bp = Blueprint("customers", __name__)

@customers_bp.route("/customers", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_customers():
    # Parse query parameters
    q = request.args.get("q", "").strip()
    gender = request.args.get("gender", "").strip()
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")
    sort = request.args.get("sort", "-created_at")

    # Start tenant query
    query = get_tenant_query(Customer)

    # Search filter
    if q:
        query = query.filter(
            (Customer.first_name.ilike(f"%{q}%")) |
            (Customer.last_name.ilike(f"%{q}%")) |
            (Customer.phone.ilike(f"%{q}%")) |
            (Customer.email.ilike(f"%{q}%"))
        )

    # Gender filter
    if gender:
        query = query.filter(Customer.gender == gender)

    # Sorting options
    sort_field = "id"
    sort_desc = False
    if sort.startswith("-"):
        sort_field = sort[1:]
        sort_desc = True
    else:
        sort_field = sort

    customers, next_cursor = paginate_query(
        query=query,
        model=Customer,
        limit_val=limit,
        cursor=cursor,
        sort_field=sort_field,
        sort_desc=sort_desc
    )

    data = [
        {
            "id": c.id,
            "first_name": c.first_name,
            "last_name": c.last_name,
            "phone": c.phone,
            "email": c.email,
            "gender": c.gender,
            "date_of_birth": c.date_of_birth.isoformat() if c.date_of_birth else None,
            "address": c.address,
            "notes": c.notes,
            "spot": c.spot,
            "created_at": c.created_at.isoformat()
        } for c in customers
    ]

    return success_response({
        "items": data,
        "next_cursor": next_cursor
    })


@customers_bp.route("/customers/<int:customer_id>", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_customer(customer_id):
    customer = get_tenant_query(Customer).filter_by(id=customer_id).first()
    if not customer:
        return error_response(
            error_code="CUSTOMER_NOT_FOUND",
            message="Customer not found or access denied.",
            status_code=404
        )
    return success_response({
        "id": customer.id,
        "first_name": customer.first_name,
        "last_name": customer.last_name,
        "phone": customer.phone,
        "email": customer.email,
        "gender": customer.gender,
        "date_of_birth": customer.date_of_birth.isoformat() if customer.date_of_birth else None,
        "address": customer.address,
        "notes": customer.notes,
        "spot": customer.spot,
        "created_at": customer.created_at.isoformat()
    })


@customers_bp.route("/customers", methods=["POST"])
@require_role(["ParlourAdmin"])
def create_customer():
    data = request.get_json() or {}
    first_name = data.get("first_name", "").strip()
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip().lower() if data.get("email") else None
    
    # Validation
    if not first_name or not phone:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="First name and phone number are required.",
            status_code=400
        )

    # Check duplicates in tenant context
    dup = get_tenant_query(Customer).filter_by(phone=phone).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"A customer with phone number {phone} already exists.",
            status_code=400,
            details={
                "existing_customer": {
                    "id": dup.id,
                    "first_name": dup.first_name,
                    "last_name": dup.last_name,
                    "phone": dup.phone
                }
            }
        )

    dob = None
    if data.get("date_of_birth"):
        from datetime import datetime
        try:
            dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
        except ValueError:
            return error_response(
                error_code="VALIDATION_FAILED",
                message="Date of birth must be in YYYY-MM-DD format.",
                status_code=400
            )

    try:
        customer = Customer(
            tenant_id=g.parlour_id,
            first_name=first_name,
            last_name=data.get("last_name"),
            phone=phone,
            email=email,
            gender=data.get("gender"),
            date_of_birth=dob,
            address=data.get("address"),
            notes=data.get("notes"),
            spot=data.get("spot")
        )
        db.session.add(customer)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating customer: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to create customer record.",
            status_code=500
        )

    return success_response({
        "id": customer.id,
        "first_name": customer.first_name,
        "phone": customer.phone,
        "spot": customer.spot
    }, 201)


@customers_bp.route("/customers/<int:customer_id>", methods=["PUT"])
@require_role(["ParlourAdmin"])
def update_customer(customer_id):
    customer = get_tenant_query(Customer).filter_by(id=customer_id).first()
    if not customer:
        return error_response(
            error_code="CUSTOMER_NOT_FOUND",
            message="Customer not found or access denied.",
            status_code=404
        )

    data = request.get_json() or {}
    first_name = data.get("first_name", "").strip()
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip().lower() if data.get("email") else None

    if not first_name or not phone:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="First name and phone number are required.",
            status_code=400
        )

    # Check duplicate phone for other records
    dup = get_tenant_query(Customer).filter(Customer.phone == phone, Customer.id != customer_id).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"Another customer with phone number {phone} already exists.",
            status_code=400
        )

    dob = None
    if data.get("date_of_birth"):
        from datetime import datetime
        try:
            dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
        except ValueError:
            return error_response(
                error_code="VALIDATION_FAILED",
                message="Date of birth must be in YYYY-MM-DD format.",
                status_code=400
            )

    try:
        customer.first_name = first_name
        customer.last_name = data.get("last_name")
        customer.phone = phone
        customer.email = email
        customer.gender = data.get("gender")
        customer.date_of_birth = dob
        customer.address = data.get("address")
        customer.notes = data.get("notes")
        customer.spot = data.get("spot")
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating customer: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update customer record.",
            status_code=500
        )

    return success_response({
        "id": customer.id,
        "first_name": customer.first_name,
        "last_name": customer.last_name,
        "phone": customer.phone,
        "email": customer.email,
        "gender": customer.gender,
        "date_of_birth": customer.date_of_birth.isoformat() if customer.date_of_birth else None,
        "address": customer.address,
        "notes": customer.notes,
        "spot": customer.spot,
        "created_at": customer.created_at.isoformat()
    })


@customers_bp.route("/customers/<int:customer_id>", methods=["DELETE"])
@require_role(["ParlourAdmin"])
def delete_customer(customer_id):
    customer = get_tenant_query(Customer).filter_by(id=customer_id).first()
    if not customer:
        return error_response(
            error_code="CUSTOMER_NOT_FOUND",
            message="Customer not found or access denied.",
            status_code=404
        )

    try:
        customer.soft_delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting customer: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete customer record.",
            status_code=500
        )

    return success_response({"message": "Customer soft-deleted successfully."})


@customers_bp.route("/customers/<int:customer_id>/memberships", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_customer_memberships(customer_id):
    from app.models.membership import CustomerMembership, MembershipBenefit
    
    # Verify customer exists in tenant context
    customer = get_tenant_query(Customer).filter_by(id=customer_id).first()
    if not customer:
        return error_response(
            error_code="CUSTOMER_NOT_FOUND",
            message="Customer not found.",
            status_code=404
        )

    # Fetch active memberships
    memberships = CustomerMembership.query.filter_by(
        customer_id=customer_id,
        tenant_id=g.parlour_id,
        status="active"
    ).all()

    data = []
    for m in memberships:
        benefits = []
        for b in m.benefits:
            benefits.append({
                "id": b.id,
                "service_id": b.service_id,
                "service_name": b.service.name if b.service else None,
                "total_quantity": b.total_quantity,
                "remaining_quantity": b.remaining_quantity
            })
        
        data.append({
            "id": m.id,
            "plan_name": m.plan.name if m.plan else "Default Membership",
            "expires_at": m.expires_at.isoformat(),
            "status": m.status,
            "benefits": benefits
        })

    return success_response(data)


@customers_bp.route("/customers/<int:customer_id>/history", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_customer_history(customer_id):
    from app.models.billing import Invoice, InvoiceLineItem, InvoicePayment
    from app.models.catalog import Service, Product
    from app.models.employee import Employee
    from app.models.membership import CustomerMembership, MembershipPlan, MembershipBenefit
    from collections import defaultdict
    from decimal import Decimal

    # 1. Verify customer exists in current tenant
    customer = get_tenant_query(Customer).filter_by(id=customer_id).first()
    if not customer:
        return error_response(
            error_code="CUSTOMER_NOT_FOUND",
            message="Customer not found or access denied.",
            status_code=404
        )

    # 2. Query customer's invoices (tenant isolated)
    invoices = Invoice.query.filter_by(
        customer_id=customer_id,
        tenant_id=g.parlour_id
    ).order_by(Invoice.created_at.desc()).all()

    # 3. Query active/past memberships
    memberships = CustomerMembership.query.filter_by(
        customer_id=customer_id,
        tenant_id=g.parlour_id
    ).order_by(CustomerMembership.created_at.desc()).all()

    # Process Invoices & Line Items
    visit_history = []
    service_freq = defaultdict(lambda: {"count": 0, "last_date": None, "total_spent": Decimal("0.00")})
    product_freq = defaultdict(lambda: {"qty": 0, "last_date": None, "total_spent": Decimal("0.00")})
    stylist_freq = defaultdict(int)

    total_services_amount = Decimal("0.00")
    total_products_amount = Decimal("0.00")
    total_discounts_given = Decimal("0.00")
    total_tax_paid = Decimal("0.00")
    grand_total_spent = Decimal("0.00")

    timeline = []

    for inv in invoices:
        if inv.status and inv.status.lower() == "void":
            continue

        grand_total_spent += Decimal(str(inv.total or 0))
        total_discounts_given += Decimal(str(inv.discount or 0))
        total_tax_paid += Decimal(str(inv.tax or 0))

        inv_services = []
        inv_products = []
        inv_employees = set()

        line_items_data = []
        for line in inv.line_items:
            emp_name = "N/A"
            if line.employee_id:
                emp = db.session.get(Employee, line.employee_id)
                if emp:
                    emp_name = f"{emp.first_name} {emp.last_name or ''}".strip()
                    inv_employees.add(emp_name)
                    stylist_freq[emp_name] += 1

            if line.service_id:
                svc = db.session.get(Service, line.service_id)
                svc_name = svc.name if svc else "Service"
                inv_services.append(svc_name)
                service_freq[svc_name]["count"] += line.quantity
                service_freq[svc_name]["total_spent"] += Decimal(str(line.line_total or 0))
                if not service_freq[svc_name]["last_date"] or inv.created_at.isoformat() > service_freq[svc_name]["last_date"]:
                    service_freq[svc_name]["last_date"] = inv.created_at.strftime("%Y-%m-%d")
                total_services_amount += Decimal(str(line.line_total or 0))
                
                line_items_data.append({
                    "id": line.id,
                    "name": svc_name,
                    "type": "Service",
                    "quantity": line.quantity,
                    "unit_price": float(line.unit_price or 0),
                    "discount_amount": float(line.discount_amount or 0),
                    "line_total": float(line.line_total or 0),
                    "employee_name": emp_name
                })

            elif line.product_id:
                prod = db.session.get(Product, line.product_id)
                prod_name = prod.name if prod else "Product"
                inv_products.append(prod_name)
                product_freq[prod_name]["qty"] += line.quantity
                product_freq[prod_name]["total_spent"] += Decimal(str(line.line_total or 0))
                if not product_freq[prod_name]["last_date"] or inv.created_at.isoformat() > product_freq[prod_name]["last_date"]:
                    product_freq[prod_name]["last_date"] = inv.created_at.strftime("%Y-%m-%d")
                total_products_amount += Decimal(str(line.line_total or 0))

                line_items_data.append({
                    "id": line.id,
                    "name": prod_name,
                    "type": "Product",
                    "quantity": line.quantity,
                    "unit_price": float(line.unit_price or 0),
                    "discount_amount": float(line.discount_amount or 0),
                    "line_total": float(line.line_total or 0),
                    "employee_name": emp_name
                })

        payment_methods = [p.method for p in inv.payments] if inv.payments else ["Cash"]

        visit_row = {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "created_at": inv.created_at.strftime("%Y-%m-%d %H:%M"),
            "date": inv.created_at.strftime("%d %b %Y"),
            "services": inv_services,
            "products": inv_products,
            "employees": list(inv_employees),
            "subtotal": float(inv.subtotal or 0),
            "discount": float(inv.discount or 0),
            "tax": float(inv.tax or 0),
            "total": float(inv.total or 0),
            "payment_methods": payment_methods,
            "status": inv.status,
            "line_items": line_items_data
        }
        visit_history.append(visit_row)

        items_desc = []
        if inv_services:
            items_desc.extend(inv_services)
        if inv_products:
            items_desc.extend([f"{p} (Product)" for p in inv_products])

        timeline.append({
            "date": inv.created_at.strftime("%d %b %Y"),
            "time": inv.created_at.strftime("%I:%M %p"),
            "type": "visit",
            "invoice_number": inv.invoice_number,
            "title": f"Salon Visit - {inv.invoice_number}",
            "items": items_desc,
            "amount": float(inv.total or 0)
        })

    purchased_services = [
        {
            "name": name,
            "times_taken": data["count"],
            "total_spent": float(data["total_spent"]),
            "last_taken_date": data["last_date"]
        } for name, data in service_freq.items()
    ]
    purchased_services.sort(key=lambda x: x["times_taken"], reverse=True)

    purchased_products = [
        {
            "name": name,
            "quantity_purchased": data["qty"],
            "total_spent": float(data["total_spent"]),
            "last_purchased_date": data["last_date"]
        } for name, data in product_freq.items()
    ]
    purchased_products.sort(key=lambda x: x["quantity_purchased"], reverse=True)

    memberships_data = []
    active_membership_name = None
    active_membership_status = "Inactive"

    import json
    for m in memberships:
        plan_name = m.plan.name if m.plan else "Membership Plan"
        if m.status == "active" and not active_membership_name:
            active_membership_name = plan_name
            active_membership_status = "Active"

        benefits = []
        for b in m.benefits:
            benefits.append({
                "service_name": b.service.name if b.service else "Service Perk",
                "total_quantity": b.total_quantity,
                "remaining_quantity": b.remaining_quantity
            })

        memberships_data.append({
            "id": m.id,
            "plan_name": plan_name,
            "start_date": m.created_at.strftime("%Y-%m-%d"),
            "expiry_date": m.expires_at.strftime("%Y-%m-%d") if m.expires_at else "N/A",
            "status": m.status,
            "service_discount_percentage": float(m.plan.service_discount_percentage) if m.plan else 0.0,
            "day_restrictions": json.loads(m.plan.day_restrictions) if (m.plan and m.plan.day_restrictions) else [],
            "eligible_services": [es.service_id for es in m.plan.eligible_services] if m.plan else [],
            "benefits": benefits
        })

    preferred_stylist = max(stylist_freq.items(), key=lambda x: x[1])[0] if stylist_freq else "No Preference"
    preferred_services = [s["name"] for s in purchased_services[:3]]

    summary = {
        "id": customer.id,
        "first_name": customer.first_name,
        "last_name": customer.last_name or "",
        "full_name": f"{customer.first_name} {customer.last_name or ''}".strip(),
        "phone": customer.phone,
        "email": customer.email or "Not Provided",
        "gender": customer.gender or "Not Specified",
        "date_joined": customer.created_at.strftime("%d %b %Y"),
        "membership_status": active_membership_status,
        "membership_plan": active_membership_name or "None",
        "total_visits": len(visit_history),
        "total_bills": len(visit_history),
        "total_amount_spent": float(grand_total_spent),
        "last_visit_date": visit_history[0]["date"] if visit_history else "No Visits Yet",
        "loyalty_points": len(visit_history) * 10,
        "preferred_stylist": preferred_stylist,
        "preferred_services": preferred_services,
        "notes": customer.notes or "Regular salon visitor. Prefers organic hair products.",
        "allergies": "None Reported"
    }

    financial_summary = {
        "total_bills": len(visit_history),
        "total_services_amount": float(total_services_amount),
        "total_products_amount": float(total_products_amount),
        "total_discounts_given": float(total_discounts_given),
        "total_tax_paid": float(total_tax_paid),
        "grand_total_spent": float(grand_total_spent)
    }

    return success_response({
        "summary": summary,
        "visit_history": visit_history,
        "purchased_services": purchased_services,
        "purchased_products": purchased_products,
        "memberships": memberships_data,
        "financial_summary": financial_summary,
        "timeline": timeline,
        "upcoming_appointments": []
    })


@customers_bp.route("/customers/dormant", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_dormant_customers():
    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    threshold_days = setting.churn_days_threshold if setting and setting.churn_days_threshold else 45

    now = datetime.utcnow()
    limit_date = now - timedelta(days=threshold_days)

    subquery = db.session.query(
        Invoice.customer_id,
        func.max(Invoice.created_at).label("last_visit")
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    ).group_by(Invoice.customer_id).subquery()

    query = db.session.query(
        Customer,
        subquery.c.last_visit
    ).filter(
        Customer.tenant_id == g.parlour_id
    ).outerjoin(
        subquery, Customer.id == subquery.c.customer_id
    )

    query = query.filter(
        or_(
            subquery.c.last_visit < limit_date,
            and_(
                subquery.c.last_visit == None,
                Customer.created_at < limit_date
            )
        )
    )

    results = query.all()

    data = []
    for customer, last_visit in results:
        ref_date = last_visit or customer.created_at
        days_since = (now - ref_date).days
        
        data.append({
            "id": customer.id,
            "first_name": customer.first_name,
            "last_name": customer.last_name or "",
            "phone": customer.phone,
            "email": customer.email or "",
            "gender": customer.gender or "",
            "last_visit_date": last_visit.isoformat() if last_visit else None,
            "days_inactive": days_since,
            "created_at": customer.created_at.isoformat()
        })

    data.sort(key=lambda x: x["days_inactive"], reverse=True)

    return success_response({
        "items": data,
        "threshold_days": threshold_days
    })
