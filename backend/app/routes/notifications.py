import logging
from datetime import datetime, timezone, timedelta
from flask import Blueprint, request, g
from sqlalchemy import cast, Date, func
from app.database import db
from app.models.notification import Notification
from app.models.membership import CustomerMembership, MembershipPlan
from app.models.customer import Customer
from app.models.global_models import Tenant
from app.routes.auth import require_role
from app.utils.responses import success_response, error_response
from app.utils.auth import get_tenant_query, get_branch_query

logger = logging.getLogger(__name__)

notifications_bp = Blueprint("notifications", __name__)

def check_and_generate_expiry_notifications(target_tenant_id=None):
    """
    Automated job to scan active customer memberships and generate expiry notifications
    for stages: 30d, 15d, 7d, 3d, 1d, 0d, expired. Guarantees zero duplicate notifications.
    """
    try:
        today = datetime.now(timezone.utc).date()
        max_expiry_date = today + timedelta(days=30)

        query = CustomerMembership.query
        if target_tenant_id:
            query = query.filter_by(tenant_id=target_tenant_id)
        
        # Only query memberships expiring in the next 30 days (or already expired)
        query = query.filter(cast(CustomerMembership.expires_at, Date) <= max_expiry_date)
        memberships = query.all()
        created_count = 0

        for m in memberships:
            if not m.expires_at:
                continue

            exp_date = m.expires_at.date() if isinstance(m.expires_at, datetime) else m.expires_at
            remaining_days = (exp_date - today).days

            # Determine target stage
            stage = None
            title = "Membership Expiring Soon"
            
            if 15 < remaining_days <= 30:
                stage = "30d"
            elif 7 < remaining_days <= 15:
                stage = "15d"
            elif 3 < remaining_days <= 7:
                stage = "7d"
            elif 1 < remaining_days <= 3:
                stage = "3d"
            elif remaining_days == 1:
                stage = "1d"
            elif remaining_days == 0:
                stage = "0d"
                title = "Membership Expires Today"
            elif remaining_days < 0:
                # Do not check memberships that expired long ago (e.g. more than 30 days ago)
                # to avoid spamming or loading very old records.
                if remaining_days < -30:
                    continue
                stage = "expired"
                title = "Membership Expired"

            if not stage:
                continue

            # Anti-Duplication Guard
            existing = Notification.query.filter_by(
                tenant_id=m.tenant_id,
                customer_membership_id=m.id,
                stage=stage
            ).first()

            if existing:
                continue

            # Load details for notification payload
            customer = db.session.get(Customer, m.customer_id)
            plan = db.session.get(MembershipPlan, m.membership_plan_id)
            cust_name = f"{customer.first_name} {customer.last_name or ''}".strip() if customer else "Customer"
            plan_name = plan.name if plan else "Membership Plan"
            salon_name = "Salon"
            try:
                with db.get_master_engine().connect() as conn:
                    from sqlalchemy import text
                    row = conn.execute(text("SELECT name FROM tenants WHERE id = :id"), {"id": m.tenant_id}).fetchone()
                    if row and row[0]:
                        salon_name = row[0]
            except Exception:
                pass

            if stage == "expired":
                message = f"Customer {cust_name}'s {plan_name} membership has expired on {exp_date.strftime('%d %b %Y')}."
            elif stage == "0d":
                message = f"Customer {cust_name}'s {plan_name} membership expires today!"
            elif stage == "1d":
                message = f"Customer {cust_name}'s {plan_name} membership expires tomorrow."
            else:
                message = f"Customer {cust_name}'s {plan_name} membership expires in {remaining_days} days."

            notif = Notification(
                tenant_id=m.tenant_id,
                customer_id=m.customer_id,
                customer_membership_id=m.id,
                type="membership_expiry",
                stage=stage,
                title=title,
                message=message,
                data={
                    "customer_name": cust_name,
                    "membership_name": plan_name,
                    "expiry_date": exp_date.strftime("%d %b %Y"),
                    "remaining_days": remaining_days if remaining_days >= 0 else "Expired",
                    "salon_name": salon_name,
                    "customer_id": m.customer_id,
                    "customer_membership_id": m.id
                },
                is_read=False
            )
            db.session.add(notif)
            created_count += 1

        if created_count > 0:
            db.session.commit()
            logger.info(f"Generated {created_count} new membership expiry notifications.")
        return created_count
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error checking membership expiries: {str(e)}")
        return 0



