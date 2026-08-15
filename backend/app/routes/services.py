from flask import Blueprint, request, g
from app.database import db
from app.models.catalog import ServiceCategory, Service
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.utils.query import paginate_query
import logging

from app.models.global_models import Tenant

logger = logging.getLogger(__name__)
services_bp = Blueprint("services", __name__)

PREDEFINED_CATEGORIES = ["Hair Care", "Skin Care", "Nail Care", "Grooming Services"]

DEFAULT_CATEGORY_SERVICES = {
    "Hair Care": [
        {"name": "Hair Cut & Styling", "price": 499.00, "duration": 45},
        {"name": "Hair Spa & Nourishing", "price": 999.00, "duration": 60},
        {"name": "Hair Smoothening Treatment", "price": 2499.00, "duration": 120}
    ],
    "Skin Care": [
        {"name": "Glow Facial Treatment", "price": 1299.00, "duration": 60},
        {"name": "Deep Clean-Up", "price": 699.00, "duration": 30},
        {"name": "De-Tan & Bleach Pack", "price": 499.00, "duration": 30}
    ],
    "Nail Care": [
        {"name": "Deluxe Manicure & Pedicure", "price": 899.00, "duration": 60},
        {"name": "Nail Art & Gel Polish", "price": 599.00, "duration": 45}
    ],
    "Grooming Services": [
        {"name": "Beard Styling & Trim", "price": 299.00, "duration": 20},
        {"name": "Full Face Threading & Waxing", "price": 399.00, "duration": 30}
    ]
}

def ensure_tenant_categories(tenant_id):
    if not tenant_id:
        return
    try:
        tenant = Tenant.query.get(tenant_id)
        if not tenant:
            return
        added = False
        for cat_name in PREDEFINED_CATEGORIES:
            cat = ServiceCategory.query.filter_by(tenant_id=tenant_id, name=cat_name, is_deleted=False).first()
            if not cat:
                cat = ServiceCategory(tenant_id=tenant_id, name=cat_name, is_deleted=False)
                db.session.add(cat)
                db.session.flush()
                added = True
            
            # Check if category has default starter services
            existing_svcs = Service.query.filter_by(tenant_id=tenant_id, category_id=cat.id, is_deleted=False).count()
            if existing_svcs == 0 and cat_name in DEFAULT_CATEGORY_SERVICES:
                for s_info in DEFAULT_CATEGORY_SERVICES[cat_name]:
                    s_obj = Service(
                        tenant_id=tenant_id,
                        category_id=cat.id,
                        name=s_info["name"],
                        price=s_info["price"],
                        duration_minutes=s_info["duration"],
                        status="active",
                        is_deleted=False
                    )
                    db.session.add(s_obj)
                    added = True

        if added:
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to seed predefined categories/services for tenant {tenant_id}: {str(e)}")

# --- SERVICE CATEGORY CRUD ---

@services_bp.route("/service-categories", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_categories():
    ensure_tenant_categories(g.parlour_id)
    categories = ServiceCategory.query.filter_by(tenant_id=g.parlour_id, is_deleted=False).order_by(ServiceCategory.name.asc()).all()
    data = [{"id": c.id, "name": c.name} for c in categories]
    return success_response(data)


@services_bp.route("/service-categories", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_category():
    data = request.get_json() or {}
    name = data.get("name", "").strip()

    if not name:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Category name is required.",
            status_code=400
        )

    # Check duplicates in tenant context
    dup = get_tenant_query(ServiceCategory).filter_by(name=name).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"Category '{name}' already exists.",
            status_code=400
        )

    try:
        category = ServiceCategory(tenant_id=g.parlour_id, name=name)
        db.session.add(category)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating category: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to create category.",
            status_code=500
        )

    return success_response({"id": category.id, "name": category.name}, 201)


@services_bp.route("/service-categories/<int:category_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_category(category_id):
    category = get_tenant_query(ServiceCategory).filter_by(id=category_id).first()
    if not category:
        return error_response(
            error_code="CATEGORY_NOT_FOUND",
            message="Category not found or access denied.",
            status_code=404
        )

    # Prevent delete if category has active services
    has_services = get_tenant_query(Service).filter_by(category_id=category_id).first()
    if has_services:
        return error_response(
            error_code="CASCADING_RESTRICTION",
            message="Cannot delete a category containing active services. Reassign or delete them first.",
            status_code=400
        )

    try:
        category.soft_delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting category: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete category.",
            status_code=500
        )

    return success_response({"message": "Category soft-deleted successfully."})


# --- SERVICE CRUD ---

