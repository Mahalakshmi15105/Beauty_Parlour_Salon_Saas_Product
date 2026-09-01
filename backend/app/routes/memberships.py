from flask import Blueprint, request, g
import json
from app.database import db
from app.models.membership import MembershipPlan, CustomerMembership, MembershipBenefit, MembershipPlanService
from app.models.global_models import Tenant
from app.models.catalog import Service
from app.models.customer import Customer
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.utils.query import paginate_query
from datetime import datetime, timedelta
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)
memberships_bp = Blueprint("memberships", __name__)

# --- MEMBERSHIP PLANS CRUD ---

@memberships_bp.route("/membership-plans", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_plans():
    q = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")
    sort = request.args.get("sort", "name")

    query = get_branch_query(MembershipPlan)

    if q:
        query = query.filter(
            (MembershipPlan.name.ilike(f"%{q}%")) |
            (MembershipPlan.description.ilike(f"%{q}%"))
        )

    if status:
        query = query.filter(MembershipPlan.status == status)

    sort_field = "id"
    sort_desc = False
    if sort.startswith("-"):
        sort_field = sort[1:]
        sort_desc = True
    else:
        sort_field = sort

    plans, next_cursor = paginate_query(
        query=query,
        model=MembershipPlan,
        limit_val=limit,
        cursor=cursor,
        sort_field=sort_field,
        sort_desc=sort_desc
    )

    data = [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": float(p.price),
            "duration_days": p.duration_days,
            "service_discount_percentage": float(p.service_discount_percentage),
            "status": p.status,
            "day_restrictions": json.loads(p.day_restrictions) if p.day_restrictions else [],
            "eligible_services": [es.service_id for es in p.eligible_services],
            "created_at": p.created_at.isoformat()
        } for p in plans
    ]

    return success_response({
        "items": data,
        "next_cursor": next_cursor
    })


@memberships_bp.route("/membership-plans/<int:plan_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_plan(plan_id):
    plan = get_tenant_query(MembershipPlan).filter_by(id=plan_id).first()
    if not plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Membership Plan not found or access denied.",
            status_code=404
        )
    return success_response({
        "id": plan.id,
        "name": plan.name,
        "description": plan.description,
        "price": float(plan.price),
        "duration_days": plan.duration_days,
        "service_discount_percentage": float(plan.service_discount_percentage),
        "status": plan.status,
        "day_restrictions": json.loads(plan.day_restrictions) if plan.day_restrictions else [],
        "eligible_services": [es.service_id for es in plan.eligible_services]
    })


@memberships_bp.route("/membership-plans", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_plan():
    # Ensure tenant context is available
    if not getattr(g, 'parlour_id', None):
        return error_response(
            error_code="TENANT_CONTEXT_MISSING",
            message="Parlour tenant context is missing. Please login again.",
            status_code=400
        )
    # Verify tenant exists
    g.use_master_db = True
    tenant = Tenant.query.filter_by(id=g.parlour_id, is_deleted=False).first()
    g.use_master_db = False
    if not tenant:
        return error_response(
            error_code="TENANT_NOT_FOUND",
            message="The selected parlour tenant does not exist.",
            status_code=400
        )
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    price = data.get("price", 0.00)
    duration = data.get("duration_days", 365)
    svc_disc = data.get("service_discount_percentage", 0.00)

    if not name:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Plan Name is required.",
            status_code=400
        )

    try:
        price_val = float(price)
        dur_val = int(duration)
        svc_disc_val = float(svc_disc)
        if price_val < 0 or dur_val <= 0 or svc_disc_val < 0:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Numeric settings (price, duration, discounts) must be positive values.",
            status_code=400
        )

    # Check duplicates in tenant context
    dup = get_branch_query(MembershipPlan).filter_by(name=name).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"A membership plan named '{name}' already exists.",
            status_code=400
        )

    day_restrictions = data.get("day_restrictions", [])
    eligible_services_ids = data.get("eligible_services", [])

    target_branch_id = g.branch_id if (hasattr(g, "branch_id") and g.branch_id) else (int(data["branch_id"]) if data.get("branch_id") else None)

    try:
        plan = MembershipPlan(
            tenant_id=g.parlour_id,
            branch_id=target_branch_id,
            name=name,
            description=data.get("description"),
            price=price_val,
            duration_days=dur_val,
            service_discount_percentage=svc_disc_val,
            product_discount_percentage=0.00,
            status=data.get("status", "active"),
            day_restrictions=json.dumps(day_restrictions) if day_restrictions else None
        )
        db.session.add(plan)
        db.session.flush() # Fetch plan.id for junction mapping

        for svc_id in eligible_services_ids:
            mapping = MembershipPlanService(
                tenant_id=g.parlour_id,
                membership_plan_id=plan.id,
                service_id=int(svc_id)
            )
            db.session.add(mapping)

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating plan: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message=f"Failed to create plan: {str(e)}",
            status_code=500
        )

    return success_response({"id": plan.id, "name": plan.name}, 201)


