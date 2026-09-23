import logging
from functools import wraps
from flask import g
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from app.utils.responses import error_response
from app.database import db

logger = logging.getLogger(__name__)

def get_tenant_query(model):
    """
    Returns a query object for the model scoped to the active tenant database.
    Since each tenant has a physical database instance, tenant filtering is implicit.
    """
    return model.query.filter_by(is_deleted=False) if hasattr(model, "is_deleted") else model.query

def get_tenant_query_with_deleted(model):
    """
    Returns a query object for the model scoped to the active tenant database, including soft deleted records.
    """
    return model.query

def get_branch_query(model):
    """
    Returns a query object for the model filtered by branch_id within the active tenant database.
    Strictly scopes to the active branch context (g.branch_id or default Main Branch).
    """
    query = model.query.filter_by(is_deleted=False) if hasattr(model, "is_deleted") else model.query
    
    if hasattr(model, "branch_id"):
        target_bid = getattr(g, "branch_id", None)
        if not target_bid:
            from flask import request
            b_param = request.args.get("branch_id") if request else None
            if b_param and b_param not in ("all", "main", "null", "0", "None"):
                try:
                    target_bid = int(b_param)
                except (ValueError, TypeError):
                    pass

        main_b_id = None
        try:
            from app.models.branch import Branch
            main_b = Branch.query.filter_by(is_main_branch=True, is_deleted=False).first()
            if not main_b:
                main_b = Branch.query.filter_by(is_deleted=False).first()
            if main_b:
                main_b_id = main_b.id
        except Exception:
            main_b_id = 1

        if not target_bid:
            target_bid = main_b_id or 1

        if target_bid == main_b_id:
            query = query.filter((model.branch_id == target_bid) | (model.branch_id.is_(None)))
        else:
            query = query.filter(model.branch_id == target_bid)

    return query

def get_branch_query_with_deleted(model):
    """
    Returns a query object for the model filtered by branch_id, including soft deleted records.
    Strictly scopes to the active branch context (g.branch_id or default Main Branch).
    """
    query = model.query
    
    if hasattr(model, "branch_id"):
        target_bid = getattr(g, "branch_id", None)
        if not target_bid:
            from flask import request
            b_param = request.args.get("branch_id") if request else None
            if b_param and b_param not in ("all", "main", "null", "0", "None"):
                try:
                    target_bid = int(b_param)
                except (ValueError, TypeError):
                    pass

        main_b_id = None
        try:
            from app.models.branch import Branch
            main_b = Branch.query.filter_by(is_main_branch=True, is_deleted=False).first()
            if not main_b:
                main_b = Branch.query.filter_by(is_deleted=False).first()
            if main_b:
                main_b_id = main_b.id
        except Exception:
            main_b_id = 1

        if not target_bid:
            target_bid = main_b_id or 1

        if target_bid == main_b_id:
            query = query.filter((model.branch_id == target_bid) | (model.branch_id.is_(None)))
        else:
            query = query.filter(model.branch_id == target_bid)

    return query

