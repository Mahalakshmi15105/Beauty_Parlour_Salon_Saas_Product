import json
from app.database import db
from app.models.mixins import TimestampMixin

class VisitMembershipSetting(db.Model, TimestampMixin):
    __tablename__ = "visit_membership_settings"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    
    # "paid_plan" (Type A, default) or "visit_based" (Type B)
    membership_mode = db.Column(db.String(30), nullable=False, default="paid_plan")
    required_visits = db.Column(db.Integer, nullable=False, default=6)
    
    # JSON list of service IDs that count toward visit counter
    qualifying_service_ids_json = db.Column(db.Text, nullable=True, default="[]")
    
    # JSON list of service IDs eligible for 100% free redemption on qualifying visit
    free_service_ids_json = db.Column(db.Text, nullable=True, default="[]")

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
            "free_service_ids": self.free_service_ids
        }


class CustomerVisitCounter(db.Model, TimestampMixin):
    __tablename__ = "customer_visit_counters"

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
