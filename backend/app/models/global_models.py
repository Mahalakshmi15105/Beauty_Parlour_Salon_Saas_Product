from app.database import db
from app.models.mixins import TimestampMixin, SoftDeleteMixin

class SubscriptionPlan(db.Model, TimestampMixin):
    __tablename__ = "subscription_plans"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    duration_days = db.Column(db.Integer, nullable=False, default=30)
    max_employees = db.Column(db.Integer, nullable=False, default=5)
    max_services = db.Column(db.Integer, nullable=False, default=20)
    max_customers = db.Column(db.Integer, nullable=False, default=100)
    max_branches = db.Column(db.Integer, nullable=False, default=3)

    # Relationships
    tenants = db.relationship("Tenant", back_populates="subscription_plan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class Tenant(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tenants"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(50), nullable=False, default="active")  # active, suspended, closed
    subscription_plan_id = db.Column(db.Integer, db.ForeignKey("subscription_plans.id"), nullable=False)
    subscription_expires_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    subscription_plan = db.relationship("SubscriptionPlan", back_populates="tenants")
    users = db.relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    settings = db.relationship("TenantSetting", back_populates="tenant", cascade="all, delete-orphan", uselist=False)
    branches = db.relationship("Branch", back_populates="tenant", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    @property
    def slug(self):
        import re
        s = re.sub(r'[^a-z0-9]+', '-', (self.name or "").lower()).strip('-')
        return s or f"parlour-{self.id}"

