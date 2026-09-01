from flask import Blueprint, request, g
from app.database import db
from app.models.global_models import Tenant, SubscriptionPlan
from app.models.user import User, TenantSetting
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.billing import Invoice
from app.models.audit import AuditLog
from app.models.branch import Branch
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role
from app.utils.query import paginate_query
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from sqlalchemy import func
import logging

logger = logging.getLogger(__name__)
super_admin_bp = Blueprint("super_admin", __name__)

@super_admin_bp.route("/super-admin/dashboard", methods=["GET"])
@require_role(["SuperAdmin"])
def get_super_admin_dashboard():
    now = datetime.now(timezone.utc)
    
    # 1. Tenant Metrics
    total_tenants = Tenant.query.count()
    active_tenants = Tenant.query.filter_by(status="active").count()
    suspended_tenants = Tenant.query.filter_by(status="suspended").count()
    
    # Expired subscriptions
    expired_subs = Tenant.query.filter(
        Tenant.subscription_expires_at < now,
        Tenant.status == "active"
    ).count()

    # 2. MRR & ARR Calculations
    # Calculate MRR by summing subscription plan prices for active tenants
    active_tenant_plans = db.session.query(SubscriptionPlan.price).join(
        Tenant, Tenant.subscription_plan_id == SubscriptionPlan.id
    ).filter(Tenant.status == "active").all()

    mrr = sum([Decimal(str(r.price or 0.0)) for r in active_tenant_plans])
    arr = mrr * Decimal("12.00")

    # 3. Platform-Wide Aggregates
    total_customers = 0
    total_employees = 0
    total_invoices = 0
    active_tenants_list = Tenant.query.filter_by(status="active").all()
    for t in active_tenants_list:
        if t.db_connection_uri:
            g.use_master_db = False
            g.tenant_db_uri = t.db_connection_uri
            total_customers += Customer.query.count()
            total_employees += Employee.query.count()
            total_invoices += Invoice.query.count()
    g.use_master_db = True

    # 4. Recent Tenants
    recent_tenants_query = Tenant.query.order_by(Tenant.created_at.desc()).limit(5).all()
    recent_tenants = [
        {
            "id": t.id,
            "name": t.name,
            "status": t.status,
            "plan_name": t.subscription_plan.name if t.subscription_plan else "Standard",
            "created_at": t.created_at.isoformat()
        } for t in recent_tenants_query
    ]

    return success_response({
        "metrics": {
            "total_tenants": total_tenants,
            "active_tenants": active_tenants,
            "suspended_tenants": suspended_tenants,
            "expired_subscriptions": expired_subs,
            "mrr": float(mrr),
            "arr": float(arr),
            "total_customers": total_customers,
            "total_employees": total_employees,
            "total_invoices": total_invoices
        },
        "recent_tenants": recent_tenants
    })


@super_admin_bp.route("/super-admin/tenants", methods=["GET"])
@require_role(["SuperAdmin"])
def get_tenants():
    q = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")

    query = Tenant.query

    if q:
        query = query.filter(Tenant.name.ilike(f"%{q}%"))

    if status:
        query = query.filter(Tenant.status == status)

    tenants, next_cursor = paginate_query(
        query=query,
        model=Tenant,
        limit_val=limit,
        cursor=cursor,
        sort_field="id",
        sort_desc=True
    )

    items = []
    for t in tenants:
        # Find admin user for tenant
        admin_user = User.query.filter_by(tenant_id=t.id, role="ParlourAdmin").first()
        items.append({
            "id": t.id,
            "name": t.name,
            "status": t.status,
            "admin_email": admin_user.email if admin_user else "N/A",
            "plan_name": t.subscription_plan.name if t.subscription_plan else "N/A",
            "subscription_expires_at": t.subscription_expires_at.isoformat() if t.subscription_expires_at else None,
            "created_at": t.created_at.isoformat()
        })

    return success_response({
        "items": items,
        "next_cursor": next_cursor
    })


