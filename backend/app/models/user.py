from app.database import db
from app.models.mixins import TimestampMixin, SoftDeleteMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=True, index=True)
    email = db.Column(db.String(120), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default="ParlourAdmin")  # SuperAdmin, ParlourAdmin
    status = db.Column(db.String(50), nullable=False, default="active")  # active, inactive

    # Relationships
    tenant = db.relationship("Tenant", back_populates="users")

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class TenantSetting(db.Model, TimestampMixin):
    __tablename__ = "tenant_settings"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, unique=True, index=True)
    
    # Business Profile & Branding
    logo_url = db.Column(db.String(255), nullable=True)
    owner_name = db.Column(db.String(100), nullable=True)
    alternate_phone = db.Column(db.String(20), nullable=True)
    gst_number = db.Column(db.String(50), nullable=True)
    address = db.Column(db.Text, nullable=True)
    city = db.Column(db.String(50), nullable=True)
    state = db.Column(db.String(50), nullable=True)
    country = db.Column(db.String(50), nullable=True)
    postal_code = db.Column(db.String(20), nullable=True)
    website = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)

    # Invoice Settings
    invoice_prefix = db.Column(db.String(20), nullable=False, default="INV")
    tax_name = db.Column(db.String(50), nullable=False, default="GST")
    tax_rate = db.Column(db.Numeric(5, 2), nullable=False, default=18.00)
    receipt_header = db.Column(db.Text, nullable=True)
    receipt_footer = db.Column(db.Text, nullable=True)
    terms_and_conditions = db.Column(db.Text, nullable=True)
    show_logo = db.Column(db.Boolean, nullable=False, default=True)

    # Receipt & Thermal Printer Settings
    receipt_template = db.Column(db.String(50), nullable=False, default="Classic")
    paper_size = db.Column(db.String(20), nullable=False, default="80mm")
    show_gst = db.Column(db.Boolean, nullable=False, default=True)
    show_address = db.Column(db.Boolean, nullable=False, default=True)
    show_phone = db.Column(db.Boolean, nullable=False, default=True)
    show_email = db.Column(db.Boolean, nullable=False, default=True)
    show_website = db.Column(db.Boolean, nullable=False, default=True)
    show_qr_code = db.Column(db.Boolean, nullable=False, default=False)
    auto_print = db.Column(db.Boolean, nullable=False, default=False)
    thank_you_message = db.Column(db.String(255), nullable=True, default="Thank you for visiting. Please visit again.")

    # Regional, Currency & Language
    currency = db.Column(db.String(10), nullable=False, default="INR")
    currency_code = db.Column(db.String(10), nullable=False, default="INR")
    currency_symbol = db.Column(db.String(10), nullable=False, default="₹")
    language = db.Column(db.String(30), nullable=False, default="English")
    date_format = db.Column(db.String(50), nullable=False, default="YYYY-MM-DD")
    timezone = db.Column(db.String(50), nullable=False, default="UTC")

    # Theme Settings
    theme_name = db.Column(db.String(50), nullable=False, default="Default Pink")
    primary_color = db.Column(db.String(30), nullable=False, default="#EC4899")
    secondary_color = db.Column(db.String(30), nullable=False, default="#F472B6")
    accent_color = db.Column(db.String(30), nullable=False, default="#FDF2F8")

    # Marketing / Client Churn Settings
    churn_days_threshold = db.Column(db.Integer, nullable=False, default=45)

    # Relationships
    tenant = db.relationship("Tenant", back_populates="settings")
