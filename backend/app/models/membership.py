from app.database import db
from app.models.mixins import TimestampMixin, SoftDeleteMixin

class MembershipPlan(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "membership_plans"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    duration_days = db.Column(db.Integer, nullable=False, default=365)
    service_discount_percentage = db.Column(db.Numeric(5, 2), nullable=False, default=0.00)
    product_discount_percentage = db.Column(db.Numeric(5, 2), nullable=False, default=0.00)
    status = db.Column(db.String(50), nullable=False, default="active")  # active, inactive
    day_restrictions = db.Column(db.Text, nullable=True)  # JSON list of weekdays, e.g. ["Saturday", "Sunday"]

    # Relationships
    memberships = db.relationship("CustomerMembership", back_populates="plan")
    eligible_services = db.relationship("MembershipPlanService", back_populates="plan", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class MembershipPlanService(db.Model, TimestampMixin):
    __tablename__ = "membership_plan_services"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    membership_plan_id = db.Column(db.Integer, db.ForeignKey("membership_plans.id"), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)

    # Relationships
    plan = db.relationship("MembershipPlan", back_populates="eligible_services")
    service = db.relationship("Service")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class CustomerMembership(db.Model, TimestampMixin):
    __tablename__ = "customer_memberships"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=False, index=True)
    membership_plan_id = db.Column(db.Integer, db.ForeignKey("membership_plans.id"), nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(50), nullable=False, default="active")  # active, expired, cancelled, suspended

    # Relationships
    customer = db.relationship("Customer", back_populates="memberships")
    plan = db.relationship("MembershipPlan", back_populates="memberships")
    benefits = db.relationship("MembershipBenefit", back_populates="membership", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class MembershipBenefit(db.Model, TimestampMixin):
    __tablename__ = "membership_benefits"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    customer_membership_id = db.Column(db.Integer, db.ForeignKey("customer_memberships.id"), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)
    total_quantity = db.Column(db.Integer, nullable=False, default=1)
    remaining_quantity = db.Column(db.Integer, nullable=False, default=1)

    # Relationships
    membership = db.relationship("CustomerMembership", back_populates="benefits")
    service = db.relationship("Service", back_populates="benefits")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
