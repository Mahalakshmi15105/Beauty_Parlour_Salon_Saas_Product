from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin
from datetime import datetime

class Attendance(db.Model, TimestampMixin):
    __tablename__ = "attendances"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=False, index=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    checkin_method = db.Column(db.String(20), nullable=False, default="QR")  # QR, Manual
    location_flagged = db.Column(db.Boolean, nullable=False, default=False)
    location_unavailable = db.Column(db.Boolean, nullable=False, default=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=True)
    longitude = db.Column(db.Numeric(11, 8), nullable=True)
    distance_meters = db.Column(db.Numeric(8, 2), nullable=True)
    check_out_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(10), nullable=False, default="P")  # P, HP, OFF

    # Relationships
    employee = db.relationship("Employee", backref="attendances")
    branch = db.relationship("Branch", backref="attendances")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
