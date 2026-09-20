from app.database import db, tenant_metadata
from datetime import date, datetime

class PayrollAdjustment(db.Model):
    __tablename__ = "payroll_adjustments"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False, index=True)
    type = db.Column(db.String(20), nullable=False, default="Advance")  # Advance, Deduction
    amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    note = db.Column(db.Text, nullable=True)
    date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    employee = db.relationship("Employee", backref="payroll_adjustments")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
