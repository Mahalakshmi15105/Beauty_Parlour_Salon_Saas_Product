from flask import Blueprint, request, g
from sqlalchemy import func, case, or_, and_
from app.database import db
from app.models.visit_membership import VisitMembershipSetting, CustomerVisitCounter, CustomerPointsCounter
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
            "free_service_ids": [],
            "points_spend_amount": 100.0,
            "points_per_unit": 5.0,
            "points_target": 100.0,
            "points_discount_percentage": 5.0
        })

    return success_response(setting.to_dict())


@visit_membership_bp.route("/visit-membership/settings", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_settings():
    data = request.get_json() or {}
    branch_id = get_active_branch_id(data.get("branch_id"))

    membership_mode = data.get("membership_mode", "paid_plan")
    if membership_mode not in ["paid_plan", "visit_based", "points_based"]:
        return error_response("INVALID_MODE", "Membership mode must be 'paid_plan', 'visit_based', or 'points_based'.", 400)

    try:
        required_visits = int(data.get("required_visits", 6))
        if required_visits < 1:
            required_visits = 1
    except (ValueError, TypeError):
        required_visits = 6

    try:
        points_spend_amount = float(data.get("points_spend_amount", 100.0))
        if points_spend_amount <= 0:
            points_spend_amount = 100.0
    except (ValueError, TypeError):
        points_spend_amount = 100.0

    try:
        points_per_unit = float(data.get("points_per_unit", 5.0))
        if points_per_unit <= 0:
            points_per_unit = 5.0
    except (ValueError, TypeError):
        points_per_unit = 5.0

    try:
        points_target = float(data.get("points_target", 100.0))
        if points_target <= 0:
            points_target = 100.0
    except (ValueError, TypeError):
        points_target = 100.0

    try:
        points_discount_percentage = float(data.get("points_discount_percentage", 5.0))
        if points_discount_percentage < 0 or points_discount_percentage > 100:
            points_discount_percentage = 5.0
    except (ValueError, TypeError):
        points_discount_percentage = 5.0

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
    setting.points_spend_amount = points_spend_amount
    setting.points_per_unit = points_per_unit
    setting.points_target = points_target
    setting.points_discount_percentage = points_discount_percentage

    db.session.commit()
    logger.info(f"Updated VisitMembershipSetting for Tenant {g.parlour_id}, Branch {branch_id}: mode={membership_mode}")
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

    # Type B: Visit-based loyalty status
    counter = CustomerVisitCounter.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id,
        customer_id=customer_id
    ).first()

    curr_count = counter.current_visit_count if counter else 0
    is_eligible = (mode == "visit_based") and (curr_count >= req_visits)
    total_claimed = counter.total_free_services_claimed if counter else 0

    # Type C: Points-based loyalty status
    points_counter = CustomerPointsCounter.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id,
        customer_id=customer_id
    ).first()

    points_spend_amount = float(setting.points_spend_amount or 100.0) if setting else 100.0
    points_per_unit = float(setting.points_per_unit or 5.0) if setting else 5.0
    points_target = float(setting.points_target or 100.0) if setting else 100.0
    points_discount_percentage = float(setting.points_discount_percentage or 5.0) if setting else 5.0

    current_points = float(points_counter.current_points or 0.0) if points_counter else 0.0
    total_points_earned = float(points_counter.total_points_earned or 0.0) if points_counter else 0.0
    total_points_redeemed = float(points_counter.total_points_redeemed or 0.0) if points_counter else 0.0
    total_redemptions = int(points_counter.total_redemptions or 0) if points_counter else 0
    total_discount_amount_claimed = float(points_counter.total_discount_amount_claimed or 0.0) if points_counter else 0.0
    is_points_eligible = (mode == "points_based") and (current_points >= points_target)

    # Fetch free eligible service details for UI display (Type B)
    free_services_list = []
    if free_ids and mode == "visit_based":
        services = get_tenant_query(Service).filter(Service.id.in_(free_ids), Service.status == "active").all()
        free_services_list = [{"id": s.id, "name": s.name, "price": float(s.price)} for s in services]

    return success_response({
        "customer_id": customer_id,
        "tenant_id": g.parlour_id,
        "branch_id": branch_id,
        "membership_mode": mode,
        # Type B
        "current_visit_count": curr_count,
        "required_visits": req_visits,
        "total_free_services_claimed": total_claimed,
        "is_eligible": is_eligible,
        "qualifying_service_ids": qual_ids,
        "free_service_ids": free_ids,
        "free_services": free_services_list,
        "last_visit_date": counter.last_visit_date.isoformat() if counter and counter.last_visit_date else None,
        # Type C (Points-Based)
        "current_points": current_points,
        "points_spend_amount": points_spend_amount,
        "points_per_unit": points_per_unit,
        "points_target": points_target,
        "points_discount_percentage": points_discount_percentage,
        "is_points_eligible": is_points_eligible,
        "total_points_earned": total_points_earned,
        "total_points_redeemed": total_points_redeemed,
        "total_redemptions": total_redemptions,
        "total_discount_amount_claimed": total_discount_amount_claimed,
        "last_points_transaction_date": points_counter.last_transaction_date.isoformat() if points_counter and points_counter.last_transaction_date else None
    })


