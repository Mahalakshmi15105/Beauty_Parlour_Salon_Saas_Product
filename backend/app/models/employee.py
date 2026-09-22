from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin, SoftDeleteMixin
from datetime import date

class Employee(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "employees"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=True)
    phone = db.Column(db.String(30), nullable=False, index=True)
    specialization = db.Column(db.String(100), nullable=True)
    role = db.Column(db.String(100), nullable=True)
    salary = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    target = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    level = db.Column(db.String(50), nullable=False, default="L1")
    commission_percentage = db.Column(db.Numeric(5, 2), nullable=False, default=0.00)
    joining_date = db.Column(db.Date, nullable=False, default=date.today)
    shift_start_time = db.Column(db.String(10), nullable=True, default="09:00")
    shift_end_time = db.Column(db.String(10), nullable=True, default="18:00")
    status = db.Column(db.String(50), nullable=False, default="active")  # active, inactive

    # Relationships
    line_items = db.relationship("InvoiceLineItem", back_populates="employee")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