@super_admin_bp.route("/super-admin/tenants", methods=["POST"])
@require_role(["SuperAdmin"])
def create_tenant():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    admin_email = data.get("admin_email", "").strip()
    admin_password = data.get("admin_password", "").strip()
    plan_id = data.get("plan_id")

    if not name or not admin_email or not admin_password or not plan_id:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Parlour Name, Admin Email, Admin Password, and Plan ID are required.",
            status_code=400
        )

    # Check duplicate email
    if User.query.filter_by(email=admin_email).first():
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"User with email '{admin_email}' already exists.",
            status_code=400
        )

    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Selected subscription plan does not exist.",
            status_code=400
        )

    try:
        # 1. Create Tenant
        expiry_date = datetime.now(timezone.utc) + timedelta(days=plan.duration_days)
        tenant = Tenant(
            name=name,
            status="active",
            subscription_plan_id=plan.id,
            subscription_expires_at=expiry_date
        )
        db.session.add(tenant)
        db.session.flush()

        # 2. Create Tenant Admin User
        user = User(
            tenant_id=tenant.id,
            email=admin_email,
            role="ParlourAdmin",
            status="active"
        )
        user.set_password(admin_password)
        db.session.add(user)

        # 3. Initialize Tenant Settings
        setting = TenantSetting(
            tenant_id=tenant.id,
            tax_name="GST",
            tax_rate=18.00,
            currency="INR",
            currency_symbol="₹"
        )
        db.session.add(setting)

        # Log action
        log = AuditLog(
            tenant_id=tenant.id,
            user_id=g.user_id,
            action="TENANT_PROVISIONED",
            resource_name="Tenant",
            resource_id=tenant.id,
            details=f"Provisioned Beauty Parlour: '{name}' with Admin: '{admin_email}'"
        )
        db.session.add(log)

        db.session.commit()

        # Seed predefined beauty categories (Hair Care, Skin Care, Nail Care, Grooming Services)
        from app.routes.services import ensure_tenant_categories
        ensure_tenant_categories(tenant.id)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to provision tenant: {str(e)}")
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to provision new tenant.",
            status_code=500
        )

    return success_response({"tenant_id": tenant.id, "name": tenant.name}, 201)


@super_admin_bp.route("/super-admin/tenants/<int:tenant_id>", methods=["PUT"])
@require_role(["SuperAdmin"])
def update_tenant(tenant_id):
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return error_response(
            error_code="TENANT_NOT_FOUND",
            message="Tenant not found.",
            status_code=404
        )

    data = request.get_json() or {}
    status = data.get("status")
    plan_id = data.get("plan_id")

    try:
        if status in ["active", "suspended", "closed"]:
            tenant.status = status

        if plan_id:
            plan = SubscriptionPlan.query.get(plan_id)
            if plan:
                tenant.subscription_plan_id = plan.id
                tenant.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=plan.duration_days)

        log = AuditLog(
            tenant_id=tenant.id,
            user_id=g.user_id,
            action="TENANT_UPDATED",
            resource_name="Tenant",
            resource_id=tenant.id,
            details=f"Updated Tenant ID {tenant.id} Status: {tenant.status}"
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update tenant: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update tenant.",
            status_code=500
        )

    return success_response({"message": "Tenant updated successfully."})


@super_admin_bp.route("/super-admin/subscription-plans", methods=["GET"])
@require_role(["SuperAdmin"])
def get_subscription_plans():
    plans = SubscriptionPlan.query.all()
    data = [
        {
            "id": p.id,
            "name": p.name,
            "price": float(p.price),
            "duration_days": p.duration_days,
            "max_employees": p.max_employees,
            "max_services": p.max_services,
            "max_customers": p.max_customers,
            "max_branches": p.max_branches
        } for p in plans
    ]
    logger.info(f"Returning {len(data)} plans with max_branches values")
    return success_response(data)


