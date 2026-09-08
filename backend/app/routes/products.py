from flask import Blueprint, request, g
from app.database import db
from app.models.catalog import Product, Supplier, StockReorderLog
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.utils.query import paginate_query
import logging

logger = logging.getLogger(__name__)
products_bp = Blueprint("products", __name__)

@products_bp.route("/products", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_products():
    q = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    status = request.args.get("status", "").strip()
    low_stock = request.args.get("low_stock", "").lower() == "true"
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")
    sort = request.args.get("sort", "name")

    query = get_branch_query(Product)

    if q:
        query = query.filter(
            (Product.name.ilike(f"%{q}%")) |
            (Product.sku.ilike(f"%{q}%")) |
            (Product.barcode.ilike(f"%{q}%"))
        )

    if category:
        query = query.filter(Product.category == category)

    if status:
        query = query.filter(Product.status == status)

    if low_stock:
        query = query.filter(Product.stock_quantity <= Product.low_stock_threshold)

    sort_field = "id"
    sort_desc = False
    if sort.startswith("-"):
        sort_field = sort[1:]
        sort_desc = True
    else:
        sort_field = sort

    products, next_cursor = paginate_query(
        query=query,
        model=Product,
        limit_val=limit,
        cursor=cursor,
        sort_field=sort_field,
        sort_desc=sort_desc
    )

    data = [
        {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "sku": p.sku,
            "barcode": p.barcode,
            "cost_price": float(p.cost_price),
            "selling_price": float(p.selling_price),
            "mrp": float(p.mrp),
            "stock_quantity": p.stock_quantity,
            "low_stock_threshold": p.low_stock_threshold,
            "status": p.status,
            "image_url": p.image_url,
            "created_at": p.created_at.isoformat() if p.created_at else None
        } for p in products
    ]

    return success_response({
        "items": data,
        "next_cursor": next_cursor
    })


@products_bp.route("/products/<int:product_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_product(product_id):
    product = get_branch_query(Product).filter_by(id=product_id).first()
    if not product:
        return error_response(
            error_code="PRODUCT_NOT_FOUND",
            message="Product not found or access denied.",
            status_code=404
        )
    return success_response({
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "sku": product.sku,
        "barcode": product.barcode,
        "cost_price": float(product.cost_price),
        "selling_price": float(product.selling_price),
        "mrp": float(product.mrp),
        "stock_quantity": product.stock_quantity,
        "low_stock_threshold": product.low_stock_threshold,
        "status": product.status,
        "image_url": product.image_url,
        "created_at": product.created_at.isoformat() if product.created_at else None
    })


@products_bp.route("/products", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_product():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    sku = data.get("sku", "").strip() or None
    barcode = data.get("barcode", "").strip() or None
    cost_price = data.get("cost_price", 0.00)
    selling_price = data.get("selling_price", 0.00)
    mrp = data.get("mrp", 0.00)
    stock_quantity = data.get("stock_quantity", 0)
    low_stock_threshold = data.get("low_stock_threshold", 5)

    if not name:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Product name is required.",
            status_code=400
        )

    # Validate numbers
    try:
        cp_val = float(cost_price)
        sp_val = float(selling_price)
        mrp_val = float(mrp) if mrp else sp_val
        stock_val = int(stock_quantity)
        thresh_val = int(low_stock_threshold)
        if cp_val < 0 or sp_val < 0 or mrp_val < 0 or stock_val < 0 or thresh_val < 0:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Prices, stock, and threshold must be valid non-negative numbers.",
            status_code=400
        )

    # Check unique constraints (SKU and Barcode) in tenant context
    if sku:
        dup_sku = get_branch_query(Product).filter_by(sku=sku).first()
        if dup_sku:
            return error_response(
                error_code="DUPLICATE_RECORD",
                message=f"A product with SKU '{sku}' already exists.",
                status_code=400
            )

    if barcode:
        dup_bar = get_branch_query(Product).filter_by(barcode=barcode).first()
        if dup_bar:
            return error_response(
                error_code="DUPLICATE_RECORD",
                message=f"A product with Barcode '{barcode}' already exists.",
                status_code=400
            )

    target_branch_id = g.branch_id if (hasattr(g, "branch_id") and g.branch_id) else (int(data["branch_id"]) if data.get("branch_id") else None)

    try:
        product = Product(
            tenant_id=g.parlour_id,
            branch_id=target_branch_id,
            name=name,
            category=data.get("category"),
            sku=sku,
            barcode=barcode,
            cost_price=cp_val,
            selling_price=sp_val,
            mrp=mrp_val,
            stock_quantity=stock_val,
            low_stock_threshold=thresh_val,
            status=data.get("status", "active"),
            image_url=data.get("image_url")
        )
        db.session.add(product)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating product: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to create product record.",
            status_code=500
        )

    return success_response({
        "id": product.id,
        "name": product.name,
        "sku": product.sku,
        "selling_price": float(product.selling_price),
        "mrp": float(product.mrp),
        "image_url": product.image_url
    }, 201)


