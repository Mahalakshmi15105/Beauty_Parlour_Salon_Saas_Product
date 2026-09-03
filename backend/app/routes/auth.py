from flask import Blueprint, request, g, current_app
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token, 
    jwt_required, 
    get_jwt_identity,
    get_jwt
)
from sqlalchemy import text, create_engine
import re
from datetime import datetime, timedelta, timezone

from app.database import db, tenant_metadata, master_metadata
from app.models.user import User, TenantSetting
from app.models.global_models import Tenant, SubscriptionPlan, TenantLookup, MasterUser
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role

auth_bp = Blueprint("auth", __name__)

def sanitize_slug(name):
    s = re.sub(r'[^a-z0-9]+', '_', (name or "").lower()).strip('_')
    return s or "parlour"

@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()

    if not email or not password:
        return error_response(
            error_code="INVALID_PAYLOAD",
            message="Email and password are required.",
            status_code=400
        )

    # 1. Look up user's home tenant in Master DB
    g.use_master_db = True

    # Check if SuperAdmin in Master DB
    master_user = MasterUser.query.filter_by(email=email, is_deleted=False).first()
    if master_user and master_user.role == "SuperAdmin":
        if not master_user.check_password(password):
            return error_response("INVALID_CREDENTIALS", "Invalid email or password.", 401)
        if master_user.status != "active":
            return error_response("USER_SUSPENDED", "This user account is inactive.", 403)

        additional_claims = {
            "parlour_id": None,
            "tenant_db_uri": None,
            "branch_id": None,
            "role": "SuperAdmin"
        }
        access_token = create_access_token(identity=str(master_user.id), additional_claims=additional_claims, expires_delta=timedelta(days=30))
        refresh_token = create_refresh_token(identity=str(master_user.id), additional_claims=additional_claims, expires_delta=timedelta(days=90))

        return success_response({
            "token": access_token,
            "refresh_token": refresh_token,
            "expires_in": 2592000,
            "user": {
                "id": master_user.id,
                "first_name": "Super",
                "last_name": "Admin",
                "email": master_user.email,
                "role": "SuperAdmin",
                "tenant_id": None,
                "branch_id": None,
                "parlour_name": "Super Admin System"
            }
        })

    # Check tenant_lookups mapping in Master DB
    lookup = TenantLookup.query.filter_by(email=email).first()
    if not lookup:
        return error_response(
            error_code="INVALID_CREDENTIALS",
            message="Invalid email or password.",
            status_code=401
        )

    tenant = Tenant.query.filter_by(id=lookup.tenant_id, is_deleted=False).first()
    if not tenant or tenant.status != "active":
        return error_response(
            error_code="TENANT_SUSPENDED",
            message="Your beauty parlour tenant account is inactive or suspended.",
            status_code=403
        )

    tenant_db_uri = lookup.db_connection_uri or tenant.db_connection_uri

    # 2. Switch context to Tenant DB and verify credentials
    db.session.remove()
    g.use_master_db = False
    g.tenant_db_uri = tenant_db_uri

    user = User.query.filter_by(email=email, is_deleted=False).first()
    if not user or not user.check_password(password):
        return error_response(
            error_code="INVALID_CREDENTIALS",
            message="Invalid email or password.",
            status_code=401
        )

    if user.status != "active":
        return error_response(
            error_code="USER_SUSPENDED",
            message="This user account is inactive.",
            status_code=403
        )

    # Issue tokens with tenant_db_uri claim
    additional_claims = {
        "parlour_id": user.tenant_id or tenant.id,
        "tenant_db_uri": tenant_db_uri,
        "branch_id": user.branch_id,
        "role": user.role
    }
    
    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(days=30))
    refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(days=90))

    return success_response({
        "token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 2592000,
        "user": build_user_payload(user, tenant_name=tenant.name)
    })


def build_user_payload(user, tenant_name=None):
    owner_name = None
    parlour_name = tenant_name
    branch_name = None

    # Fetch owner_name from TenantSetting in tenant DB
    try:
        from app.models.user import TenantSetting
        setting = TenantSetting.query.first()
        if setting and setting.owner_name:
            owner_name = setting.owner_name
    except Exception:
        pass

    if hasattr(user, "branch") and user.branch:
        branch_name = user.branch.name

    if not owner_name:
        owner_name = user.email.split("@")[0].replace(".", " ").title()

    return {
        "id": user.id,
        "email": user.email,
        "role": user.role,
        "parlour_id": user.tenant_id,
        "branch_id": user.branch_id,
        "owner_name": owner_name,
        "parlour_name": parlour_name or "SmartGoNext Beauty Parlour",
        "branch_name": branch_name
    }