def check_and_generate_inactive_customer_notifications(target_tenant_id=None):
    from app.models.billing import Invoice, InvoiceLineItem
    from app.models.catalog import Service
    from app.models.employee import Employee
    from app.models.membership import CustomerMembership

    if not target_tenant_id:
        return 0

    try:
        today = datetime.now(timezone.utc).date()
        threshold_date = today - timedelta(days=60)

        # 1. Get the latest invoice date for each customer of this tenant via a single subquery
        latest_invoice_sub = db.session.query(
            Invoice.customer_id,
            func.max(Invoice.created_at).label("latest_created_at")
        ).filter(
            Invoice.tenant_id == target_tenant_id,
            (Invoice.status == None) | (~Invoice.status.in_(["Void", "Voided"]))
        ).group_by(Invoice.customer_id).subquery()

        # 2. Join Customer with subquery and filter for customers whose latest visit is older than 60 days
        inactive_customers_query = db.session.query(Customer, latest_invoice_sub.c.latest_created_at).join(
            latest_invoice_sub, Customer.id == latest_invoice_sub.c.customer_id
        ).filter(
            Customer.tenant_id == target_tenant_id,
            cast(latest_invoice_sub.c.latest_created_at, Date) <= threshold_date
        )

        inactive_records = inactive_customers_query.all()
        if not inactive_records:
            return 0

        created_count = 0
        salon_name = "Salon"
        try:
            with db.get_master_engine().connect() as conn:
                from sqlalchemy import text
                row = conn.execute(text("SELECT name FROM tenants WHERE id = :id"), {"id": target_tenant_id}).fetchone()
                if row and row[0]:
                    salon_name = row[0]
        except Exception:
            pass

        for c, latest_created_at in inactive_records:
            last_date = latest_created_at.date() if isinstance(latest_created_at, datetime) else latest_created_at
            days_inactive = (today - last_date).days

            stage = None
            if 60 <= days_inactive < 90:
                stage = "2m"
            elif 90 <= days_inactive < 120:
                stage = "3m"
            elif 120 <= days_inactive < 180:
                stage = "4m"
            elif 180 <= days_inactive < 365:
                stage = "6m"
            elif days_inactive >= 365:
                stage = "1y"

            if not stage:
                continue

            # Anti-Duplication Guard
            existing = Notification.query.filter_by(
                tenant_id=c.tenant_id,
                customer_id=c.id,
                type="inactive_customer",
                stage=stage
            ).first()

            if existing:
                continue

            # Fetch the actual last invoice to compile metadata
            last_inv = Invoice.query.filter_by(
                customer_id=c.id,
                tenant_id=c.tenant_id
            ).filter(
                (Invoice.status == None) | (~Invoice.status.in_(["Void", "Voided"]))
            ).order_by(Invoice.created_at.desc()).first()

            if not last_inv:
                continue

            # Compute stats
            last_service_name = "Salon Service"
            last_stylist_name = "N/A"
            for line in last_inv.line_items:
                if line.service_id:
                    svc = db.session.get(Service, line.service_id)
                    if svc:
                        last_service_name = svc.name
                if line.employee_id:
                    emp = db.session.get(Employee, line.employee_id)
                    if emp:
                        last_stylist_name = f"{emp.first_name} {emp.last_name or ''}".strip()

            active_membership = CustomerMembership.query.filter_by(
                customer_id=c.id,
                tenant_id=c.tenant_id,
                status="active"
            ).first()
            membership_status = active_membership.plan.name if (active_membership and active_membership.plan) else "None"

            # Lifetime visits & spending
            all_invs = Invoice.query.filter_by(
                customer_id=c.id,
                tenant_id=c.tenant_id
            ).filter(
                (Invoice.status == None) | (~Invoice.status.in_(["Void", "Voided"]))
            ).all()

            total_visits = len(all_invs)
            total_spent = sum([float(inv.total or 0) for inv in all_invs])

            cust_name = f"{c.first_name} {c.last_name or ''}".strip()

            title = "Inactive Customer Alert"
            message = f"Customer {cust_name} has not visited for {days_inactive} days. Last Visit: {last_date.strftime('%d-%b-%Y')} | Last Service: {last_service_name}"

            notif = Notification(
                tenant_id=c.tenant_id,
                customer_id=c.id,
                type="inactive_customer",
                stage=stage,
                title=title,
                message=message,
                data={
                    "customer_name": cust_name,
                    "phone": c.phone,
                    "last_visit_date": last_date.strftime("%d-%b-%Y"),
                    "days_since_last_visit": days_inactive,
                    "last_service": last_service_name,
                    "last_stylist": last_stylist_name,
                    "membership_status": membership_status,
                    "total_visits": total_visits,
                    "total_spent": total_spent,
                    "salon_name": salon_name,
                    "customer_id": c.id
                },
                is_read=False
            )
            db.session.add(notif)
            created_count += 1

        if created_count > 0:
            db.session.commit()
            logger.info(f"Generated {created_count} new inactive customer notifications.")
        return created_count
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error checking inactive customers: {str(e)}")
        return 0