@products_bp.route("/products/<int:product_id>", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_product(product_id):
    product = get_tenant_query(Product).filter_by(id=product_id).first()
    if not product:
        return error_response(
            error_code="PRODUCT_NOT_FOUND",
            message="Product not found or access denied.",
            status_code=404
        )

    data = request.get_json() or {}
    name = data.get("name", "").strip()
    sku = data.get("sku", "").strip() or None
    barcode = data.get("barcode", "").strip() or None
    cost_price = data.get("cost_price", 0.00)
    selling_price = data.get("selling_price", 0.00)
    mrp = data.get("mrp", 0.00)
    stock = data.get("stock_quantity", 0)
    threshold = data.get("low_stock_threshold", 5)

    if not name:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Product name is required.",
            status_code=400
        )

    try:
        cp_val = float(cost_price)
        sp_val = float(selling_price)
        mrp_val = float(mrp)
        stock_val = int(stock)
        thresh_val = int(threshold)
        if cp_val < 0 or sp_val < 0 or mrp_val < 0 or stock_val < 0 or thresh_val < 0:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Prices, stock levels, and stock thresholds must be positive values.",
            status_code=400
        )

    # Check unique constraints
    if sku:
        dup_sku = get_tenant_query(Product).filter(Product.sku == sku, Product.id != product_id).first()
        if dup_sku:
            return error_response(
                error_code="DUPLICATE_RECORD",
                message=f"Another product with SKU '{sku}' already exists.",
                status_code=400
            )

    if barcode:
        dup_bar = get_tenant_query(Product).filter(Product.barcode == barcode, Product.id != product_id).first()
        if dup_bar:
            return error_response(
                error_code="DUPLICATE_RECORD",
                message=f"Another product with Barcode '{barcode}' already exists.",
                status_code=400
            )

    try:
        product.name = name
        product.category = data.get("category")
        product.sku = sku
        product.barcode = barcode
        product.cost_price = cp_val
        product.selling_price = sp_val
        product.mrp = mrp_val
        product.stock_quantity = stock_val
        product.low_stock_threshold = thresh_val
        product.status = data.get("status", "active")
        if "image_url" in data:
            product.image_url = data.get("image_url")
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating product: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update product record.",
            status_code=500
        )

    return success_response({"message": "Product updated successfully."})


@products_bp.route("/products/<int:product_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_product(product_id):
    product = get_tenant_query(Product).filter_by(id=product_id).first()
    if not product:
        return error_response(
            error_code="PRODUCT_NOT_FOUND",
            message="Product not found or access denied.",
            status_code=404
        )

    try:
        product.soft_delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting product: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete product record.",
            status_code=500
        )

    return success_response({"message": "Product soft-deleted successfully."})


