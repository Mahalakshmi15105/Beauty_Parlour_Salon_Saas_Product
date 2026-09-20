from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin, SoftDeleteMixin

class Branch(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "branches"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    address = db.Column(db.Text, nullable=True)
    phone = db.Column(db.String(30), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    logo_url = db.Column(db.String(255), nullable=True)  # Branch-specific logo
    opening_time = db.Column(db.String(20), nullable=False, default="09:00")
    closing_time = db.Column(db.String(20), nullable=False, default="20:00")
    status = db.Column(db.String(50), nullable=False, default="active")  # active, inactive

    # Branch-specific Theme Settings
    theme_name = db.Column(db.String(50), nullable=True)
    primary_color = db.Column(db.String(20), nullable=True)
    secondary_color = db.Column(db.String(20), nullable=True)
    accent_color = db.Column(db.String(50), nullable=True)

    # Branch Geofencing Coordinates & Main Branch Flag
    is_main_branch = db.Column(db.Boolean, nullable=False, default=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=True)
    longitude = db.Column(db.Numeric(11, 8), nullable=True)
    geofence_radius_meters = db.Column(db.Integer, nullable=False, default=100)

    # Relationships
    users = db.relationship("User", back_populates="branch")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)