@visit_membership_bp.route("/visit-membership/customer-records", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_customer_records():
    branch_id = get_active_branch_id(request.args.get("branch_id"))
    search_q = request.args.get("search", "").strip()
    sort_by = request.args.get("sort", "last_visit")
    
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))
    except (ValueError, TypeError):
        page, limit = 1, 50

    # 1. Fetch branch setting
    setting = VisitMembershipSetting.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id
    ).first()

    req_visits = setting.required_visits if setting else 6
    membership_mode = setting.membership_mode if setting else "paid_plan"

    # 2. Outer join Customer with CustomerVisitCounter for branch_id
    query = db.session.query(Customer, CustomerVisitCounter).select_from(Customer).outerjoin(
        CustomerVisitCounter,
        and_(
            CustomerVisitCounter.customer_id == Customer.id,
            CustomerVisitCounter.tenant_id == g.parlour_id,
            CustomerVisitCounter.branch_id == branch_id
        )
    ).filter(
        Customer.tenant_id == g.parlour_id,
        Customer.is_deleted == False
    )

    # Enforce Customer branch isolation
    role = getattr(g, "role", None)
    if role == "BranchAdmin" and hasattr(g, "branch_id") and g.branch_id:
        query = query.filter(or_(Customer.branch_id == g.branch_id, Customer.branch_id.is_(None)))
    elif role == "ParlourAdmin":
        b_param = request.args.get("branch_id")
        if b_param and str(b_param).strip() not in ("all", "main", "null", "0", "None"):
            try:
                bid = int(b_param)
                query = query.filter(or_(Customer.branch_id == bid, Customer.branch_id.is_(None)))
            except (ValueError, TypeError):
                pass

    if search_q:
        search_filter = f"%{search_q}%"
        query = query.filter(
            or_(
                Customer.first_name.ilike(search_filter),
                Customer.last_name.ilike(search_filter),
                Customer.phone.ilike(search_filter)
            )
        )

    # Apply Sorting
    if sort_by == "visit_count":
        query = query.order_by(func.coalesce(CustomerVisitCounter.current_visit_count, 0).desc(), Customer.id.desc())
    elif sort_by == "name":
        query = query.order_by(Customer.first_name.asc())
    else:  # "last_visit"
        query = query.order_by(
            case((CustomerVisitCounter.last_visit_date.is_(None), 1), else_=0),
            CustomerVisitCounter.last_visit_date.desc(),
            Customer.id.desc()
        )

    total_records = query.count()
    results = query.offset((page - 1) * limit).limit(limit).all()

    items = []
    for cust, counter in results:
        curr_count = counter.current_visit_count if counter else 0
        claimed_count = counter.total_free_services_claimed if counter else 0
        is_eligible = curr_count >= req_visits

        if is_eligible:
            status = "🎁 Reward Ready"
        elif curr_count > 0:
            status = "In Progress"
        elif claimed_count > 0:
            status = "Redeemed"
        else:
            status = "New Client"

        items.append({
            "customer_id": cust.id,
            "customer_name": f"{cust.first_name} {cust.last_name or ''}".strip(),
            "phone": cust.phone,
            "current_visit_count": curr_count,
            "required_visits": req_visits,
            "total_free_services_claimed": claimed_count,
            "is_eligible": is_eligible,
            "status": status,
            "last_visit_date": counter.last_visit_date.isoformat() if counter and counter.last_visit_date else None
        })

    return success_response({
        "items": items,
        "total": total_records,
        "page": page,
        "limit": limit,
        "membership_mode": membership_mode,
        "required_visits": req_visits
    })


