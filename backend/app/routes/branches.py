from flask import Blueprint, request, g
from app.database import db
from app.models.branch import Branch
from app.models.global_models import Tenant, SubscriptionPlan
from app.models.user import User
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)
branches_bp = Blueprint("branches", __name__)

@branches_bp.route("/branches", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Employee", "Receptionist"])
def get_branches():
    """Get all branches for the current tenant"""
    branches = Branch.query.filter_by(tenant_id=g.parlour_id, is_deleted=False).order_by(Branch.is_main_branch.desc(), Branch.id.asc()).all()
    if not branches and getattr(g, "parlour_id", None):
        # Auto-seed default Main Branch if none exist
        default_b = Branch(
            tenant_id=g.parlour_id,
            name="Main Parlour (Main Branch)",
            is_main_branch=True,
            opening_time="09:00",
            closing_time="20:00",
            status="active"
        )
        db.session.add(default_b)
        db.session.commit()
        branches = [default_b]

    data = []
    for b in branches:
        is_main = bool(b.is_main_branch)
        data.append({
            "id": b.id,
            "name": b.name,
            "address": b.address,
            "phone": b.phone,
            "email": b.email,
            "opening_time": b.opening_time,
            "closing_time": b.closing_time,
            "status": b.status,
            "is_main_branch": is_main,
            "latitude": float(b.latitude) if b.latitude is not None else None,
            "longitude": float(b.longitude) if b.longitude is not None else None,
            "geofence_radius_meters": b.geofence_radius_meters or 100,
            "created_at": b.created_at.isoformat() if b.created_at else ""
        })
    return success_response(data)

@branches_bp.route("/branches", methods=["POST"])
@require_role(["ParlourAdmin"])
def create_branch():
    """Create a new branch for the current tenant"""
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    address = data.get("address", "").strip()
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip()
    opening_time = data.get("opening_time", "09:00")
    closing_time = data.get("closing_time", "20:00")
    admin_email = data.get("admin_email", "").strip()
    admin_password = data.get("admin_password", "").strip()

    if not name:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Branch name is required.",
            status_code=400
        )

    # Check branch limit
    max_branches = 3
    try:
        with db.get_master_engine().connect() as conn:
            from sqlalchemy import text
            res = conn.execute(text("""
                SELECT sp.max_branches 
                FROM tenants t 
                LEFT JOIN subscription_plans sp ON t.subscription_plan_id = sp.id 
                WHERE t.id = :id
            """), {"id": g.parlour_id}).fetchone()
            if res and res[0] is not None:
                max_branches = res[0]
    except Exception as err:
        logger.warning(f"Failed to fetch max_branches: {err}")
    current_branch_count = Branch.query.filter_by(tenant_id=g.parlour_id, is_deleted=False).count()

    if current_branch_count >= max_branches:
        return error_response(
            error_code="BRANCH_LIMIT_REACHED",
            message=f"Branch limit ({max_branches}) reached. Please upgrade your subscription to add more branches.",
            status_code=403
        )

    # Check for duplicate branch name
    existing_branch = Branch.query.filter_by(tenant_id=g.parlour_id, name=name, is_deleted=False).first()
    if existing_branch:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"Branch with name '{name}' already exists.",
            status_code=400
        )

    # Check if admin email provided and validate
    if admin_email:
        from app.models.global_models import TenantLookup
        was_master = getattr(g, "use_master_db", False)
        g.use_master_db = True
        existing_lookup = TenantLookup.query.filter_by(email=admin_email).first()
        g.use_master_db = was_master

        if existing_lookup or User.query.filter_by(email=admin_email).first():
            return error_response(
                error_code="DUPLICATE_RECORD",
                message=f"User with email '{admin_email}' already exists.",
                status_code=400
            )
        if not admin_password:
            return error_response(
                error_code="VALIDATION_FAILED",
                message="Admin password is required when admin email is provided.",
                status_code=400
            )

    try:
        lat = data.get("latitude")
        lng = data.get("longitude")
        radius = data.get("geofence_radius_meters")

        # Create branch
        logger.info(f"Creating branch with tenant_id={g.parlour_id}, name={name}")
        branch = Branch(
            tenant_id=g.parlour_id,
            name=name,
            address=address,
            phone=phone,
            email=email,
            opening_time=opening_time,
            closing_time=closing_time,
            status="active",
            latitude=float(lat) if lat not in (None, "") else None,
            longitude=float(lng) if lng not in (None, "") else None,
            geofence_radius_meters=int(radius) if radius not in (None, "") else 100
        )
        db.session.add(branch)
        logger.info("Branch added to session, flushing...")
        db.session.flush()
        logger.info(f"Branch flushed successfully with ID: {branch.id}")

        # Create BranchAdmin user if credentials provided
        branch_admin = None
        if admin_email and admin_password:
            logger.info(f"Creating BranchAdmin with email={admin_email}, branch_id={branch.id}")
            branch_admin = User(
                tenant_id=g.parlour_id,
                branch_id=branch.id,
                email=admin_email,
                role="BranchAdmin",
                status="active"
            )
            branch_admin.set_password(admin_password)
            db.session.add(branch_admin)
            db.session.flush()
            logger.info("BranchAdmin added to session")

            # Insert TenantLookup mapping into Master DB for auth login routing
            try:
                from sqlalchemy import text
                with db.get_master_engine().begin() as m_conn:
                    t_row = m_conn.execute(text("SELECT db_name, db_connection_uri FROM tenants WHERE id = :id"), {"id": g.parlour_id}).fetchone()
                    if t_row:
                        m_conn.execute(text("""
                            INSERT INTO tenant_lookups (tenant_id, email, db_name, db_connection_uri, created_at, updated_at) 
                            VALUES (:tenant_id, :email, :db_name, :db_connection_uri, NOW(), NOW())
                            ON DUPLICATE KEY UPDATE tenant_id = :tenant_id, db_name = :db_name, db_connection_uri = :db_connection_uri, updated_at = NOW()
                        """), {
                            "tenant_id": g.parlour_id,
                            "email": admin_email,
                            "db_name": t_row[0],
                            "db_connection_uri": t_row[1]
                        })
            except Exception as l_err:
                logger.error(f"Failed to insert TenantLookup for branch admin: {l_err}")

        logger.info("Committing transaction...")
        db.session.commit()
        logger.info("Transaction committed successfully")

        response_data = {
            "id": branch.id,
            "name": branch.name,
            "message": "Branch created successfully."
        }
        if branch_admin:
            response_data["branch_admin_id"] = branch_admin.id
            response_data["branch_admin_email"] = branch_admin.email

        return success_response(response_data, 201)

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create branch: {str(e)}")
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to create branch.",
            status_code=500
        )

