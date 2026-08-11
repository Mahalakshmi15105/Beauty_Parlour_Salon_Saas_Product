from app.database import db
from app.models.mixins import TimestampMixin, SoftDeleteMixin

class Customer(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "customers"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(30), nullable=False, index=True)
    email = db.Column(db.String(120), nullable=True, index=True)
    gender = db.Column(db.String(20), nullable=True)
    date_of_birth = db.Column(db.Date, nullable=True)
    address = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    spot = db.Column(db.String(50), nullable=True)

    # Relationships
    memberships = db.relationship("CustomerMembership", back_populates="customer", cascade="all, delete-orphan")
    invoices = db.relationship("Invoice", back_populates="customer")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class Reminder(db.Model, TimestampMixin):
    __tablename__ = "reminders"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False, index=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=True, index=True)
    reminder_type = db.Column(db.String(50), nullable=False)  # Next visit, Membership renewal, Follow-up appointment
    reminder_date = db.Column(db.String(50), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="Pending")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)



class CustomerFeedback(db.Model, TimestampMixin):
    __tablename__ = "customer_feedback"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False, index=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey("invoices.id"), nullable=False, index=True)
    rating = db.Column(db.Integer, nullable=False, default=5)
    comments = db.Column(db.Text, nullable=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