@super_admin_bp.route("/super-admin/system-health", methods=["GET"])
@require_role(["SuperAdmin"])
def get_system_health():
    # Test DB Connection
    db_healthy = True
    try:
        db.session.execute(db.select(1))
    except Exception:
        db_healthy = False

    return success_response({
        "status": "healthy" if db_healthy else "unhealthy",
        "database_status": "connected" if db_healthy else "disconnected",
        "api_gateway": "operational",
        "active_tenant_sessions": Tenant.query.filter_by(status="active").count(),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


@super_admin_bp.route("/super-admin/audit-logs", methods=["GET"])
@require_role(["SuperAdmin"])
def get_audit_logs():
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(20).all()
    data = [
        {
            "id": l.id,
            "action": l.action,
            "details": l.details,
            "ip_address": getattr(l, "ip_address", "127.0.0.1"),
            "created_at": l.created_at.isoformat()
        } for l in logs
    ]
    return success_response(data)


@super_admin_bp.route("/super-admin/branches", methods=["GET"])
@require_role(["SuperAdmin"])
def get_all_branches():
    """Get all branches across the platform for Super Admin"""
    q = request.args.get("q", "").strip()
    status = request.args.get("status", "").strip()
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")

    query = Branch.query.join(Tenant, Branch.tenant_id == Tenant.id)

    if q:
        query = query.filter(Branch.name.ilike(f"%{q}%") | Tenant.name.ilike(f"%{q}%"))

    if status:
        query = query.filter(Branch.status == status)

    branches, next_cursor = paginate_query(
        query=query,
        model=Branch,
        limit_val=limit,
        cursor=cursor,
        sort_field="id",
        sort_desc=True
    )

    items = []
    for b in branches:
        # Find branch admin
        branch_admin = User.query.filter_by(branch_id=b.id, role="BranchAdmin").first()
        # Count branch-specific data
        branch_customers = Customer.query.filter_by(branch_id=b.id).count()
        branch_employees = Employee.query.filter_by(branch_id=b.id).count()
        
        items.append({
            "id": b.id,
            "name": b.name,
            "parlour_name": b.tenant.name if b.tenant else "N/A",
            "parlour_id": b.tenant_id,
            "branch_admin": branch_admin.email if branch_admin else "Not Assigned",
            "status": b.status,
            "customers_count": branch_customers,
            "employees_count": branch_employees,
            "address": b.address,
            "phone": b.phone,
            "created_at": b.created_at.isoformat()
        })

    return success_response({
        "items": items,
        "next_cursor": next_cursor
    })


@super_admin_bp.route("/super-admin/tenants/<int:tenant_id>/details", methods=["GET"])
@require_role(["SuperAdmin"])
def get_tenant_details(tenant_id):
    """Get detailed overview of a specific tenant"""
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return error_response(
            error_code="TENANT_NOT_FOUND",
            message="Tenant not found.",
            status_code=404
        )

    # Find admin user
    admin_user = User.query.filter_by(tenant_id=tenant.id, role="ParlourAdmin").first()
    
    # Count branch-specific data
    branches = Branch.query.filter_by(tenant_id=tenant.id).all()
    customers = Customer.query.filter_by(tenant_id=tenant.id).count()
    employees = Employee.query.filter_by(tenant_id=tenant.id).count()
    invoices = Invoice.query.filter_by(tenant_id=tenant.id).count()
    appointments = Appointment.query.filter_by(tenant_id=tenant.id).count()
    
    # Get tenant settings
    settings = TenantSetting.query.filter_by(tenant_id=tenant.id).first()

    return success_response({
        "parlour": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "status": tenant.status,
            "created_at": tenant.created_at.isoformat()
        },
        "owner": {
            "email": admin_user.email if admin_user else "N/A",
            "owner_name": settings.owner_name if settings else "N/A",
            "phone": settings.alternate_phone if settings else "N/A",
            "address": settings.address if settings else "N/A",
            "city": settings.city if settings else "N/A",
            "state": settings.state if settings else "N/A"
        },
        "subscription": {
            "plan_name": tenant.subscription_plan.name if tenant.subscription_plan else "N/A",
            "status": "active" if tenant.subscription_expires_at and tenant.subscription_expires_at > datetime.now(timezone.utc) else "expired",
            "start_date": tenant.created_at.isoformat(),
            "expiry_date": tenant.subscription_expires_at.isoformat() if tenant.subscription_expires_at else None,
            "max_branches": tenant.subscription_plan.max_branches if tenant.subscription_plan else 0,
            "current_branches": len(branches)
        },
        "usage": {
            "customers": customers,
            "employees": employees,
            "services": tenant.subscription_plan.max_services if tenant.subscription_plan else 0,
            "invoices": invoices,
            "appointments": appointments,
            "branches": len(branches)
        },
        "branches": [
            {
                "id": b.id,
                "name": b.name,
                "status": b.status,
                "address": b.address,
                "phone": b.phone
            } for b in branches
        ]
    })


@super_admin_bp.route("/super-admin/subscription-plans", methods=["POST"])
@require_role(["SuperAdmin"])
def create_subscription_plan():
    """Create a new subscription plan"""
    data = request.get_json() or {}
    
    name = data.get("name", "").strip()
    price = data.get("price")
    duration_days = data.get("duration_days")
    max_employees = data.get("max_employees", 5)
    max_services = data.get("max_services", 20)
    max_customers = data.get("max_customers", 100)
    max_branches = data.get("max_branches", 3)

    if not name or price is None or not duration_days:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Plan name, price, and duration_days are required.",
            status_code=400
        )

    try:
        plan = SubscriptionPlan(
            name=name,
            price=price,
            duration_days=duration_days,
            max_employees=max_employees,
            max_services=max_services,
            max_customers=max_customers,
            max_branches=max_branches
        )
        db.session.add(plan)
        db.session.commit()

        log = AuditLog(
            tenant_id=None,
            user_id=g.user_id,
            action="PLAN_CREATED",
            resource_name="SubscriptionPlan",
            resource_id=plan.id,
            details=f"Created subscription plan: '{name}'"
        )
        db.session.add(log)
        db.session.commit()

        return success_response({"plan_id": plan.id, "name": plan.name}, 201)
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create subscription plan: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to create subscription plan.",
            status_code=500
        )