@services_bp.route("/services", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"])
def get_services():
    q = request.args.get("q", "").strip()
    category_id = request.args.get("category_id", "").strip()
    status = request.args.get("status", "").strip()
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")
    sort = request.args.get("sort", "name")

    query = get_tenant_query(Service)

    if q:
        query = query.filter(
            (Service.name.ilike(f"%{q}%")) |
            (Service.description.ilike(f"%{q}%"))
        )

    if category_id:
        try:
            query = query.filter(Service.category_id == int(category_id))
        except ValueError:
            pass

    if status:
        query = query.filter(Service.status == status)

    sort_field = "id"
    sort_desc = False
    if sort.startswith("-"):
        sort_field = sort[1:]
        sort_desc = True
    else:
        sort_field = sort

    services, next_cursor = paginate_query(
        query=query,
        model=Service,
        limit_val=limit,
        cursor=cursor,
        sort_field=sort_field,
        sort_desc=sort_desc
    )

    data = [
        {
            "id": s.id,
            "name": s.name,
            "price": float(s.price),
            "duration_minutes": s.duration_minutes,
            "status": s.status,
            "description": s.description,
            "category_id": s.category_id,
            "category_name": s.category.name if s.category else None,
            "created_at": s.created_at.isoformat()
        } for s in services
    ]

    return success_response({
        "items": data,
        "next_cursor": next_cursor
    })


@services_bp.route("/services/<int:service_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_service(service_id):
    service = get_tenant_query(Service).filter_by(id=service_id).first()
    if not service:
        return error_response(
            error_code="SERVICE_NOT_FOUND",
            message="Service not found or access denied.",
            status_code=404
        )
    return success_response({
        "id": service.id,
        "name": service.name,
        "price": float(service.price),
        "duration_minutes": service.duration_minutes,
        "status": service.status,
        "description": service.description,
        "category_id": service.category_id,
        "category_name": service.category.name if service.category else None,
        "created_at": service.created_at.isoformat()
    })


@services_bp.route("/services", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_service():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    category_id = data.get("category_id")
    price = data.get("price", 0.00)
    duration = data.get("duration_minutes", 30)

    if not name or not category_id:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Service name and Category ID are required.",
            status_code=400
        )

    # Validate numbers
    try:
        price_val = float(price)
        dur_val = int(duration)
        if price_val < 0 or dur_val <= 0:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Price must be >= 0 and duration must be a positive integer.",
            status_code=400
        )

    # Verify category exists in tenant context
    category = get_tenant_query(ServiceCategory).filter_by(id=category_id).first()
    if not category:
        return error_response(
            error_code="CATEGORY_NOT_FOUND",
            message="Service Category does not exist under your account context.",
            status_code=400
        )

    # Check duplicate service name in tenant context
    dup = get_tenant_query(Service).filter_by(name=name).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"A service named '{name}' already exists.",
            status_code=400
        )

    try:
        service = Service(
            tenant_id=g.parlour_id,
            category_id=category_id,
            name=name,
            price=price_val,
            duration_minutes=dur_val,
            description=data.get("description"),
            status=data.get("status", "active")
        )
        db.session.add(service)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating service: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to create service record.",
            status_code=500
        )

    return success_response({
        "id": service.id,
        "name": service.name,
        "price": float(service.price)
    }, 201)


@services_bp.route("/services/<int:service_id>", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_service(service_id):
    service = get_tenant_query(Service).filter_by(id=service_id).first()
    if not service:
        return error_response(
            error_code="SERVICE_NOT_FOUND",
            message="Service not found or access denied.",
            status_code=404
        )

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    category_id = data.get("category_id")
    price = data.get("price", 0.00)
    duration = data.get("duration_minutes", 30)

    if not name or not category_id:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Service name and Category ID are required.",
            status_code=400
        )

    try:
        price_val = float(price)
        dur_val = int(duration)
        if price_val < 0 or dur_val <= 0:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Price must be >= 0 and duration must be a positive integer.",
            status_code=400
        )

    # Verify category
    category = get_tenant_query(ServiceCategory).filter_by(id=category_id).first()
    if not category:
        return error_response(
            error_code="CATEGORY_NOT_FOUND",
            message="Service Category does not exist under your account context.",
            status_code=400
        )

    # Check duplicates
    dup = get_tenant_query(Service).filter(Service.name == name, Service.id != service_id).first()
    if dup:
        return error_response(
            error_code="DUPLICATE_RECORD",
            message=f"Another service named '{name}' already exists.",
            status_code=400
        )

    try:
        service.name = name
        service.category_id = category_id
        service.price = price_val
        service.duration_minutes = dur_val
        service.description = data.get("description")
        service.status = data.get("status", "active")
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating service: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update service record.",
            status_code=500
        )

    return success_response({"message": "Service updated successfully."})


@services_bp.route("/services/<int:service_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_service(service_id):
    service = get_tenant_query(Service).filter_by(id=service_id).first()
    if not service:
        return error_response(
            error_code="SERVICE_NOT_FOUND",
            message="Service not found or access denied.",
            status_code=404
        )

    try:
        service.soft_delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting service: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete service record.",
            status_code=500
        )

    return success_response({"message": "Service soft-deleted successfully."})