@branches_bp.route("/branches/<int:branch_id>", methods=["PUT"])
@require_role(["ParlourAdmin"])
def update_branch(branch_id):
    """Update branch details"""
    branch = Branch.query.filter_by(id=branch_id, tenant_id=g.parlour_id, is_deleted=False).first()
    if not branch:
        return error_response(
            error_code="BRANCH_NOT_FOUND",
            message="Branch not found.",
            status_code=404
        )

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    address = data.get("address", "").strip()
    phone = data.get("phone", "").strip()
    email = data.get("email", "").strip()
    opening_time = data.get("opening_time")
    closing_time = data.get("closing_time")
    status = data.get("status")

    try:
        if name:
            # Check for duplicate name
            existing = Branch.query.filter_by(tenant_id=g.parlour_id, name=name, is_deleted=False).first()
            if existing and existing.id != branch_id:
                return error_response(
                    error_code="DUPLICATE_RECORD",
                    message=f"Branch with name '{name}' already exists.",
                    status_code=400
                )
            branch.name = name

        if address is not None:
            branch.address = address
        if phone is not None:
            branch.phone = phone
        if email is not None:
            branch.email = email
        if opening_time is not None:
            branch.opening_time = opening_time
        if closing_time is not None:
            branch.closing_time = closing_time
        if status in ["active", "inactive"]:
            branch.status = status

        if "latitude" in data:
            branch.latitude = float(data["latitude"]) if data["latitude"] not in (None, "") else None
        if "longitude" in data:
            branch.longitude = float(data["longitude"]) if data["longitude"] not in (None, "") else None
        if "geofence_radius_meters" in data:
            try:
                branch.geofence_radius_meters = int(data["geofence_radius_meters"])
            except (TypeError, ValueError):
                pass

        db.session.commit()
        return success_response({"message": "Branch updated successfully."})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update branch: {str(e)}")
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to update branch.",
            status_code=500
        )

