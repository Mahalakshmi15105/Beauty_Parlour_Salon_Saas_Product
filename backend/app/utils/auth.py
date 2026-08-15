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
    Returns a query object for the model filtered by tenant_id and branch_id for BranchAdmin,
    or just tenant_id for ParlourAdmin/SuperAdmin.
    Branch-specific models will be filtered by branch_id when user is BranchAdmin.
    Shared models (like Services, Products) will only be filtered by tenant_id.
    """
    if not hasattr(g, "parlour_id"):
        raise RuntimeError("Attempted to run branch query outside a tenant-authenticated context.")
    
    # Start with tenant filtering
    query = model.query.filter_by(tenant_id=g.parlour_id, is_deleted=False) if hasattr(model, "is_deleted") else model.query.filter_by(tenant_id=g.parlour_id)
    
    # If BranchAdmin and model has branch_id, filter by branch_id
    if g.role == "BranchAdmin" and hasattr(g, "branch_id") and g.branch_id and hasattr(model, "branch_id"):
        query = query.filter_by(branch_id=g.branch_id)
    
    return query

def get_branch_query_with_deleted(model):
    """
    Returns a query object for the model filtered by tenant_id and branch_id (for BranchAdmin),
    including soft deleted records.
    """
    if not hasattr(g, "parlour_id"):
        raise RuntimeError("Attempted to run branch query outside a tenant-authenticated context.")
    
    # Start with tenant filtering
    query = model.query.filter_by(tenant_id=g.parlour_id)
    
    # If BranchAdmin and model has branch_id, filter by branch_id
    if g.role == "BranchAdmin" and hasattr(g, "branch_id") and g.branch_id and hasattr(model, "branch_id"):
        query = query.filter_by(branch_id=g.branch_id)
    
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
                from app.models.global_models import Tenant
                tenant_exists = Tenant.query.filter_by(id=parlour_id).first()
                if not tenant_exists:
                    return error_response(
                        error_code="INVALID_TENANT",
                        message="The associated parlour tenant does not exist or has been deleted. Please log out and register/login again.",
                        status_code=400
                    )

            if branch_id:
                from app.models.branch import Branch
                branch_exists = Branch.query.filter_by(id=branch_id, tenant_id=parlour_id).first()
                if not branch_exists:
                    return error_response(
                        error_code="INVALID_BRANCH",
                        message="The associated branch does not exist or has been deleted. Please log out and login again.",
                        status_code=400
                    )

            return fn(*args, **kwargs)
        return wrapper
    return decorator
