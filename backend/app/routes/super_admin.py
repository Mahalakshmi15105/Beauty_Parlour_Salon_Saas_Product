from flask import Blueprint, request, g, current_app
from sqlalchemy import func, create_engine, text
from app.database import db
from app.models.global_models import Tenant, SubscriptionPlan, TenantLookup, MasterUser, PlatformSetting
from app.models.whatsapp import WhatsAppSetting
from app.db_bootstrap import ensure_database_exists
from app.models.user import User, TenantSetting
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.billing import Invoice
from app.models.appointment import Appointment
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
    g.use_master_db = True
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
            try:
                t_engine = create_engine(t.db_connection_uri)
                with t_engine.connect() as conn:
                    total_customers += (conn.execute(text("SELECT COUNT(*) FROM customers WHERE is_deleted = 0;")).scalar() or 0)
                    total_employees += (conn.execute(text("SELECT COUNT(*) FROM employees WHERE is_deleted = 0;")).scalar() or 0)
                    total_invoices += (conn.execute(text("SELECT COUNT(*) FROM invoices;")).scalar() or 0)
            except Exception as e:
                logger.warning(f"Error reading metrics for tenant {t.id}: {e}")

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
    g.use_master_db = True
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
        lookup = TenantLookup.query.filter_by(tenant_id=t.id).first()
        admin_email = lookup.email if lookup else "N/A"
        items.append({
            "id": t.id,
            "name": t.name,
            "status": t.status,
            "admin_email": admin_email,
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

    g.use_master_db = True
    # Check duplicate email in TenantLookup
    existing_lookup = TenantLookup.query.filter_by(email=admin_email).first()
    if existing_lookup:
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
        # 1. Create Tenant in Master DB
        expiry_date = datetime.now(timezone.utc) + timedelta(days=plan.duration_days)
        tenant = Tenant(
            name=name,
            status="active",
            subscription_plan_id=plan.id,
            subscription_expires_at=expiry_date
        )
        db.session.add(tenant)
        db.session.flush()

        tenant_id = tenant.id
        tenant_name = tenant.name
        import re
        base_uri = current_app.config.get("MYSQL_BASE_URI")
        if not base_uri:
            main_db_uri = current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
            m = re.match(r"^(mysql\+[a-z0-9]+://[^/]+/).*", main_db_uri)
            if m:
                base_uri = m.group(1)
            else:
                base_uri = "mysql+pymysql://root:root@localhost:3306/"

        slug_clean = tenant.slug.replace('-', '_')
        cpanel_user = current_app.config.get("CPANEL_USERNAME", "")
        if cpanel_user and not slug_clean.startswith(f"{cpanel_user}_"):
            db_name = f"{cpanel_user}_tenant_{slug_clean}_{tenant_id}"
        else:
            db_name = f"tenant_{slug_clean}_{tenant_id}"

        tenant_db_uri = f"{base_uri}{db_name}?charset=utf8mb4"
        tenant.db_name = db_name
        tenant.db_connection_uri = tenant_db_uri

        lookup = TenantLookup(
            email=admin_email,
            tenant_id=tenant_id,
            db_name=db_name,
            db_connection_uri=tenant_db_uri
        )
        db.session.add(lookup)
        db.session.commit()

        # 2. Create physical MySQL DB (via cPanel API if enabled) and provision tenant_metadata tables
        try:
            from app.services.cpanel_service import cpanel_service
            if cpanel_service.is_configured():
                m_user = re.search(r"//([^:@]+)", base_uri)
                db_user = m_user.group(1) if m_user else None
                cpanel_service.create_database(db_name, db_user)
        except Exception as cp_err:
            logger.warning(f"Notice invoking cPanel API during tenant creation: {cp_err}")

        ensure_database_exists(tenant_db_uri)
        from app.database import tenant_metadata
        tenant_engine = create_engine(tenant_db_uri)
        tenant_metadata.create_all(bind=tenant_engine)

        # 3. Switch context to new Tenant DB & seed initial user + settings
        db.session.remove()
        g.use_master_db = False
        g.tenant_db_uri = tenant_db_uri

        user = User(
            tenant_id=tenant_id,
            email=admin_email,
            role="ParlourAdmin",
            status="active"
        )
        user.set_password(admin_password)
        db.session.add(user)

        setting = TenantSetting(
            tenant_id=tenant_id,
            tax_name="GST",
            tax_rate=18.00,
            currency="INR",
            currency_symbol="₹"
        )
        db.session.add(setting)

        # Seed primary default Branch for tenant
        main_branch = Branch(
            tenant_id=tenant_id,
            name=f"{tenant_name} (Main Branch)",
            is_main_branch=True,
            opening_time="09:00",
            closing_time="20:00",
            status="active"
        )
        db.session.add(main_branch)

        log = AuditLog(
            tenant_id=tenant_id,
            user_id=user.id,
            action="TENANT_PROVISIONED",
            resource_name="Tenant",
            resource_id=tenant_id,
            details=f"Provisioned Beauty Parlour: '{tenant_name}' with Admin: '{admin_email}'"
        )
        db.session.add(log)

        db.session.commit()

        # Seed predefined beauty categories
        from app.routes.services import ensure_tenant_categories
        ensure_tenant_categories(tenant_id)

        return success_response({
            "id": tenant_id,
            "name": tenant_name,
            "db_name": db_name,
            "admin_email": admin_email,
            "message": "New tenant provisioned successfully."
        })
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
    g.use_master_db = True
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return error_response(
            error_code="TENANT_NOT_FOUND",
            message="Tenant not found.",
            status_code=404
        )

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    admin_email = data.get("admin_email", "").strip().lower()
    new_password = data.get("new_password", "").strip()
    status = data.get("status")
    plan_id = data.get("plan_id")

    try:
        if name:
            tenant.name = name

        if status in ["active", "suspended", "closed"]:
            tenant.status = status

        if plan_id:
            plan = SubscriptionPlan.query.get(plan_id)
            if plan:
                tenant.subscription_plan_id = plan.id
                tenant.subscription_expires_at = datetime.now(timezone.utc) + timedelta(days=plan.duration_days)

        lookup = TenantLookup.query.filter_by(tenant_id=tenant.id).first()
        if admin_email:
            existing_lookup = TenantLookup.query.filter(TenantLookup.email == admin_email, TenantLookup.tenant_id != tenant.id).first()
            if existing_lookup:
                return error_response("DUPLICATE_RECORD", f"Email '{admin_email}' is already in use by another parlour.", 400)
            
            if lookup:
                lookup.email = admin_email
            else:
                lookup = TenantLookup(
                    email=admin_email,
                    tenant_id=tenant.id,
                    db_name=tenant.db_name,
                    db_connection_uri=tenant.db_connection_uri
                )
                db.session.add(lookup)

        db.session.commit()

        # Update user credentials in Tenant DB if email or new_password supplied
        if tenant.db_connection_uri and (admin_email or new_password):
            master_uri = current_app.config.get("MASTER_DATABASE_URI") or current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
            from app.db_bootstrap import sanitize_tenant_uri
            tenant_db_uri = sanitize_tenant_uri(tenant.db_connection_uri, master_uri)
            try:
                from werkzeug.security import generate_password_hash
                t_engine = create_engine(tenant_db_uri)
                with t_engine.connect() as conn:
                    res_u = conn.execute(text("SELECT id FROM users WHERE role = 'ParlourAdmin' LIMIT 1;")).first()
                    if res_u:
                        user_id = res_u[0]
                        if admin_email and new_password:
                            p_hash = generate_password_hash(new_password)
                            conn.execute(text("UPDATE users SET email = :email, password_hash = :hash WHERE id = :id"), {"email": admin_email, "hash": p_hash, "id": user_id})
                        elif admin_email:
                            conn.execute(text("UPDATE users SET email = :email WHERE id = :id"), {"email": admin_email, "id": user_id})
                        elif new_password:
                            p_hash = generate_password_hash(new_password)
                            conn.execute(text("UPDATE users SET password_hash = :hash WHERE id = :id"), {"hash": p_hash, "id": user_id})
                        conn.commit()
                    else:
                        target_email = admin_email or "admin@smartgonext.com"
                        p_hash = generate_password_hash(new_password or "ParlourAdmin123!")
                        conn.execute(text("INSERT INTO users (tenant_id, email, password_hash, role, status, created_at, updated_at) VALUES (:t_id, :email, :hash, 'ParlourAdmin', 'active', NOW(), NOW())"), {"t_id": tenant.id, "email": target_email, "hash": p_hash})
                        conn.commit()
            except Exception as t_err:
                logger.warning(f"Notice updating tenant DB user credentials: {t_err}")

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update tenant: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message=f"Failed to update tenant: {str(e)}",
            status_code=500
        )

    return success_response({"message": "Tenant details & credentials updated successfully."})


@super_admin_bp.route("/super-admin/subscription-plans", methods=["GET"])
@require_role(["SuperAdmin"])
def get_subscription_plans():
    g.use_master_db = True
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
    g.use_master_db = True
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
    g.use_master_db = True
    tenants = Tenant.query.filter_by(status="active").limit(5).all()
    
    items = []
    for t in tenants:
        if not t.db_connection_uri:
            continue
        try:
            t_engine = create_engine(t.db_connection_uri)
            with t_engine.connect() as conn:
                res = conn.execute(text("SELECT id, action, details, created_at FROM audit_logs ORDER BY id DESC LIMIT 5;"))
                for row in res.fetchall():
                    items.append({
                        "id": f"t{t.id}_{row[0]}",
                        "action": row[1],
                        "details": f"[{t.name}] {row[2]}",
                        "ip_address": "127.0.0.1",
                        "created_at": row[3].isoformat() if row[3] else None
                    })
        except Exception as e:
            logger.warning(f"Could not fetch audit logs for tenant {t.id}: {e}")

    return success_response(items)


@super_admin_bp.route("/super-admin/branches", methods=["GET"])
@require_role(["SuperAdmin"])
def get_all_branches():
    """Get all branches across platform tenants for Super Admin"""
    g.use_master_db = True
    tenants = Tenant.query.filter_by(status="active").all()
    
    items = []
    for t in tenants:
        if not t.db_connection_uri:
            continue
        try:
            t_engine = create_engine(t.db_connection_uri)
            with t_engine.connect() as conn:
                res = conn.execute(text("SELECT id, name, address, phone, status, created_at FROM branches WHERE is_deleted = 0;"))
                for row in res.fetchall():
                    items.append({
                        "id": row[0],
                        "name": row[1],
                        "parlour_name": t.name,
                        "parlour_id": t.id,
                        "branch_admin": "Branch Admin",
                        "status": row[4] or "active",
                        "customers_count": 0,
                        "employees_count": 0,
                        "address": row[2] or "",
                        "phone": row[3] or "",
                        "created_at": row[5].isoformat() if row[5] else None
                    })
        except Exception as e:
            logger.warning(f"Could not fetch branches for tenant {t.id}: {e}")

    return success_response({
        "items": items,
        "next_cursor": None
    })


@super_admin_bp.route("/super-admin/tenants/<int:tenant_id>/details", methods=["GET"])
@require_role(["SuperAdmin"])
def get_tenant_details(tenant_id):
    """Get detailed overview of a specific tenant"""
    g.use_master_db = True
    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return error_response(
            error_code="TENANT_NOT_FOUND",
            message="Tenant not found.",
            status_code=404
        )

    admin_email = None
    lookup = TenantLookup.query.filter_by(tenant_id=tenant.id).first()
    if lookup:
        admin_email = lookup.email

    branches_count = 0
    customers_count = 0
    employees_count = 0
    invoices_count = 0
    appointments_count = 0
    owner_name = "N/A"
    phone = "N/A"
    address = "N/A"
    city = "N/A"
    state = "N/A"
    branches_list = []

    # Connect directly to Tenant DB to query tenant-level tables safely
    if tenant.db_connection_uri:
        master_uri = current_app.config.get("MASTER_DATABASE_URI") or current_app.config.get("SQLALCHEMY_DATABASE_URI", "")
        from app.db_bootstrap import sanitize_tenant_uri
        tenant_db_uri = sanitize_tenant_uri(tenant.db_connection_uri, master_uri)
        try:
            t_engine = create_engine(tenant_db_uri)
            with t_engine.connect() as conn:
                if not admin_email:
                    res_u = conn.execute(text("SELECT email FROM users WHERE role = 'ParlourAdmin' LIMIT 1;")).first()
                    if res_u:
                        admin_email = res_u[0]
                
                res_s = conn.execute(text("SELECT owner_name, alternate_phone, address, city, state FROM tenant_settings LIMIT 1;")).first()
                if res_s:
                    owner_name = res_s[0] or "N/A"
                    phone = res_s[1] or "N/A"
                    address = res_s[2] or "N/A"
                    city = res_s[3] or "N/A"
                    state = res_s[4] or "N/A"

                res_c = conn.execute(text("SELECT COUNT(*) FROM customers WHERE is_deleted = 0;")).first()
                customers_count = res_c[0] if res_c else 0

                res_e = conn.execute(text("SELECT COUNT(*) FROM employees WHERE is_deleted = 0;")).first()
                employees_count = res_e[0] if res_e else 0

                res_i = conn.execute(text("SELECT COUNT(*) FROM invoices WHERE is_deleted = 0;")).first()
                invoices_count = res_i[0] if res_i else 0

                res_a = conn.execute(text("SELECT COUNT(*) FROM appointments WHERE is_deleted = 0;")).first()
                appointments_count = res_a[0] if res_a else 0

                res_b = conn.execute(text("SELECT id, name, status, address, phone FROM branches WHERE is_deleted = 0;")).fetchall()
                branches_count = len(res_b)
                for b in res_b:
                    branches_list.append({
                        "id": b[0],
                        "name": b[1],
                        "status": b[2] or "active",
                        "address": b[3] or "",
                        "phone": b[4] or ""
                    })
        except Exception as e:
            logger.warning(f"Could not fetch details from tenant DB {tenant.id}: {e}")

    return success_response({
        "parlour": {
            "id": tenant.id,
            "name": tenant.name,
            "slug": tenant.slug,
            "status": tenant.status,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None
        },
        "owner": {
            "email": admin_email or "admin@smartgonext.com",
            "owner_name": owner_name,
            "phone": phone,
            "address": address,
            "city": city,
            "state": state
        },
        "subscription": {
            "plan_name": tenant.subscription_plan.name if tenant.subscription_plan else "Standard Business Plan",
            "status": "active" if tenant.subscription_expires_at and tenant.subscription_expires_at > datetime.now(timezone.utc) else "active",
            "start_date": tenant.created_at.isoformat() if tenant.created_at else None,
            "expiry_date": tenant.subscription_expires_at.isoformat() if tenant.subscription_expires_at else None,
            "max_branches": tenant.subscription_plan.max_branches if tenant.subscription_plan else 3,
            "current_branches": branches_count
        },
        "usage": {
            "customers": customers_count,
            "employees": employees_count,
            "services": tenant.subscription_plan.max_services if tenant.subscription_plan else 50,
            "invoices": invoices_count,
            "appointments": appointments_count,
            "branches": branches_count
        },
        "branches": branches_list
    })


@super_admin_bp.route("/super-admin/subscription-plans", methods=["POST"])
@require_role(["SuperAdmin"])
def create_subscription_plan():
    """Create a new subscription plan"""
    g.use_master_db = True
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
    g.use_master_db = True
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
    g.use_master_db = True
    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        return error_response(
            error_code="PLAN_NOT_FOUND",
            message="Subscription plan not found.",
            status_code=404
        )

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
    """Get all users across the platform"""
    g.use_master_db = True
    master_users = MasterUser.query.all()
    lookups = TenantLookup.query.all()
    
    tenants = Tenant.query.all()
    tenant_map = {t.id: t.name for t in tenants}

    items = []
    for mu in master_users:
        items.append({
            "id": mu.id,
            "email": mu.email,
            "role": mu.role,
            "status": mu.status,
            "parlour_name": "Super Admin System",
            "parlour_id": None,
            "branch_name": "N/A",
            "branch_id": None,
            "created_at": mu.created_at.isoformat() if mu.created_at else None
        })

    for l in lookups:
        items.append({
            "id": f"t_{l.tenant_id}",
            "email": l.email,
            "role": "ParlourAdmin",
            "status": "active",
            "parlour_name": tenant_map.get(l.tenant_id, f"Parlour {l.tenant_id}"),
            "parlour_id": l.tenant_id,
            "branch_name": "Main Branch",
            "branch_id": None,
            "created_at": l.created_at.isoformat() if hasattr(l, 'created_at') and l.created_at else None
        })

    return success_response({
        "items": items,
        "next_cursor": None
    })


@super_admin_bp.route("/super-admin/analytics", methods=["GET"])
@require_role(["SuperAdmin"])
def get_platform_analytics():
    """Get detailed platform analytics"""
    g.use_master_db = True
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    
    new_parlours = Tenant.query.filter(Tenant.created_at >= thirty_days_ago).count()
    
    subscription_distribution = db.session.query(
        SubscriptionPlan.name,
        func.count(Tenant.id).label('count')
    ).join(Tenant, Tenant.subscription_plan_id == SubscriptionPlan.id).group_by(SubscriptionPlan.name).all()
    
    total_branches = 0
    total_customers = 0
    total_revenue = 0.0
    total_paid_invoices = 0

    tenants = Tenant.query.filter_by(status="active").all()
    for t in tenants:
        if not t.db_connection_uri:
            continue
        try:
            t_engine = create_engine(t.db_connection_uri)
            with t_engine.connect() as conn:
                b_cnt = conn.execute(text("SELECT COUNT(*) FROM branches WHERE is_deleted = 0;")).scalar() or 0
                c_cnt = conn.execute(text("SELECT COUNT(*) FROM customers WHERE is_deleted = 0;")).scalar() or 0
                inv_row = conn.execute(text("SELECT COUNT(*), COALESCE(SUM(total), 0) FROM invoices WHERE status = 'paid';")).fetchone()
                
                total_branches += b_cnt
                total_customers += c_cnt
                if inv_row:
                    total_paid_invoices += (inv_row[0] or 0)
                    total_revenue += float(inv_row[1] or 0.0)
        except Exception as e:
            logger.warning(f"Error computing analytics for tenant {t.id}: {e}")

    return success_response({
        "new_parlours_30_days": new_parlours,
        "subscription_distribution": [
            {"plan": row[0], "count": row[1]} for row in subscription_distribution
        ],
        "branch_growth": {
            "total": total_branches,
            "new_30_days": 0
        },
        "customer_growth": {
            "total": total_customers,
            "new_30_days": 0
        },
        "revenue_overview": {
            "total_revenue": total_revenue,
            "total_paid_invoices": total_paid_invoices
        }
    })


@super_admin_bp.route("/super-admin/settings", methods=["GET"])
@require_role(["SuperAdmin"])
def get_platform_settings():
    """Get platform-level settings including WhatsApp Meta Gateway credentials"""
    import os
    g.use_master_db = True
    
    try:
        settings_rows = PlatformSetting.query.all()
        settings_dict = {s.setting_key: s.setting_value for s in settings_rows}
    except Exception as e:
        logger.warning(f"Notice fetching PlatformSetting: {e}")
        settings_dict = {}

    meta_app_id = settings_dict.get("meta_app_id") or os.getenv("META_APP_ID", "")
    meta_app_secret = settings_dict.get("meta_app_secret") or os.getenv("META_APP_SECRET", "")
    meta_config_id = settings_dict.get("meta_config_id") or os.getenv("META_CONFIG_ID", "")
    meta_redirect_uri = settings_dict.get("meta_redirect_uri") or os.getenv("META_REDIRECT_URI", "https://www.smartgonext.com/settings")
    meta_graph_api_version = settings_dict.get("meta_graph_api_version") or os.getenv("META_GRAPH_API_VERSION", "v21.0")

    return success_response({
        "platform_name": settings_dict.get("platform_name", "SmartGoNext Beauty SaaS"),
        "platform_version": settings_dict.get("platform_version", "1.0.0"),
        "contact_email": settings_dict.get("contact_email", "support@smartgonext.com"),
        "support_phone": settings_dict.get("support_phone", "+91-XXXXXXXXXX"),
        "meta_app_id": meta_app_id,
        "meta_app_secret": meta_app_secret,
        "meta_config_id": meta_config_id,
        "meta_redirect_uri": meta_redirect_uri,
        "meta_graph_api_version": meta_graph_api_version
    })


@super_admin_bp.route("/super-admin/settings", methods=["PUT"])
@require_role(["SuperAdmin"])
def update_platform_settings():
    """Update platform-level settings including WhatsApp Meta Gateway credentials"""
    g.use_master_db = True
    data = request.get_json() or {}

    keys_to_update = [
        "platform_name", "contact_email", "support_phone",
        "meta_app_id", "meta_app_secret", "meta_config_id",
        "meta_redirect_uri", "meta_graph_api_version"
    ]

    for key in keys_to_update:
        if key in data:
            setting_obj = PlatformSetting.query.filter_by(setting_key=key).first()
            if not setting_obj:
                setting_obj = PlatformSetting(setting_key=key, setting_value=str(data[key]))
                db.session.add(setting_obj)
            else:
                setting_obj.setting_value = str(data[key])

    db.session.commit()

    return success_response({"message": "Platform settings updated successfully."})


@super_admin_bp.route("/super-admin/whatsapp-status", methods=["GET"])
@require_role(["SuperAdmin"])
def get_tenants_whatsapp_status():
    """Get WhatsApp Business Account connection status across all tenants"""
    g.use_master_db = True
    tenants = Tenant.query.all()
    statuses = []

    for t in tenants:
        t_uri = t.db_connection_uri or f"mysql+pymysql://root:root@localhost:3306/{t.db_name}?charset=utf8mb4"
        w_status = {
            "tenant_id": t.id,
            "tenant_name": t.name,
            "status": "DISCONNECTED",
            "business_name": "",
            "phone_number": "",
            "meta_waba_id": "",
            "connected_at": None
        }
        try:
            g.use_master_db = False
            g.tenant_db_uri = t_uri
            setting = WhatsAppSetting.query.filter_by(tenant_id=t.id).first()
            if setting and setting.status == "CONNECTED":
                w_status["status"] = "CONNECTED"
                w_status["business_name"] = setting.business_name or ""
                w_status["phone_number"] = setting.phone_number or ""
                w_status["meta_waba_id"] = setting.meta_waba_id or ""
                w_status["connected_at"] = setting.connected_at.isoformat() if setting.connected_at else None
        except Exception as e:
            logger.warning(f"Failed to check WhatsApp status for tenant {t.id}: {e}")

        statuses.append(w_status)

    g.use_master_db = True
    return success_response({"items": statuses})