@products_bp.route("/suppliers", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_suppliers():
    suppliers = get_tenant_query(Supplier).all()
    data = [
        {
            "id": s.id,
            "name": s.name,
            "contact_name": s.contact_name,
            "phone": s.phone,
            "email": s.email,
            "address": s.address,
            "status": s.status
        } for s in suppliers
    ]
    return success_response(data)


@products_bp.route("/suppliers", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_supplier():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    phone = data.get("phone", "").strip()
    
    if not name or not phone:
        return error_response(
            error_code="VALIDATION_ERROR",
            message="Supplier Name and Phone are required.",
            status_code=400
        )
        
    supplier = Supplier(
        tenant_id=g.parlour_id,
        name=name,
        contact_name=data.get("contact_name", "").strip() or None,
        phone=phone,
        email=data.get("email", "").strip() or None,
        address=data.get("address", "").strip() or None,
        status="active"
    )
    
    try:
        db.session.add(supplier)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating supplier: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to create supplier record.",
            status_code=500
        )
        
    return success_response({"message": "Supplier created successfully.", "id": supplier.id})


@products_bp.route("/suppliers/<int:supplier_id>", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_supplier(supplier_id):
    supplier = get_tenant_query(Supplier).filter_by(id=supplier_id).first()
    if not supplier:
        return error_response(
            error_code="SUPPLIER_NOT_FOUND",
            message="Supplier not found or access denied.",
            status_code=404
        )
        
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    phone = data.get("phone", "").strip()
    
    if not name or not phone:
        return error_response(
            error_code="VALIDATION_ERROR",
            message="Supplier Name and Phone are required.",
            status_code=400
        )
        
    try:
        supplier.name = name
        supplier.contact_name = data.get("contact_name", "").strip() or None
        supplier.phone = phone
        supplier.email = data.get("email", "").strip() or None
        supplier.address = data.get("address", "").strip() or None
        supplier.status = data.get("status", "active")
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating supplier: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update supplier record.",
            status_code=500
        )
        
    return success_response({"message": "Supplier updated successfully."})


@products_bp.route("/suppliers/<int:supplier_id>", methods=["DELETE"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def delete_supplier(supplier_id):
    supplier = get_tenant_query(Supplier).filter_by(id=supplier_id).first()
    if not supplier:
        return error_response(
            error_code="SUPPLIER_NOT_FOUND",
            message="Supplier not found or access denied.",
            status_code=404
        )
        
    try:
        supplier.soft_delete()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting supplier: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to delete supplier record.",
            status_code=500
        )
        
    return success_response({"message": "Supplier deleted successfully."})


@products_bp.route("/reorders", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_reorder_logs():
    logs = get_tenant_query(StockReorderLog).order_by(StockReorderLog.created_at.desc()).all()
    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "product_name": log.product.name if log.product else "Deleted Product",
            "supplier_name": log.supplier.name if log.supplier else "N/A",
            "quantity": log.quantity,
            "cost_price": float(log.cost_price),
            "total_price": float(log.cost_price * log.quantity),
            "status": log.status,
            "created_at": log.created_at.isoformat(),
            "notes": log.notes
        })
    return success_response(data)


@products_bp.route("/reorders", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def create_reorder_log():
    data = request.get_json() or {}
    product_id = data.get("product_id")
    quantity = data.get("quantity")
    supplier_id = data.get("supplier_id")
    notes = data.get("notes", "").strip()

    if not product_id or not quantity:
        return error_response(
            error_code="VALIDATION_ERROR",
            message="Product ID and Quantity are required.",
            status_code=400
        )

    try:
        quantity = int(quantity)
        if quantity <= 0:
            raise ValueError()
    except ValueError:
        return error_response(
            error_code="VALIDATION_ERROR",
            message="Quantity must be a positive integer.",
            status_code=400
        )

    product = get_tenant_query(Product).filter_by(id=product_id).first()
    if not product:
        return error_response(
            error_code="PRODUCT_NOT_FOUND",
            message="Product not found or access denied.",
            status_code=404
        )

    cost_price = data.get("cost_price")
    if cost_price is None:
        cost_price = product.cost_price
    else:
        try:
            cost_price = float(cost_price)
        except ValueError:
            cost_price = product.cost_price

    # Validate supplier if provided
    actual_supplier_id = None
    if supplier_id:
        try:
            supplier = get_tenant_query(Supplier).filter_by(id=int(supplier_id)).first()
            if supplier:
                actual_supplier_id = supplier.id
        except ValueError:
            pass

    log = StockReorderLog(
        tenant_id=g.parlour_id,
        product_id=product.id,
        supplier_id=actual_supplier_id,
        quantity=quantity,
        cost_price=cost_price,
        status="Received",
        notes=notes
    )

    try:
        # Crucial Action: Increase product stock
        product.stock_quantity += quantity
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating reorder log: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to log reorder transaction.",
            status_code=500
        )

    return success_response({
        "message": "Reorder transaction logged successfully.",
        "id": log.id,
        "new_stock": product.stock_quantity
    })