@memberships_bp.route("/membership-plans/<int:plan_id>", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_plan(plan_id):
    plan = get_tenant_query(MembershipPlan).filter_by(id=plan_id).first()
    if not plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Membership Plan not found or access denied.",
            status_code=404
        )

    # Ensure tenant context is available
    if not getattr(g, 'parlour_id', None):
        return error_response(
            error_code="TENANT_CONTEXT_MISSING",
            message="Parlour tenant context is missing. Please login again.",
            status_code=400
        )
    # Verify tenant exists
    g.use_master_db = True
    tenant = Tenant.query.filter_by(id=g.parlour_id, is_deleted=False).first()
    g.use_master_db = False
    if not tenant:
        return error_response(
            error_code="TENANT_NOT_FOUND",
            message="The selected parlour tenant does not exist.",
            status_code=400
        )
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    price = data.get("price", 0.00)
    duration = data.get("duration_days", 365)
    svc_disc = data.get("service_discount_percentage", 0.00)

    if not name:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Plan Name is required.",
            status_code=400
        )

    try:
        price_val = float(price)
        dur_val = int(duration)
        svc_disc_val = float(svc_disc)
        if price_val < 0 or dur_val <= 0 or svc_disc_val < 0:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Numeric settings (price, duration, discounts) must be positive values.",
            status_code=400
        )

    # Check duplicates
    dup = get_tenant_query(MembershipPlan).filter(MembershipPlan.name == name, MembershipPlan.id != plan_id).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"Another membership plan named '{name}' already exists.",
            status_code=400
        )

    day_restrictions = data.get("day_restrictions", [])
    eligible_services_ids = data.get("eligible_services", [])

    try:
        plan.name = name
        plan.description = data.get("description")
        plan.price = price_val
        plan.duration_days = dur_val
        plan.service_discount_percentage = svc_disc_val
        plan.product_discount_percentage = 0.00
        plan.status = data.get("status", "active")
        plan.day_restrictions = json.dumps(day_restrictions) if day_restrictions else None

        # Sync eligible services junction mapping
        MembershipPlanService.query.filter_by(membership_plan_id=plan.id).delete()
        for svc_id in eligible_services_ids:
            mapping = MembershipPlanService(
                tenant_id=g.parlour_id,
                membership_plan_id=plan.id,
                service_id=int(svc_id)
            )
            db.session.add(mapping)

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating plan: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message=f"Failed to update plan: {str(e)}",
            status_code=500
        )

    return success_response({"message": "Plan updated successfully."})


@memberships_bp.route("/membership-plans/<int:plan_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_plan(plan_id):
    plan = get_tenant_query(MembershipPlan).filter_by(id=plan_id).first()
    if not plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Membership Plan not found or access denied.",
            status_code=404
        )

    try:
        plan.soft_delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting plan: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete plan.",
            status_code=500
        )

    return success_response({"message": "Membership plan soft-deleted successfully."})


# --- CUSTOMER MEMBERSHIP ACTIONS ---

@memberships_bp.route("/memberships/assign", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def assign_membership():
    data = request.get_json() or {}
    customer_id = data.get("customer_id")
    plan_id = data.get("plan_id")
    benefits_data = data.get("benefits", [])  # list of {service_id, quantity}

    if not customer_id or not plan_id:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Customer ID and Plan ID are required.",
            status_code=400
        )

    # Verify customer and plan across tenant context
    customer = Customer.query.filter_by(id=customer_id, tenant_id=g.parlour_id, is_deleted=False).first()
    plan = MembershipPlan.query.filter_by(id=plan_id, tenant_id=g.parlour_id, is_deleted=False).first()

    if not customer or not plan:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Selected customer or active plan does not exist.",
            status_code=400
        )

    # Auto calculate expiry date with safe fallback for duration_days
    days = getattr(plan, 'duration_days', None)
    if not days or days <= 0:
        duration_cnt = getattr(plan, 'duration_count', 1) or 1
        validity_p = getattr(plan, 'validity_plan', 'Yearly') or 'Yearly'
        if str(validity_p).lower() == 'monthly':
            days = duration_cnt * 30
        else:
            days = duration_cnt * 365

    expiry_date = datetime.now() + timedelta(days=days)

    try:
        # Create linkage
        cm = CustomerMembership(
            tenant_id=g.parlour_id,
            customer_id=customer_id,
            membership_plan_id=plan_id,
            expires_at=expiry_date,
            status="active"
        )
        db.session.add(cm)
        db.session.flush()

        # Add benefits
        for b in benefits_data:
            svc_id = b.get("service_id")
            qty = int(b.get("quantity", 1))
            if not svc_id or qty <= 0:
                continue
            
            # Verify service
            svc = Service.query.filter_by(id=svc_id, tenant_id=g.parlour_id).first()
            if not svc:
                raise ValueError(f"Service ID {svc_id} is invalid.")

            benefit = MembershipBenefit(
                tenant_id=g.parlour_id,
                customer_membership_id=cm.id,
                service_id=svc_id,
                total_quantity=qty,
                remaining_quantity=qty
            )
            db.session.add(benefit)

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error assigning membership: {str(e)}")
        return error_response(
            error_code="TRANSACTION_FAILED",
            message=str(e) if isinstance(e, ValueError) else f"Failed to assign membership: {str(e)}",
            status_code=400 if isinstance(e, ValueError) else 500
        )

    return success_response({"membership_id": cm.id, "expires_at": cm.expires_at.isoformat()}, 201)