@visit_membership_bp.route("/visit-membership/points-customer-records", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_points_customer_records():
    branch_id = get_active_branch_id(request.args.get("branch_id"))
    search_q = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "all")
    sort_by = request.args.get("sort", "points")
    
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))
    except (ValueError, TypeError):
        page, limit = 1, 50

    # 1. Fetch branch setting
    setting = VisitMembershipSetting.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id
    ).first()

    points_target = float(setting.points_target or 100.0) if setting else 100.0
    points_spend_amount = float(setting.points_spend_amount or 100.0) if setting else 100.0
    points_per_unit = float(setting.points_per_unit or 5.0) if setting else 5.0
    points_discount_percentage = float(setting.points_discount_percentage or 5.0) if setting else 5.0
    membership_mode = setting.membership_mode if setting else "points_based"

    # 2. Outer join Customer with CustomerPointsCounter for branch_id
    query = db.session.query(Customer, CustomerPointsCounter).select_from(Customer).outerjoin(
        CustomerPointsCounter,
        and_(
            CustomerPointsCounter.customer_id == Customer.id,
            CustomerPointsCounter.tenant_id == g.parlour_id,
            CustomerPointsCounter.branch_id == branch_id
        )
    ).filter(
        Customer.tenant_id == g.parlour_id,
        Customer.is_deleted == False
    )

    # Enforce Customer branch isolation
    role = getattr(g, "role", None)
    if role == "BranchAdmin" and hasattr(g, "branch_id") and g.branch_id:
        query = query.filter(or_(Customer.branch_id == g.branch_id, Customer.branch_id.is_(None)))
    elif role == "ParlourAdmin":
        b_param = request.args.get("branch_id")
        if b_param and str(b_param).strip() not in ("all", "main", "null", "0", "None"):
            try:
                bid = int(b_param)
                query = query.filter(or_(Customer.branch_id == bid, Customer.branch_id.is_(None)))
            except (ValueError, TypeError):
                pass

    if search_q:
        search_f = f"%{search_q}%"
        query = query.filter(
            or_(
                Customer.first_name.ilike(search_f),
                Customer.last_name.ilike(search_f),
                Customer.phone.ilike(search_f)
            )
        )

    # Status filter
    if status_filter == "target_reached":
        query = query.filter(func.coalesce(CustomerPointsCounter.current_points, 0) >= points_target)
    elif status_filter == "in_progress":
        query = query.filter(
            and_(
                func.coalesce(CustomerPointsCounter.current_points, 0) > 0,
                func.coalesce(CustomerPointsCounter.current_points, 0) < points_target
            )
        )

    # Apply Sorting
    if sort_by == "points":
        query = query.order_by(func.coalesce(CustomerPointsCounter.current_points, 0).desc(), Customer.id.desc())
    elif sort_by == "name":
        query = query.order_by(Customer.first_name.asc())
    elif sort_by == "redemptions":
        query = query.order_by(func.coalesce(CustomerPointsCounter.total_redemptions, 0).desc(), Customer.id.desc())
    else:  # "last_transaction"
        query = query.order_by(
            case((CustomerPointsCounter.last_transaction_date.is_(None), 1), else_=0),
            CustomerPointsCounter.last_transaction_date.desc(),
            Customer.id.desc()
        )

    total_records = query.count()
    results = query.offset((page - 1) * limit).limit(limit).all()

    items = []
    for cust, counter in results:
        curr_pts = float(counter.current_points or 0.0) if counter else 0.0
        total_earned = float(counter.total_points_earned or 0.0) if counter else 0.0
        total_redeemed = float(counter.total_points_redeemed or 0.0) if counter else 0.0
        redemptions_cnt = int(counter.total_redemptions or 0) if counter else 0
        claimed_amt = float(counter.total_discount_amount_claimed or 0.00) if counter else 0.00
        is_target_reached = curr_pts >= points_target

        if is_target_reached:
            status = f"🎯 Target Reached ({points_discount_percentage}% Off Ready)"
        elif curr_pts > 0:
            status = "In Progress"
        elif redemptions_cnt > 0:
            status = "Redeemed"
        else:
            status = "New Client"

        progress_pct = min(100.0, round((curr_pts / points_target) * 100, 1)) if points_target > 0 else 0.0

        items.append({
            "customer_id": cust.id,
            "customer_name": f"{cust.first_name} {cust.last_name or ''}".strip(),
            "phone": cust.phone,
            "current_points": curr_pts,
            "target_points": points_target,
            "progress_percentage": progress_pct,
            "is_target_reached": is_target_reached,
            "status": status,
            "total_points_earned": total_earned,
            "total_points_redeemed": total_redeemed,
            "total_redemptions": redemptions_cnt,
            "total_discount_amount_claimed": claimed_amt,
            "points_discount_percentage": points_discount_percentage,
            "last_transaction_date": counter.last_transaction_date.isoformat() if counter and counter.last_transaction_date else None
        })

    return success_response({
        "items": items,
        "total": total_records,
        "page": page,
        "limit": limit,
        "membership_mode": membership_mode,
        "points_target": points_target,
        "points_spend_amount": points_spend_amount,
        "points_per_unit": points_per_unit,
        "points_discount_percentage": points_discount_percentage
    })


