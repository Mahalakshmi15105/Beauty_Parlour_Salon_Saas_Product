from app.database import db, tenant_metadata
from app.models.mixins import TimestampMixin, SoftDeleteMixin

class Appointment(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "appointments"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    appointment_number = db.Column(db.String(100), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True, index=True)
    customer_name = db.Column(db.String(150), nullable=False)
    customer_phone = db.Column(db.String(50), nullable=False, index=True)
    customer_email = db.Column(db.String(120), nullable=True)
    appointment_date = db.Column(db.Date, nullable=False, index=True)
    start_time = db.Column(db.Time, nullable=True)
    end_time = db.Column(db.Time, nullable=True)
    token_number = db.Column(db.Integer, nullable=True)
    total_amount = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    estimated_duration_minutes = db.Column(db.Integer, nullable=False, default=30)
    booking_source = db.Column(db.String(50), nullable=False, default="Walk-in")  # Phone Call, WhatsApp, Walk-in, Website Token, Website Slot, Instagram, Facebook
    booking_channel = db.Column(db.String(50), nullable=False, default="Website")  # Website, Phone, WhatsApp, Walk-in, Instagram, Facebook
    appointment_type = db.Column(db.String(50), nullable=False, default="Regular")  # Regular, VIP, Home Service
    status = db.Column(db.String(50), nullable=False, default="Booked")  # Booked, Waiting, In Service, Completed, Cancelled, No Show
    notes = db.Column(db.Text, nullable=True)

    # Relationships
    customer = db.relationship("Customer")
    items = db.relationship("AppointmentItem", back_populates="appointment", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "branch_id": self.branch_id,
            "appointment_number": self.appointment_number,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name,
            "customer_phone": self.customer_phone,
            "customer_email": self.customer_email or "",
            "appointment_date": self.appointment_date.strftime("%Y-%m-%d") if self.appointment_date else "",
            "start_time": self.start_time.strftime("%H:%M") if self.start_time else "",
            "start_time_12h": self.start_time.strftime("%I:%M %p") if self.start_time else "",
            "end_time": self.end_time.strftime("%H:%M") if self.end_time else "",
            "end_time_12h": self.end_time.strftime("%I:%M %p") if self.end_time else "",
            "token_number": self.token_number,
            "total_amount": float(self.total_amount or 0.00),
            "estimated_duration_minutes": self.estimated_duration_minutes,
            "booking_source": self.booking_source,
            "booking_channel": self.booking_channel,
            "appointment_type": self.appointment_type,
            "status": self.status,
            "notes": self.notes or "",
            "items": [item.to_dict() for item in self.items] if self.items else []
        }


class AppointmentItem(db.Model, TimestampMixin):
    __tablename__ = "appointment_items"
    metadata = tenant_metadata

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, index=True)
    branch_id = db.Column(db.Integer, db.ForeignKey("branches.id"), nullable=True, index=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey("appointments.id"), nullable=False, index=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)
    employee_id = db.Column(db.Integer, db.ForeignKey("employees.id"), nullable=True, index=True)
    price = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    duration_minutes = db.Column(db.Integer, nullable=False, default=30)
    status = db.Column(db.String(50), nullable=False, default="Booked")

    # Relationships
    appointment = db.relationship("Appointment", back_populates="items")
    service = db.relationship("Service")
    employee = db.relationship("Employee")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

    def to_dict(self):
        return {
            "id": self.id,
            "appointment_id": self.appointment_id,
            "service_id": self.service_id,
            "service_name": self.service.name if self.service else "Service",
            "employee_id": self.employee_id,
            "employee_name": f"{self.employee.first_name} {self.employee.last_name or ''}".strip() if self.employee else "",
            "price": float(self.price or 0.00),
            "duration_minutes": self.duration_minutes,
            "status": self.status
        }