@notifications_bp.route("/notifications", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def get_notifications():
    from app.models.notification import Notification

    unread_only = request.args.get("unread_only", "false").lower() == "true"
    notif_type = request.args.get("type", None)
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))

    query = get_tenant_query(Notification)

    if unread_only:
        query = query.filter_by(is_read=False)
    if notif_type and notif_type != "all":
        query = query.filter_by(type=notif_type)

    total_count = query.count()
    unread_count = get_tenant_query(Notification).filter_by(is_read=False).count()

    notifications = query.order_by(Notification.created_at.desc()).paginate(
        page=page, per_page=limit, error_out=False
    )

    items = []
    for n in notifications.items:
        items.append({
            "id": n.id,
            "tenant_id": n.tenant_id,
            "customer_id": n.customer_id,
            "customer_membership_id": n.customer_membership_id,
            "type": n.type,
            "stage": n.stage,
            "title": n.title,
            "message": n.message,
            "data": n.data or {},
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else ""
        })

    return success_response({
        "items": items,
        "total_count": total_count,
        "unread_count": unread_count,
        "page": page,
        "limit": limit
    })


@notifications_bp.route("/notifications/read-all", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def mark_all_notifications_read():
    try:
        get_tenant_query(Notification).filter_by(is_read=False).update({"is_read": True})
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to mark notifications as read.",
            status_code=500
        )

    return success_response({"message": "All notifications marked as read.", "unread_count": 0})


@notifications_bp.route("/notifications/check-expiries", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def trigger_expiry_check():
    c1 = check_and_generate_expiry_notifications(g.parlour_id)
    c2 = check_and_generate_inactive_customer_notifications(g.parlour_id)
    return success_response({"message": f"Scan completed. {c1 + c2} new notifications created."})


@notifications_bp.route("/notifications/<int:notif_id>/read", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin", "SuperAdmin"])
def mark_notification_read(notif_id):
    notif = get_tenant_query(Notification).filter_by(id=notif_id).first()
    if not notif:
        return error_response(
            error_code="NOTIFICATION_NOT_FOUND",
            message="Notification not found.",
            status_code=404
        )

    notif.is_read = True
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to mark notification as read.",
            status_code=500
        )

    unread_count = get_tenant_query(Notification).filter_by(is_read=False).count()
    return success_response({"message": "Notification marked as read.", "unread_count": unread_count})
