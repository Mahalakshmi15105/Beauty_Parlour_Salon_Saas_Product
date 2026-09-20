from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin, SoftDeleteMixin
from datetime import date

class Expense(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "expenses"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=False, index=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    note = db.Column(db.Text, nullable=True)
    date = db.Column(db.Date, nullable=False, default=date.today, index=True)
    created_by = db.Column(db.String(100), nullable=True)

    branch = db.relationship("Branch", backref="expenses")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