@visit_membership_bp.route("/visit-membership/points-adjust", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def adjust_points():
    data = request.get_json() or {}
    customer_id = data.get("customer_id")
    branch_id = get_active_branch_id(data.get("branch_id"))
    
    try:
        new_points = float(data.get("new_points", 0.0))
        if new_points < 0:
            new_points = 0.0
    except (ValueError, TypeError):
        new_points = 0.0

    if not customer_id:
        return error_response("MISSING_CUSTOMER", "Customer ID is required.", 400)

    counter = CustomerPointsCounter.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id,
        customer_id=customer_id
    ).first()

    if not counter:
        counter = CustomerPointsCounter(
            tenant_id=g.parlour_id,
            branch_id=branch_id,
            customer_id=customer_id,
            current_points=new_points,
            total_points_earned=new_points
        )
        db.session.add(counter)
    else:
        counter.current_points = new_points

    db.session.commit()
    logger.info(f"Manually adjusted points for customer {customer_id} at branch {branch_id} to {new_points}")

    return success_response({
        "customer_id": customer_id,
        "branch_id": branch_id,
        "current_points": counter.current_points,
        "message": f"Customer points balance set to {new_points}."
    })


@visit_membership_bp.route("/visit-membership/reset-counter", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def reset_counter():
    data = request.get_json() or {}
    customer_id = data.get("customer_id")
    branch_id = get_active_branch_id(data.get("branch_id"))
    
    try:
        new_count = int(data.get("new_count", 0))
        if new_count < 0:
            new_count = 0
    except (ValueError, TypeError):
        new_count = 0

    if not customer_id:
        return error_response("MISSING_CUSTOMER", "Customer ID is required.", 400)

    counter = CustomerVisitCounter.query.filter_by(
        tenant_id=g.parlour_id,
        branch_id=branch_id,
        customer_id=customer_id
    ).first()

    if not counter:
        counter = CustomerVisitCounter(
            tenant_id=g.parlour_id,
            branch_id=branch_id,
            customer_id=customer_id,
            current_visit_count=new_count
        )
        db.session.add(counter)
    else:
        counter.current_visit_count = new_count

    db.session.commit()
    logger.info(f"Manually reset/set visit counter for customer {customer_id} at branch {branch_id} to {new_count}")

    return success_response({
        "customer_id": customer_id,
        "branch_id": branch_id,
        "current_visit_count": counter.current_visit_count,
        "message": f"Customer visit count set to {new_count}."
    })