@branches_bp.route("/branches/<int:branch_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_branch(branch_id):
    """Get a specific branch by ID"""
    # BranchAdmin can only view their own branch
    if g.role == "BranchAdmin" and g.branch_id != branch_id:
        return error_response(
            error_code="FORBIDDEN_ACCESS",
            message="You can only view your own branch.",
            status_code=403
        )
    
    branch = Branch.query.filter_by(id=branch_id, tenant_id=g.parlour_id, is_deleted=False).first()
    if not branch:
        return error_response(
            error_code="BRANCH_NOT_FOUND",
            message="Branch not found.",
            status_code=404
        )

    return success_response({
        "id": branch.id,
        "name": branch.name,
        "address": branch.address,
        "phone": branch.phone,
        "email": branch.email,
        "opening_time": branch.opening_time,
        "closing_time": branch.closing_time,
        "status": branch.status,
        "latitude": float(branch.latitude) if branch.latitude is not None else None,
        "longitude": float(branch.longitude) if branch.longitude is not None else None,
        "geofence_radius_meters": branch.geofence_radius_meters or 100,
        "created_at": branch.created_at.isoformat() if branch.created_at else ""
    })

@branches_bp.route("/branches/<int:branch_id>", methods=["DELETE"])
@require_role(["ParlourAdmin"])
def delete_branch(branch_id):
    """Delete a branch (soft delete)"""
    branch = Branch.query.filter_by(id=branch_id, tenant_id=g.parlour_id, is_deleted=False).first()
    if not branch:
        return error_response(
            error_code="BRANCH_NOT_FOUND",
            message="Branch not found.",
            status_code=404
        )

    if branch.is_main_branch:
        return error_response(
            error_code="FORBIDDEN_ACTION",
            message="The Main Parlour branch cannot be deleted. Configure main parlour under Parlour Profile.",
            status_code=400
        )

    try:
        branch.is_deleted = True
        db.session.commit()
        return success_response({"message": "Branch deleted successfully."})

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to delete branch: {str(e)}")
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to delete branch.",
            status_code=500
        )

@branches_bp.route("/branches/limit-check", methods=["GET"])
@require_role(["ParlourAdmin"])
def check_branch_limit():
    """Check if tenant can create more branches"""
    max_branches = 3
    try:
        with db.get_master_engine().connect() as conn:
            from sqlalchemy import text
            res = conn.execute(text("""
                SELECT sp.max_branches 
                FROM tenants t 
                LEFT JOIN subscription_plans sp ON t.subscription_plan_id = sp.id 
                WHERE t.id = :id
            """), {"id": g.parlour_id}).fetchone()
            if res and res[0] is not None:
                max_branches = res[0]
    except Exception as err:
        logger.warning(f"Failed to fetch max_branches: {err}")
    current_branch_count = Branch.query.filter_by(tenant_id=g.parlour_id, is_deleted=False).count()
    can_create = current_branch_count < max_branches

    return success_response({
        "max_branches": max_branches,
        "current_branch_count": current_branch_count,
        "can_create_more": can_create,
        "remaining_branches": max_branches - current_branch_count
    })