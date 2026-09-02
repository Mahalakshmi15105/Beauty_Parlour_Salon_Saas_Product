from flask import Blueprint, request, g
from app.database import db
from app.models.visit_membership import VisitMembershipSetting, CustomerVisitCounter
from app.models.customer import Customer
from app.models.catalog import Service
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_branch_query, get_tenant_query
import logging

logger = logging.getLogger(__name__)
visit_membership_bp = Blueprint("visit_membership", __name__)


def get_active_branch_id(override_branch_id=None):
    """Resolve current active branch ID (Integer or None for main parlour)."""
    if override_branch_id is not None:
        try:
            return int(override_branch_id) if override_branch_id != "" and str(override_branch_id).lower() != "null" else None
        except (ValueError, TypeError):
            pass
    if hasattr(g, "branch_id") and g.branch_id:
        return g.branch_id
    return None


@visit_membership_bp.route("/visit-membership/settings", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_settings():
    branch_id = get_active_branch_id(request.args.get("branch_id"))
    
    # Query setting scoped by tenant_id AND branch_id
    setting = VisitMembershipSetting.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id
    ).first()

    if not setting:
        return success_response({
            "id": None,
            "tenant_id": g.parlour_id,
            "branch_id": branch_id,
            "membership_mode": "paid_plan",
            "required_visits": 6,
            "qualifying_service_ids": [],
            "free_service_ids": []
        })

    return success_response(setting.to_dict())


@visit_membership_bp.route("/visit-membership/settings", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_settings():
    data = request.get_json() or {}
    branch_id = get_active_branch_id(data.get("branch_id"))

    membership_mode = data.get("membership_mode", "paid_plan")
    if membership_mode not in ["paid_plan", "visit_based"]:
        return error_response("INVALID_MODE", "Membership mode must be 'paid_plan' or 'visit_based'.", 400)

    try:
        required_visits = int(data.get("required_visits", 6))
        if required_visits < 1:
            required_visits = 1
    except (ValueError, TypeError):
        required_visits = 6

    qualifying_service_ids = data.get("qualifying_service_ids", [])
    free_service_ids = data.get("free_service_ids", [])

    setting = VisitMembershipSetting.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id
    ).first()

    if not setting:
        setting = VisitMembershipSetting(
            tenant_id=g.parlour_id,
            branch_id=branch_id
        )
        db.session.add(setting)

    setting.membership_mode = membership_mode
    setting.required_visits = required_visits
    setting.qualifying_service_ids = qualifying_service_ids
    setting.free_service_ids = free_service_ids

    db.session.commit()
    logger.info(f"Updated VisitMembershipSetting for Tenant {g.parlour_id}, Branch {branch_id}: mode={membership_mode}, required_visits={required_visits}")
    return success_response(setting.to_dict())


@visit_membership_bp.route("/visit-membership/customer-status/<int:customer_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_customer_status(customer_id):
    branch_id = get_active_branch_id(request.args.get("branch_id"))

    # Fetch branch settings
    setting = VisitMembershipSetting.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id
    ).first()

    mode = setting.membership_mode if setting else "paid_plan"
    req_visits = setting.required_visits if setting else 6
    qual_ids = setting.qualifying_service_ids if setting else []
    free_ids = setting.free_service_ids if setting else []

    # Fetch customer visit counter scoped strictly by tenant_id AND branch_id
    counter = CustomerVisitCounter.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id,
        customer_id=customer_id
    ).first()

    curr_count = counter.current_visit_count if counter else 0
    is_eligible = (mode == "visit_based") and (curr_count >= req_visits)

    # Fetch free eligible service details for UI display
    free_services_list = []
    if free_ids:
        services = get_tenant_query(Service).filter(Service.id.in_(free_ids), Service.status == "active").all()
        free_services_list = [{"id": s.id, "name": s.name, "price": float(s.price)} for s in services]

    return success_response({
        "customer_id": customer_id,
        "tenant_id": g.parlour_id,
        "branch_id": branch_id,
        "membership_mode": mode,
        "current_visit_count": curr_count,
        "required_visits": req_visits,
        "is_eligible": is_eligible,
        "qualifying_service_ids": qual_ids,
        "free_service_ids": free_ids,
        "free_services": free_services_list,
        "last_visit_date": counter.last_visit_date.isoformat() if counter and counter.last_visit_date else None
    })
