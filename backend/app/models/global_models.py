from app.database import db, master_metadata
from app.models.mixins import TimestampMixin, SoftDeleteMixin
from werkzeug.security import generate_password_hash, check_password_hash

class SubscriptionPlan(db.Model, TimestampMixin):
    __tablename__ = "subscription_plans"
    metadata = master_metadata

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
    metadata = master_metadata

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(50), nullable=False, default="active")  # active, suspended, closed
    subscription_plan_id = db.Column(db.Integer, db.ForeignKey("subscription_plans.id"), nullable=False)
    subscription_expires_at = db.Column(db.DateTime, nullable=True)
    db_name = db.Column(db.String(150), nullable=True)
    db_connection_uri = db.Column(db.String(500), nullable=True)

    # Relationships
    subscription_plan = db.relationship("SubscriptionPlan", back_populates="tenants")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    @property
    def slug(self):
        import re
        s = re.sub(r'[^a-z0-9]+', '-', (self.name or "").lower()).strip('-')
        return s or f"parlour-{self.id}"


class TenantLookup(db.Model, TimestampMixin):
    __tablename__ = "tenant_lookups"
    metadata = master_metadata

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    db_name = db.Column(db.String(150), nullable=True)
    db_connection_uri = db.Column(db.String(500), nullable=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)


class MasterUser(db.Model, TimestampMixin, SoftDeleteMixin):
    """
    Platform SuperAdmin Users stored in parlour_master DB.
    """
    __tablename__ = "users"
    metadata = master_metadata

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default="SuperAdmin")
    status = db.Column(db.String(50), nullable=False, default="active")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class PlatformSetting(db.Model, TimestampMixin):
    """
    Global platform configuration stored in parlour_master DB.
    """
    __tablename__ = "platform_settings"
    metadata = master_metadata

    id = db.Column(db.Integer, primary_key=True)
    setting_key = db.Column(db.String(100), nullable=False, unique=True, index=True)
    setting_value = db.Column(db.Text, nullable=True)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

