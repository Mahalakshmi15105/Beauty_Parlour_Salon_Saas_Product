from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin, SoftDeleteMixin

class ServiceCategory(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "service_categories"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    name = db.Column(db.String(100), nullable=False)

    # Relationships
    services = db.relationship("Service", back_populates="category", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class Service(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "services"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("service_categories.id"), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    duration_minutes = db.Column(db.Integer, nullable=False, default=30)
    status = db.Column(db.String(50), nullable=False, default="active")  # active, inactive
    description = db.Column(db.Text, nullable=True)
    image_url = db.Column(db.Text, nullable=True)

    # Relationships
    category = db.relationship("ServiceCategory", back_populates="services")
    benefits = db.relationship("MembershipBenefit", back_populates="service", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class Product(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "products"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    name = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    sku = db.Column(db.String(100), nullable=True, index=True)
    barcode = db.Column(db.String(100), nullable=True, index=True)
    cost_price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    selling_price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    mrp = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    stock_quantity = db.Column(db.Integer, nullable=False, default=0)
    low_stock_threshold = db.Column(db.Integer, nullable=False, default=5)
    status = db.Column(db.String(50), nullable=False, default="active")  # active, inactive
    image_url = db.Column(db.Text, nullable=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)



class Supplier(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "suppliers"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    name = db.Column(db.String(150), nullable=False)
    contact_name = db.Column(db.String(150), nullable=True)
    phone = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(150), nullable=True)
    address = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="active")  # active, inactive

    def __init__(self, **kwargs):
        super().__init__(**kwargs)



class StockReorderLog(db.Model, TimestampMixin):
    __tablename__ = "stock_reorder_logs"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False, index=True)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"), nullable=True, index=True)
    quantity = db.Column(db.Integer, nullable=False)
    cost_price = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(50), nullable=False, default="Received")  # Received, Ordered, Pending
    notes = db.Column(db.Text, nullable=True)

    # Relationships
    product = db.relationship("Product")
    supplier = db.relationship("Supplier")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)