@super_admin_bp.route("/super-admin/subscription-plans/<int:plan_id>", methods=["PUT"])
@require_role(["SuperAdmin"])
def update_subscription_plan(plan_id):
    """Update an existing subscription plan"""
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Subscription plan not found.",
            status_code=404
        )

    data = request.get_json() or {}
    
    try:
        if "name" in data:
            plan.name = data["name"]
        if "price" in data:
            plan.price = data["price"]
        if "duration_days" in data:
            plan.duration_days = data["duration_days"]
        if "max_employees" in data:
            plan.max_employees = data["max_employees"]
        if "max_services" in data:
            plan.max_services = data["max_services"]
        if "max_customers" in data:
            plan.max_customers = data["max_customers"]
        if "max_branches" in data:
            plan.max_branches = data["max_branches"]

        db.session.commit()

        log = AuditLog(
            tenant_id=None,
            user_id=g.user_id,
            action="PLAN_UPDATED",
            resource_name="SubscriptionPlan",
            resource_id=plan.id,
            details=f"Updated subscription plan: '{plan.name}'"
        )
        db.session.add(log)
        db.session.commit()

        return success_response({"message": "Subscription plan updated successfully."})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update subscription plan: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update subscription plan.",
            status_code=500
        )


@super_admin_bp.route("/super-admin/subscription-plans/<int:plan_id>", methods=["DELETE"])
@require_role(["SuperAdmin"])
def delete_subscription_plan(plan_id):
    """Delete a subscription plan"""
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Subscription plan not found.",
            status_code=404
        )

    # Check if plan is in use
    tenants_using_plan = Tenant.query.filter_by(subscription_plan_id=plan_id).count()
    if tenants_using_plan > 0:
        return error_response(
            error_code="PLAN_IN_USE",
            message=f"Cannot delete plan: {tenants_using_plan} tenant(s) are using this plan.",
            status_code=400
        )

    try:
        db.session.delete(plan)
        db.session.commit()

        log = AuditLog(
            tenant_id=None,
            user_id=g.user_id,
            action="PLAN_DELETED",
            resource_name="SubscriptionPlan",
            resource_id=plan_id,
            details=f"Deleted subscription plan: '{plan.name}'"
        )
        db.session.add(log)
        db.session.commit()

        return success_response({"message": "Subscription plan deleted successfully."})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete subscription plan: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete subscription plan.",
            status_code=500
        )