@memberships_bp.route("/memberships/<int:cm_id>/renew", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def renew_membership(cm_id):
    cm = CustomerMembership.query.filter_by(id=cm_id, tenant_id=g.parlour_id).first()
    if not cm:
        return error_response(
            error_code="MEMBERSHIP_NOT_FOUND",
            message="Membership record not found.",
            status_code=404
        )

    plan = get_tenant_query(MembershipPlan).filter_by(id=cm.membership_plan_id).first()
    if not plan:
        raise ValueError("Membership Plan associated is invalid.")

    # Extend expiration & increment renewal count
    base_date = max(datetime.now(), cm.expires_at)
    cm.expires_at = base_date + timedelta(days=plan.duration_days)
    cm.status = "active"
    cm.renew_count = (getattr(cm, 'renew_count', 0) or 0) + 1

    # Reset benefits
    try:
        for b in cm.benefits:
            b.remaining_quantity = b.total_quantity
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error renewing membership: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to renew membership.",
            status_code=500
        )

    return success_response({"message": "Membership renewed successfully.", "new_expiry": cm.expires_at.isoformat()})


@memberships_bp.route("/memberships/<int:cm_id>/upgrade", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def upgrade_membership(cm_id):
    cm = CustomerMembership.query.filter_by(id=cm_id, tenant_id=g.parlour_id).first()
    if not cm:
        return error_response(
            error_code="MEMBERSHIP_NOT_FOUND",
            message="Membership record not found.",
            status_code=404
        )

    data = request.get_json() or {}
    new_plan_id = data.get("plan_id")
    benefits_data = data.get("benefits", [])

    new_plan = get_tenant_query(MembershipPlan).filter_by(id=new_plan_id, status="active").first()
    if not new_plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Upgrade plan does not exist or is inactive.",
            status_code=400
        )

    try:
        # 1. Cancel old membership
        cm.status = "cancelled"  # mark upgraded as cancelled/upgraded audit state
        
        # 2. Assign new membership
        expiry_date = datetime.now() + timedelta(days=new_plan.duration_days)
        new_cm = CustomerMembership(
            tenant_id=g.parlour_id,
            customer_id=cm.customer_id,
            membership_plan_id=new_plan_id,
            expires_at=expiry_date,
            status="active"
        )
        db.session.add(new_cm)
        db.session.flush()

        # Add new benefits
        for b in benefits_data:
            svc_id = b.get("service_id")
            qty = int(b.get("quantity", 1))
            if not svc_id or qty <= 0:
                continue

            benefit = MembershipBenefit(
                tenant_id=g.parlour_id,
                customer_membership_id=new_cm.id,
                service_id=svc_id,
                total_quantity=qty,
                remaining_quantity=qty
            )
            db.session.add(benefit)

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error upgrading membership: {str(e)}")
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to upgrade membership.",
            status_code=500
        )

    return success_response({"membership_id": new_cm.id, "new_plan_name": new_plan.name})


@memberships_bp.route("/memberships/<int:cm_id>/cancel", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def cancel_membership(cm_id):
    cm = CustomerMembership.query.filter_by(id=cm_id, tenant_id=g.parlour_id).first()
    if not cm:
        return error_response(
            error_code="MEMBERSHIP_NOT_FOUND",
            message="Membership record not found.",
            status_code=404
        )

    try:
        cm.status = "cancelled"
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error cancelling membership: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to cancel membership.",
            status_code=500
        )

    return success_response({"message": "Membership cancelled successfully."})


@memberships_bp.route("/memberships", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_all_memberships():
    query = CustomerMembership.query.filter_by(tenant_id=g.parlour_id).order_by(CustomerMembership.id.desc())
    
    results = []
    for cm in query.all():
        benefits = []
        for b in cm.benefits:
            benefits.append({
                "id": b.id,
                "service_id": b.service_id,
                "service_name": b.service.name if b.service else None,
                "total_quantity": b.total_quantity,
                "remaining_quantity": b.remaining_quantity
            })
            
        results.append({
            "id": cm.id,
            "customer_id": cm.customer_id,
            "customer_name": f"{cm.customer.first_name} {cm.customer.last_name or ''}".strip() if cm.customer else "Unknown Customer",
            "customer_phone": cm.customer.phone if cm.customer else "No Phone",
            "plan_id": cm.membership_plan_id,
            "plan_name": cm.plan.name if cm.plan else "Default Membership",
            "expires_at": cm.expires_at.isoformat(),
            "status": cm.status,
            "renew_count": getattr(cm, "renew_count", 0) or 0,
            "benefits": benefits
        })
    return success_response(results)
