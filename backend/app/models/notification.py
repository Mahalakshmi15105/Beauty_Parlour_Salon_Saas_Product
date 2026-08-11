from app.database import db
from app.models.mixins import TimestampMixin

class Notification(db.Model, TimestampMixin):
    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True, index=True)
    customer_membership_id = db.Column(db.Integer, db.ForeignKey("customer_memberships.id"), nullable=True, index=True)
    
    type = db.Column(db.String(50), nullable=False, default="system")  # membership_expiry, billing, system
    stage = db.Column(db.String(20), nullable=True)  # 30d, 15d, 7d, 3d, 1d, 0d, expired
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    data = db.Column(db.JSON, nullable=True)
    is_read = db.Column(db.Boolean, default=False, nullable=False, index=True)

    # Relationships
    customer = db.relationship("Customer", lazy="joined")
    customer_membership = db.relationship("CustomerMembership", lazy="joined")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
