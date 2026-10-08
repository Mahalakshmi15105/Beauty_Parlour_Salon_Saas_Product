import json
from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin

class VisitMembershipSetting(db.Model, TimestampMixin):
    __tablename__ = "visit_membership_settings"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    
    # "paid_plan" (Type A), "visit_based" (Type B), or "points_based" (Type C)
    membership_mode = db.Column(db.String(30), nullable=False, default="paid_plan")
    
    # Type B (Visit-based) fields
    required_visits = db.Column(db.Integer, nullable=False, default=6)
    qualifying_service_ids_json = db.Column(db.Text, nullable=True, default="[]")
    free_service_ids_json = db.Column(db.Text, nullable=True, default="[]")

    # Type C (Points-based) fields
    points_spend_amount = db.Column(db.Float, nullable=False, default=100.0)      # e.g. 100 spent
    points_per_unit = db.Column(db.Float, nullable=False, default=5.0)            # e.g. 5 points earned per spend unit
    points_target = db.Column(db.Float, nullable=False, default=100.0)            # e.g. 100 target points to unlock discount
    points_discount_percentage = db.Column(db.Float, nullable=False, default=5.0) # e.g. 5% discount on target reached

    @property
    def qualifying_service_ids(self):
        try:
            return json.loads(self.qualifying_service_ids_json or "[]")
        except Exception:
            return []

    @qualifying_service_ids.setter
    def qualifying_service_ids(self, val):
        self.qualifying_service_ids_json = json.dumps(val or [])

    @property
    def free_service_ids(self):
        try:
            return json.loads(self.free_service_ids_json or "[]")
        except Exception:
            return []

    @free_service_ids.setter
    def free_service_ids(self, val):
        self.free_service_ids_json = json.dumps(val or [])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "branch_id": self.branch_id,
            "membership_mode": self.membership_mode,
            "required_visits": self.required_visits,
            "qualifying_service_ids": self.qualifying_service_ids,
            "free_service_ids": self.free_service_ids,
            "points_spend_amount": float(self.points_spend_amount or 100.0),
            "points_per_unit": float(self.points_per_unit or 5.0),
            "points_target": float(self.points_target or 100.0),
            "points_discount_percentage": float(self.points_discount_percentage or 5.0)
        }


class CustomerVisitCounter(db.Model, TimestampMixin):
    __tablename__ = "customer_visit_counters"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False, index=True)
    
    current_visit_count = db.Column(db.Integer, nullable=False, default=0)
    total_free_services_claimed = db.Column(db.Integer, nullable=False, default=0)
    last_visit_date = db.Column(db.DateTime, nullable=True)

    # Relationships
    customer = db.relationship("Customer")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "branch_id": self.branch_id,
            "customer_id": self.customer_id,
            "current_visit_count": self.current_visit_count,
            "total_free_services_claimed": self.total_free_services_claimed,
            "last_visit_date": self.last_visit_date.isoformat() if self.last_visit_date else None
        }


class CustomerPointsCounter(db.Model, TimestampMixin):
    __tablename__ = "customer_points_counters"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False, index=True)
    
    current_points = db.Column(db.Float, nullable=False, default=0.0)
    total_points_earned = db.Column(db.Float, nullable=False, default=0.0)
    total_points_redeemed = db.Column(db.Float, nullable=False, default=0.0)
    total_redemptions = db.Column(db.Integer, nullable=False, default=0)
    total_discount_amount_claimed = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    last_transaction_date = db.Column(db.DateTime, nullable=True)

    # Relationships
    customer = db.relationship("Customer")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "branch_id": self.branch_id,
            "customer_id": self.customer_id,
            "current_points": float(self.current_points or 0.0),
            "total_points_earned": float(self.total_points_earned or 0.0),
            "total_points_redeemed": float(self.total_points_redeemed or 0.0),
            "total_redemptions": int(self.total_redemptions or 0),
            "total_discount_amount_claimed": float(self.total_discount_amount_claimed or 0.00),
            "last_transaction_date": self.last_transaction_date.isoformat() if self.last_transaction_date else None
        }
