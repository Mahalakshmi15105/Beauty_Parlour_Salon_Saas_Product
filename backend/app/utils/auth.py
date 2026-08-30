from functools import wraps
from flask import g
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from app.utils.responses import error_response

def get_tenant_query(model):
    """
    Returns a query object for the model filtered automatically by the current request's tenant_id.
    """
    if not hasattr(g, "parlour_id"):
        raise RuntimeError("Attempted to run tenant query outside a tenant-authenticated context.")
    return model.query.filter_by(tenant_id=g.parlour_id, is_deleted=False) if hasattr(model, "is_deleted") else model.query.filter_by(tenant_id=g.parlour_id)

def get_tenant_query_with_deleted(model):
    """
    Returns a query object for the model filtered automatically by the current request's tenant_id, including soft deleted records.
    """
    if not hasattr(g, "parlour_id"):
        raise RuntimeError("Attempted to run tenant query outside a tenant-authenticated context.")
    return model.query.filter_by(tenant_id=g.parlour_id)

def get_branch_query(model):
    """
    Returns a query object for the model filtered by tenant_id and branch_id.
    - If user is logged into a Branch (g.branch_id):
        Filters strictly by model.branch_id == g.branch_id (or shared branch_id IS NULL for catalog/services).
    - If user is Parlour Owner (g.parlour_id without g.branch_id):
        - branch_id="all": Returns all records for tenant across main parlour & branches.
        - branch_id=X (integer): Returns records for Branch X.
        - default (no branch_id specified): Returns records for Main Parlour (branch_id IS NULL).
    """
    if not hasattr(g, "parlour_id"):
        raise RuntimeError("Attempted to run branch query outside a tenant-authenticated context.")
    
    # Start with tenant filtering
    query = model.query.filter_by(tenant_id=g.parlour_id, is_deleted=False) if hasattr(model, "is_deleted") else model.query.filter_by(tenant_id=g.parlour_id)
    
    # If model has branch_id column:
    if hasattr(model, "branch_id"):
        if hasattr(g, "branch_id") and g.branch_id:
            # For catalog items (Service, Product, ServiceCategory, MembershipPlan), allow branch_id == g.branch_id OR branch_id IS NULL
            model_name = model.__name__ if hasattr(model, "__name__") else ""
            if model_name in ("Service", "Product", "ServiceCategory", "MembershipPlan", "Supplier"):
                query = query.filter((model.branch_id == g.branch_id) | (model.branch_id.is_(None)))
            else:
                query = query.filter(model.branch_id == g.branch_id)
        else:
            from flask import request
            b_param = request.args.get("branch_id") if request else None
            if b_param == "all":
                pass
            elif b_param and b_param not in ("main", "null", "0", "None"):
                try:
                    bid = int(b_param)
                    query = query.filter(model.branch_id == bid)
                except (ValueError, TypeError):
                    query = query.filter(model.branch_id.is_(None))
            else:
                query = query.filter(model.branch_id.is_(None))

    return query

def get_branch_query_with_deleted(model):
    """
    Returns a query object for the model filtered by tenant_id and branch_id, including soft deleted records.
    """
    if not hasattr(g, "parlour_id"):
        raise RuntimeError("Attempted to run branch query outside a tenant-authenticated context.")
    
    query = model.query.filter_by(tenant_id=g.parlour_id)
    
    if hasattr(model, "branch_id"):
        if hasattr(g, "branch_id") and g.branch_id:
            query = query.filter(model.branch_id == g.branch_id)
        else:
            from flask import request
            b_param = request.args.get("branch_id") if request else None
            if b_param == "all":
                pass
            elif b_param and b_param not in ("main", "null", "0", "None"):
                try:
                    bid = int(b_param)
                    query = query.filter(model.branch_id == bid)
                except (ValueError, TypeError):
                    query = query.filter(model.branch_id.is_(None))
            else:
                query = query.filter(model.branch_id.is_(None))

    return query

def require_role(roles):
    """
    Decorator to enforce role permissions and bind tenant/branch context to flask.g.
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
            branch_id = claims.get("branch_id")
            role = claims.get("role")

            # Check if role matches
            if role not in roles:
                return error_response(
                    error_code="FORBIDDEN_ACCESS",
                    message="You do not have permission to perform this action.",
                    status_code=403
                )

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

            # Bind contexts to thread-local g
            g.user_id = user_id
            g.parlour_id = parlour_id
            g.branch_id = branch_id
            g.role = role

            if parlour_id:
                from app.services.cache import cache
                t_cache_key = f"tenant_valid:{parlour_id}"
                tenant_exists = cache.get(t_cache_key)
                if tenant_exists is None:
                    try:
                        from app.models.global_models import Tenant
                        t_obj = Tenant.query.filter_by(id=parlour_id).first()
                        tenant_exists = bool(t_obj)
                        cache.set(t_cache_key, tenant_exists, timeout=1800)
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(f"Tenant verification fallback triggered: {e}")
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
                        from app.models.branch import Branch
                        b_obj = Branch.query.filter_by(id=branch_id, tenant_id=parlour_id).first()
                        branch_exists = bool(b_obj)
                        cache.set(b_cache_key, branch_exists, timeout=1800)
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(f"Branch verification fallback triggered: {e}")
                        branch_exists = True

                if not branch_exists:
                    return error_response(
                        error_code="INVALID_BRANCH",
                        message="The associated branch does not exist or has been deleted. Please log out and login again.",
                        status_code=400
                    )

            return fn(*args, **kwargs)
        return wrapper
    return decorator