def require_role(roles):
    """
    Decorator to enforce role permissions and bind tenant/branch database context to flask.g.
    Accepts a single role string or a list of role strings.
    """
    if isinstance(roles, str):
        roles = [roles]

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            identity = get_jwt_identity()
            claims = get_jwt()
            
            user_id = int(identity) if identity else None
            parlour_id = claims.get("parlour_id")
            tenant_db_uri = claims.get("tenant_db_uri")
            branch_id = claims.get("branch_id")
            role = claims.get("role")

            # Check if role matches
            if role not in roles:
                return error_response(
                    error_code="FORBIDDEN_ACCESS",
                    message="You do not have permission to perform this action.",
                    status_code=403
                )

            # SuperAdmin requests use Master DB
            if role == "SuperAdmin":
                g.use_master_db = True
                g.user_id = user_id
                g.role = role
                return fn(*args, **kwargs)

            # Enforce that ParlourAdmin must have a parlour_id
            if "ParlourAdmin" in roles and role == "ParlourAdmin" and not parlour_id:
                return error_response(
                    error_code="TENANT_CONTEXT_MISSING",
                    message="Tenant context is missing from authorization payload.",
                    status_code=403
                )

            # Enforce that BranchAdmin must have both parlour_id and branch_id
            if "BranchAdmin" in roles and role == "BranchAdmin":
                if not parlour_id:
                    return error_response(
                        error_code="TENANT_CONTEXT_MISSING",
                        message="Tenant context is missing from authorization payload.",
                        status_code=403
                    )
                if not branch_id:
                    return error_response(
                        error_code="BRANCH_CONTEXT_MISSING",
                        message="Branch context is missing from authorization payload.",
                        status_code=403
                    )

            # Resolve tenant database URI if not embedded directly in JWT
            if parlour_id and not tenant_db_uri:
                try:
                    with db.get_master_engine().connect() as conn:
                        from sqlalchemy import text
                        row = conn.execute(
                            text("SELECT db_connection_uri, status, is_deleted FROM tenants WHERE id = :id"),
                            {"id": parlour_id}
                        ).fetchone()
                        if not row or row[1] != "active" or row[2]:
                            return error_response(
                                error_code="INVALID_TENANT",
                                message="The associated parlour tenant does not exist, is deleted, or is suspended.",
                                status_code=400
                            )
                        tenant_db_uri = row[0]
                except Exception as e:
                    logger.error(f"Failed to fetch tenant DB URI in auth: {e}")

            # Bind contexts to thread-local g
            g.user_id = user_id
            g.parlour_id = parlour_id
            g.tenant_db_uri = tenant_db_uri
            g.branch_id = branch_id
            g.role = role
            g.use_master_db = False

            if parlour_id:
                from app.services.cache import cache
                t_cache_key = f"tenant_valid:{parlour_id}"
                tenant_exists = cache.get(t_cache_key)
                if tenant_exists is None:
                    try:
                        with db.get_master_engine().connect() as conn:
                            from sqlalchemy import text
                            row = conn.execute(text("SELECT id FROM tenants WHERE id = :id"), {"id": parlour_id}).fetchone()
                            tenant_exists = bool(row)
                            cache.set(t_cache_key, tenant_exists, timeout=1800)
                    except Exception as e:
                        logger.warning(f"Tenant verification fallback triggered: {e}")
                        tenant_exists = True

                if not tenant_exists:
                    return error_response(
                        error_code="INVALID_TENANT",
                        message="The associated parlour tenant does not exist or has been deleted. Please log out and register/login again.",
                        status_code=400
                    )

            if branch_id:
                from app.services.cache import cache
                b_cache_key = f"branch_valid:{parlour_id}:{branch_id}"
                branch_exists = cache.get(b_cache_key)
                if branch_exists is None:
                    try:
                        if tenant_db_uri:
                            tenant_engine = db.get_tenant_engine(tenant_db_uri)
                            with tenant_engine.connect() as conn:
                                from sqlalchemy import text
                                row = conn.execute(
                                    text("SELECT id FROM branches WHERE id = :bid AND tenant_id = :tid"),
                                    {"bid": branch_id, "tid": parlour_id}
                                ).fetchone()
                                branch_exists = bool(row)
                        else:
                            branch_exists = True
                        cache.set(b_cache_key, branch_exists, timeout=1800)
                    except Exception as e:
                        logger.warning(f"Branch verification fallback triggered: {e}")
                        branch_exists = True

                if not branch_exists:
                    return error_response(
                        error_code="INVALID_BRANCH",
                        message="The associated branch does not exist or has been deleted. Please log out and login again.",
                        status_code=400
                    )

            db.session.remove()
            return fn(*args, **kwargs)
        return wrapper
    return decorator