@super_admin_bp.route("/super-admin/users", methods=["GET"])
@require_role(["SuperAdmin"])
def get_all_users():
    """Get all users across the platform with role filtering"""
    role_filter = request.args.get("role", "").strip()
    limit = request.args.get("limit", 50)
    cursor = request.args.get("cursor")

    query = User.query.join(Tenant, User.tenant_id == Tenant.id, isouter=True)

    if role_filter:
        query = query.filter(User.role == role_filter)

    users, next_cursor = paginate_query(
        query=query,
        model=User,
        limit_val=limit,
        cursor=cursor,
        sort_field="id",
        sort_desc=True
    )

    items = []
    for u in users:
        items.append({
            "id": u.id,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "parlour_name": u.tenant.name if u.tenant else "N/A",
            "parlour_id": u.tenant_id,
            "branch_name": u.branch.name if u.branch else "N/A",
            "branch_id": u.branch_id,
            "created_at": u.created_at.isoformat()
        })

    return success_response({
        "items": items,
        "next_cursor": next_cursor
    })


@super_admin_bp.route("/super-admin/analytics", methods=["GET"])
@require_role(["SuperAdmin"])
def get_platform_analytics():
    """Get detailed platform analytics"""
    # Time-based analytics
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    # New parlours in last 30 days
    new_parlours = Tenant.query.filter(Tenant.created_at >= thirty_days_ago).count()
    
    # Subscription distribution
    subscription_distribution = db.session.query(
        SubscriptionPlan.name,
        func.count(Tenant.id).label('count')
    ).join(Tenant, Tenant.subscription_plan_id == SubscriptionPlan.id).group_by(SubscriptionPlan.name).all()
    
    # Branch growth
    total_branches = Branch.query.count()
    new_branches = Branch.query.filter(Branch.created_at >= thirty_days_ago).count()
    
    # Customer growth
    total_customers = Customer.query.count()
    new_customers = Customer.query.filter(Customer.created_at >= thirty_days_ago).count()
    
    # Revenue overview (from invoices)
    try:
        paid_invoices = Invoice.query.filter(Invoice.status == "paid").all()
        total_revenue = 0.0
        for invoice in paid_invoices:
            total_revenue += float(getattr(invoice, 'total', 0) or 0)
    except Exception as e:
        logger.error(f"Error calculating revenue: {e}")
        paid_invoices = []
        total_revenue = 0.0
    
    return success_response({
        "new_parlours_30_days": new_parlours,
        "subscription_distribution": [
            {"plan": row[0], "count": row[1]} for row in subscription_distribution
        ],
        "branch_growth": {
            "total": total_branches,
            "new_30_days": new_branches
        },
        "customer_growth": {
            "total": total_customers,
            "new_30_days": new_customers
        },
        "revenue_overview": {
            "total_revenue": total_revenue,
            "total_paid_invoices": len(paid_invoices)
        }
    })


@super_admin_bp.route("/super-admin/settings", methods=["GET"])
@require_role(["SuperAdmin"])
def get_platform_settings():
    """Get platform-level settings"""
    # For now, return basic platform info. This can be extended with a PlatformSettings model.
    return success_response({
        "platform_name": "SmartGoNext Beauty SaaS",
        "platform_version": "1.0.0",
        "default_subscription_plan_id": 1,  # Can be made configurable
        "contact_email": "support@smartgonext.com",
        "support_phone": "+91-XXXXXXXXXX"
    })


@super_admin_bp.route("/super-admin/settings", methods=["PUT"])
@require_role(["SuperAdmin"])
def update_platform_settings():
    """Update platform-level settings"""
    data = request.get_json() or {}
    
    # For now, this is a placeholder. In future, can be extended with a PlatformSettings model.
    # Store settings in a dedicated platform_settings table or use environment variables.
    
    log = AuditLog(
        tenant_id=None,
        user_id=g.user_id,
        action="PLATFORM_SETTINGS_UPDATED",
        resource_name="PlatformSettings",
        resource_id=None,
        details=f"Updated platform settings: {str(data)}"
    )
    db.session.add(log)
    db.session.commit()
    
    return success_response({"message": "Platform settings updated successfully."})
