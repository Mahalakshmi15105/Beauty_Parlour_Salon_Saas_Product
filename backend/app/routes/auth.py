from flask import Blueprint, request, g
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token, 
    jwt_required, 
    get_jwt_identity,
    get_jwt
)
from app.models.user import User
from app.models.global_models import Tenant
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role
from datetime import timedelta

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/auth/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return error_response(
            error_code="INVALID_PAYLOAD",
            message="Email and password are required.",
            status_code=400
        )

    # Optimized single query with joined relationships
    user = User.query.filter_by(email=email.lower(), is_deleted=False).first()
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

    # Check tenant status if user is ParlourAdmin (optimized query)
    if user.role == "ParlourAdmin":
        tenant = Tenant.query.filter_by(id=user.tenant_id, is_deleted=False).first()
        if not tenant or tenant.status != "active":
            return error_response(
                error_code="TENANT_SUSPENDED",
                message="Your beauty parlour tenant account is inactive.",
                status_code=403
            )

    # Issue tokens
    additional_claims = {
        "parlour_id": user.tenant_id,
        "branch_id": user.branch_id,
        "role": user.role
    }
    
    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(hours=2))
    refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(days=7))

    return success_response({
        "token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 7200,
        "user": build_user_payload(user)
    })


def build_user_payload(user):
    owner_name = None
    parlour_name = None
    branch_name = None
    if user.tenant:
        parlour_name = user.tenant.name
        if user.tenant.settings and user.tenant.settings.owner_name:
            owner_name = user.tenant.settings.owner_name
    if user.branch:
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
        "branch_id": claims.get("branch_id"),
        "role": claims.get("role")
    }
    new_access_token = create_access_token(identity=identity, additional_claims=additional_claims, expires_delta=timedelta(hours=2))
    return success_response({
        "token": new_access_token,
        "expires_in": 7200
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
    return success_response(build_user_payload(user))


@auth_bp.route("/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    # In stateless JWT configuration, the frontend discards the token.
    # Return success response.
    return success_response({"message": "Successfully logged out."})


@auth_bp.route("/auth/register", methods=["POST"])
def register():
    from app.database import db
    from app.models.global_models import Tenant, SubscriptionPlan
    from app.models.user import TenantSetting
    from datetime import datetime, timedelta, timezone

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

    if User.query.filter_by(email=email).first():
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"An account with email '{email}' already exists.",
            status_code=400
        )

    plan = SubscriptionPlan.query.get(plan_id)
    if not plan:
        plan = SubscriptionPlan.query.first()

    try:
        # 1. Provision Tenant
        expiry_date = datetime.now(timezone.utc) + timedelta(days=plan.duration_days if plan else 30)
        tenant = Tenant(
            name=parlour_name,
            status="active",
            subscription_plan_id=plan.id if plan else 1,
            subscription_expires_at=expiry_date
        )
        db.session.add(tenant)
        db.session.flush()

        # 2. Provision Admin User
        user = User(
            tenant_id=tenant.id,
            email=email,
            role="ParlourAdmin",
            status="active"
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        # 3. Provision Tenant Setting
        setting = TenantSetting(
            tenant_id=tenant.id,
            owner_name=owner_name,
            alternate_phone=phone,
            tax_name="GST",
            tax_rate=18.00,
            currency="INR",
            currency_symbol="₹"
        )
        db.session.add(setting)
        db.session.commit()

        # Seed predefined beauty categories (Hair Care, Skin Care, Nail Care, Grooming Services)
        from app.routes.services import ensure_tenant_categories
        ensure_tenant_categories(tenant.id)

        # Issue JWT Access & Refresh Tokens for immediate login
        additional_claims = {
            "parlour_id": user.tenant_id,
            "branch_id": user.branch_id,
            "role": user.role
        }
        access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(hours=2))
        refresh_token = create_refresh_token(identity=str(user.id), additional_claims=additional_claims, expires_delta=timedelta(days=7))

        return success_response({
            "token": access_token,
            "refresh_token": refresh_token,
            "expires_in": 7200,
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "parlour_id": user.tenant_id,
                "branch_id": user.branch_id
            }
        }, 201)

    except Exception as e:
        db.session.rollback()
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to register parlour account.",
            status_code=500
        )

