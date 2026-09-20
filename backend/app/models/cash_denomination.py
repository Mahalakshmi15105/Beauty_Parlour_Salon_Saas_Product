from app.database import db, tenant_metadata
from datetime import date, datetime

class CashDenomination(db.Model):
    __tablename__ = "cash_denominations"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False, default=date.today, index=True)

    count_500 = db.Column(db.Integer, nullable=False, default=0)
    count_200 = db.Column(db.Integer, nullable=False, default=0)
    count_100 = db.Column(db.Integer, nullable=False, default=0)
    count_50 = db.Column(db.Integer, nullable=False, default=0)
    count_20 = db.Column(db.Integer, nullable=False, default=0)
    count_10 = db.Column(db.Integer, nullable=False, default=0)
    count_5 = db.Column(db.Integer, nullable=False, default=0)
    count_2 = db.Column(db.Integer, nullable=False, default=0)
    count_1 = db.Column(db.Integer, nullable=False, default=0)

    total = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    branch = db.relationship("Branch", backref="cash_denominations")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