@auth_bp.route("/auth/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    claims = get_jwt()
    additional_claims = {
        "parlour_id": claims.get("parlour_id"),
        "tenant_db_uri": claims.get("tenant_db_uri"),
        "branch_id": claims.get("branch_id"),
        "role": claims.get("role")
    }
    new_access_token = create_access_token(identity=identity, additional_claims=additional_claims, expires_delta=timedelta(days=30))
    return success_response({
        "token": new_access_token,
        "expires_in": 2592000
    })


@auth_bp.route("/auth/me", methods=["GET"])
@require_role(["SuperAdmin", "ParlourAdmin", "BranchAdmin"])
def get_me():
    user = User.query.get(g.user_id)
    if not user:
        return error_response(
            error_code="USER_NOT_FOUND",
            message="User profile not found.",
            status_code=404
        )

    tenant_name = None
    if getattr(g, "parlour_id", None):
        g.use_master_db = True
        master_tenant = Tenant.query.get(g.parlour_id)
        if master_tenant:
            tenant_name = master_tenant.name
        g.use_master_db = False

    return success_response(build_user_payload(user, tenant_name=tenant_name))


@auth_bp.route("/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    return success_response({"message": "Successfully logged out."})


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    parlour_name = data.get("parlour_name", "").strip()
    owner_name = data.get("owner_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "").strip()
    phone = data.get("phone", "").strip()
    plan_id = data.get("plan_id", 1)

    if not parlour_name or not email or not password:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Parlour Name, Email, and Password are required.",
            status_code=400
        )

    # 1. Check if email already registered in Master DB
    g.use_master_db = True
    master_engine = db.get_master_engine()
    with master_engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM tenant_lookups WHERE email = :email LIMIT 1"),
            {"email": email}
        ).first()
        if existing:
            return error_response(
                error_code="DUPLICATE_RECORD",
                message=f"An account with email '{email}' already exists.",
                status_code=400
            )

    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        plan = SubscriptionPlan.query.first()

    # 2. Build tenant database details
    slug = sanitize_slug(parlour_name)
    timestamp = int(datetime.now(timezone.utc).timestamp())
    db_name = f"tenant_{slug}_{timestamp}"
    base_uri = current_app.config.get("MYSQL_BASE_URI", "mysql+pymysql://root:root@localhost:3306/")
    tenant_db_uri = f"{base_uri}{db_name}?charset=utf8mb4"

    try:
        # 3. Create physical MySQL database
        sys_engine = create_engine(base_uri)
        with sys_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as sys_conn:
            sys_conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))

        # 4. Build schema tables in target tenant database using tenant_metadata ONLY
        tenant_engine = create_engine(tenant_db_uri)
        tenant_metadata.create_all(bind=tenant_engine)

        # 5. Record Tenant & Lookup in Master DB
        g.use_master_db = True
        expiry_date = datetime.now(timezone.utc) + timedelta(days=plan.duration_days if plan else 30)
        tenant = Tenant(
            name=parlour_name,
            status="active",
            db_name=db_name,
            db_connection_uri=tenant_db_uri,
            subscription_plan_id=plan.id if plan else 1,
            subscription_expires_at=expiry_date
        )
        db.session.add(tenant)
        db.session.flush()

        lookup = TenantLookup(
            email=email,
            tenant_id=tenant.id,
            db_name=db_name,
            db_connection_uri=tenant_db_uri
        )
        db.session.add(lookup)
        db.session.commit()
        new_tenant_id = tenant.id

        # 6. Seed User & Settings into new Tenant DB
        db.session.remove()
        g.use_master_db = False
        g.tenant_db_uri = tenant_db_uri

        user = User(
            tenant_id=new_tenant_id,
            email=email,
            role="ParlourAdmin",
            status="active"
        )
        user.set_password(password)
        db.session.add(user)

        setting = TenantSetting(
            tenant_id=new_tenant_id,
            owner_name=owner_name,
            alternate_phone=phone,
            tax_name="GST",
            tax_rate=18.00,
            currency="INR",
            currency_symbol="₹"
        )
        db.session.add(setting)
        db.session.commit()

        # Seed categories in tenant DB
        from app.routes.services import ensure_tenant_categories
        ensure_tenant_categories(tenant.id)

        # Issue JWT Access & Refresh Tokens
        additional_claims = {
            "parlour_id": tenant.id,
            "tenant_db_uri": tenant_db_uri,
            "branch_id": None,
            "role": user.role
        }
        access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(days=30))
        refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(days=90))

        return success_response({
            "token": access_token,
            "refresh_token": refresh_token,
            "expires_in": 2592000,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "parlour_id": tenant.id,
                "branch_id": None
            }
        }, 201)

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Registration failed: {str(e)}", exc_info=True)
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to register parlour account.",
            status_code=500
        )


