import base64
import os
from datetime import datetime, timezone
from app.database import db
from app.models.mixins import TimestampMixin

def encrypt_token(plain_token: str) -> str:
    """Simple obfuscation/encryption helper for access token at rest."""
    if not plain_token:
        return ""
    encoded = base64.b64encode(plain_token.encode("utf-8")).decode("utf-8")
    return f"ENC_{encoded}"

def decrypt_token(enc_token: str) -> str:
    """Decrypts obfuscated access token for server-side API calls."""
    if not enc_token:
        return ""
    if enc_token.startswith("ENC_"):
        raw = enc_token[4:]
        try:
            return base64.b64decode(raw.encode("utf-8")).decode("utf-8")
        except Exception:
            return enc_token
    return enc_token


class WhatsAppSetting(db.Model, TimestampMixin):
    __tablename__ = "whatsapp_settings"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, unique=True, index=True)
    meta_waba_id = db.Column(db.String(100), nullable=True)
    meta_phone_number_id = db.Column(db.String(100), nullable=True)
    encrypted_access_token = db.Column(db.Text, nullable=True)
    webhook_verify_token = db.Column(db.String(100), nullable=True)
    phone_number = db.Column(db.String(50), nullable=True)
    business_name = db.Column(db.String(150), nullable=True)
    status = db.Column(db.String(50), nullable=False, default="DISCONNECTED")  # CONNECTED, DISCONNECTED, EXPIRED, ERROR
    connected_at = db.Column(db.DateTime(timezone=True), nullable=True)
    last_synced_at = db.Column(db.DateTime(timezone=True), nullable=True)

    @property
    def access_token(self):
        return decrypt_token(self.encrypted_access_token)

    @access_token.setter
    def access_token(self, value):
        self.encrypted_access_token = encrypt_token(value)

    def to_dict(self, include_sensitive=False):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "meta_waba_id": self.meta_waba_id or "",
            "meta_phone_number_id": self.meta_phone_number_id or "",
            "phone_number": self.phone_number or "",
            "business_name": self.business_name or "",
            "status": self.status,
            "connected_at": self.connected_at.isoformat() if self.connected_at else None,
            "last_synced_at": self.last_synced_at.isoformat() if self.last_synced_at else None,
        }


class WhatsAppCampaign(db.Model, TimestampMixin):
    __tablename__ = "whatsapp_campaigns"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    template_type = db.Column(db.String(50), nullable=False, default="TEXT_ONLY")  # TEXT_ONLY, IMAGE_WITH_CAPTION
    offer_message = db.Column(db.Text, nullable=False)
    image_url = db.Column(db.String(255), nullable=True)
    coupon_code = db.Column(db.String(50), nullable=True)
    valid_until = db.Column(db.Date, nullable=True)
    audience_type = db.Column(db.String(50), nullable=False, default="ALL")  # ALL, MEMBERSHIP, RECENT_30D, INACTIVE, BIRTHDAY_TODAY, ANNIVERSARY_TODAY, CUSTOM
    template_name = db.Column(db.String(100), nullable=True)  # Meta-approved template for guaranteed delivery
    template_params_json = db.Column(db.Text, nullable=True)  # JSON list of custom values for {{1}}, {{2}}...
    
    total_target_customers = db.Column(db.Integer, nullable=False, default=0)
    valid_whatsapp_count = db.Column(db.Integer, nullable=False, default=0)
    skipped_count = db.Column(db.Integer, nullable=False, default=0)
    sent_count = db.Column(db.Integer, nullable=False, default=0)
    delivered_count = db.Column(db.Integer, nullable=False, default=0)
    read_count = db.Column(db.Integer, nullable=False, default=0)
    failed_count = db.Column(db.Integer, nullable=False, default=0)
    
    status = db.Column(db.String(50), nullable=False, default="DRAFT")  # DRAFT, QUEUED, SENDING, COMPLETED, FAILED, CANCELLED
    started_at = db.Column(db.DateTime(timezone=True), nullable=True)
    completed_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationships
    recipients = db.relationship("WhatsAppCampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "created_by_user_id": self.created_by_user_id,
            "title": self.title,
            "template_type": self.template_type,
            "offer_message": self.offer_message,
            "image_url": self.image_url or "",
            "coupon_code": self.coupon_code or "",
            "valid_until": self.valid_until.strftime("%Y-%m-%d") if self.valid_until else None,
            "audience_type": self.audience_type,
            "template_name": self.template_name or "",
            "template_params_json": self.template_params_json or "",
            "total_target_customers": self.total_target_customers,
            "valid_whatsapp_count": self.valid_whatsapp_count,
            "skipped_count": self.skipped_count,
            "sent_count": self.sent_count,
            "delivered_count": self.delivered_count,
            "read_count": self.read_count,
            "failed_count": self.failed_count,
            "status": self.status,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class WhatsAppCampaignRecipient(db.Model, TimestampMixin):
    __tablename__ = "whatsapp_campaign_recipients"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("whatsapp_campaigns.id"), nullable=False, index=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customers.id"), nullable=True, index=True)
    customer_name = db.Column(db.String(150), nullable=False)
    whatsapp_number = db.Column(db.String(50), nullable=False, index=True)
    status = db.Column(db.String(50), nullable=False, default="QUEUED")  # QUEUED, PROCESSING, SENT, DELIVERED, READ, FAILED, SKIPPED
    meta_message_id = db.Column(db.String(150), nullable=True, index=True)
    retry_count = db.Column(db.Integer, nullable=False, default=0)
    failure_reason = db.Column(db.Text, nullable=True)
    sent_at = db.Column(db.DateTime(timezone=True), nullable=True)
    delivered_at = db.Column(db.DateTime(timezone=True), nullable=True)
    read_at = db.Column(db.DateTime(timezone=True), nullable=True)

    # Relationship
    campaign = db.relationship("WhatsAppCampaign", back_populates="recipients")

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "campaign_id": self.campaign_id,
            "customer_id": self.customer_id,
            "customer_name": self.customer_name,
            "whatsapp_number": self.whatsapp_number,
            "status": self.status,
            "meta_message_id": self.meta_message_id or "",
            "retry_count": self.retry_count,
            "failure_reason": self.failure_reason or "",
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "read_at": self.read_at.isoformat() if self.read_at else None,
        }


class WhatsAppLog(db.Model, TimestampMixin):
    __tablename__ = "whatsapp_logs"

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey("tenants.id"), nullable=False, index=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("whatsapp_campaigns.id"), nullable=True, index=True)
    recipient_id = db.Column(db.Integer, db.ForeignKey("whatsapp_campaign_recipients.id"), nullable=True, index=True)
    event_type = db.Column(db.String(50), nullable=False)  # OAUTH_CONNECT, API_REQUEST, META_WEBHOOK, RETRY_ATTEMPT, ERROR
    payload_json = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "campaign_id": self.campaign_id,
            "recipient_id": self.recipient_id,
            "event_type": self.event_type,
            "payload_json": self.payload_json or "",
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
