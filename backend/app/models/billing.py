from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin

class Invoice(db.Model, TimestampMixin):
    __tablename__ = "invoices"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    invoice_number = db.Column(db.String(100), nullable=False, unique=True, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False, index=True)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    discount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    tax = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    total = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    status = db.Column(db.String(50), nullable=False, default="Paid")  # Paid, Partial, Voided
    membership_name = db.Column(db.String(100), nullable=True)
    membership_discount = db.Column(db.Numeric(10, 2), nullable=True)

    # Relationships
    customer = db.relationship("Customer", back_populates="invoices")
    line_items = db.relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = db.relationship("InvoicePayment", back_populates="invoice", cascade="all, delete-orphan")

    @property
    def items(self):
        return self.line_items

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class InvoiceLineItem(db.Model, TimestampMixin):
    __tablename__ = "invoice_line_items"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=True, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=True, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=True, index=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    mrp = db.Column(db.Numeric(10, 2), nullable=True)
    discount_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    tax_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    line_total = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)

    # Relationships
    invoice = db.relationship("Invoice", back_populates="line_items")
    employee = db.relationship("Employee", back_populates="line_items")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class InvoicePayment(db.Model, TimestampMixin):
    __tablename__ = "invoice_payments"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=False, index=True)
    method = db.Column(db.String(50), nullable=False)  # cash, card, online
    amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)

    # Relationships
    invoice = db.relationship("Invoice", back_populates="payments")

    @property
    def payment_method(self):
        return getattr(self, "method", "") or ""

    @property
    def payment_mode(self):
        return getattr(self, "method", "") or ""

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

