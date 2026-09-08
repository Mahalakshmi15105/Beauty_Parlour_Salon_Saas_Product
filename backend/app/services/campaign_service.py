import time
import json
import logging
from datetime import datetime, timezone, timedelta
from app.database import db
from app.models.customer import Customer
from app.models.billing import Invoice
from app.models.membership import CustomerMembership
from app.models.whatsapp import WhatsAppSetting, WhatsAppCampaign, WhatsAppCampaignRecipient, WhatsAppLog
from app.services.whatsapp_service import WhatsAppService
from app.utils.auth import get_tenant_query

logger = logging.getLogger(__name__)


class CampaignService:

    @staticmethod
    def fetch_target_customers(tenant_id: int, audience_type: str, custom_ids: list = None, branch_id: int = None):
        """Fetches active customers strictly belonging to the given tenant with non-empty phone numbers."""
        query = get_tenant_query(Customer).filter_by(tenant_id=tenant_id, is_deleted=False)
        
        # Add branch filter for BranchAdmin
        if branch_id:
            query = query.filter_by(branch_id=branch_id)

        if audience_type == "MEMBERSHIP":
            active_m_cust_ids = [
                cm.customer_id for cm in get_tenant_query(CustomerMembership).filter_by(tenant_id=tenant_id, status="ACTIVE").all()
            ]
            query = query.filter(Customer.id.in_(active_m_cust_ids)) if active_m_cust_ids else query.filter(db.text("1=0"))

        elif audience_type == "RECENT_30D":
            cutoff = datetime.now(timezone.utc) - timedelta(days=30)
            recent_invoices = get_tenant_query(Invoice).filter(
                Invoice.tenant_id == tenant_id,
                Invoice.created_at >= cutoff
            ).all()
            cust_ids = list(set([inv.customer_id for inv in recent_invoices if inv.customer_id]))
            query = query.filter(Customer.id.in_(cust_ids)) if cust_ids else query.filter(db.text("1=0"))

        elif audience_type == "INACTIVE":
            cutoff = datetime.now(timezone.utc) - timedelta(days=60)
            recent_invoices = get_tenant_query(Invoice).filter(
                Invoice.tenant_id == tenant_id,
                Invoice.created_at >= cutoff
            ).all()
            recent_cust_ids = set([inv.customer_id for inv in recent_invoices if inv.customer_id])
            all_invoices = get_tenant_query(Invoice).filter_by(tenant_id=tenant_id).all()
            past_cust_ids = set([inv.customer_id for inv in all_invoices if inv.customer_id])
            inactive_ids = list(past_cust_ids - recent_cust_ids)
            query = query.filter(Customer.id.in_(inactive_ids)) if inactive_ids else query.filter(db.text("1=0"))

        elif audience_type == "BIRTHDAY_TODAY":
            today = datetime.now().date()
            query = query.filter(
                Customer.date_of_birth.isnot(None),
                db.extract('month', Customer.date_of_birth) == today.month,
                db.extract('day', Customer.date_of_birth) == today.day
            )

        elif audience_type == "CUSTOM" and custom_ids:
            clean_ids = [int(i) for i in custom_ids if str(i).isdigit()]
            query = query.filter(Customer.id.in_(clean_ids))

        return query.all()

    @staticmethod
    def preview_campaign_audience(tenant_id: int, audience_type: str, custom_ids: list = None, branch_id: int = None) -> dict:
        """Returns statistics breakdown: Total Target, Valid WhatsApp, Skipped Count and Reasons."""
        customers = CampaignService.fetch_target_customers(tenant_id, audience_type, custom_ids, branch_id)
        total_target = len(customers)

        valid_recipients = []
        skipped_count = 0
        reasons = {
            "No Phone Number": 0,
            "Invalid Format": 0,
            "Opted Out": 0
        }

        for c in customers:
            # Check Opt-out if attribute exists
            is_opted_out = getattr(c, "whatsapp_opt_out", False)
            if is_opted_out:
                skipped_count += 1
                reasons["Opted Out"] += 1
                continue

            phone = (c.phone or "").strip()
            if not phone:
                skipped_count += 1
                reasons["No Phone Number"] += 1
                continue

            clean = "".join(filter(str.isdigit, phone))
            if len(clean) < 10:
                skipped_count += 1
                reasons["Invalid Format"] += 1
                continue

            valid_recipients.append(c)

        return {
            "total_target_customers": total_target,
            "valid_whatsapp_count": len(valid_recipients),
            "skipped_count": skipped_count,
            "reasons": reasons,
            "sample_recipients": [
                {
                    "id": c.id,
                    "name": f"{c.first_name} {c.last_name or ''}".strip(),
                    "phone": c.phone
                }
                for c in valid_recipients[:10]
            ]
        }

    @staticmethod
    def create_campaign_and_queue(tenant_id: int, user_id: int, campaign_data: dict, branch_id: int = None) -> WhatsAppCampaign:
        """Saves campaign record and enqueues recipient records in DB."""
        title = campaign_data.get("title", "WhatsApp Marketing Campaign")
        template_type = campaign_data.get("template_type", "TEXT_ONLY")
        offer_message = campaign_data.get("offer_message", "")
        image_url = campaign_data.get("image_url", "")
        coupon_code = campaign_data.get("coupon_code", "")
        valid_until_str = campaign_data.get("valid_until")
        audience_type = campaign_data.get("audience_type", "ALL")
        custom_ids = campaign_data.get("custom_customer_ids", [])
        template_name = campaign_data.get("template_name") or ""
        template_params = campaign_data.get("template_params") or []

        valid_until = None
        if valid_until_str and str(valid_until_str).strip() and str(valid_until_str).strip() != "dd-mm-yyyy":
            try:
                valid_until = datetime.strptime(str(valid_until_str).strip(), "%Y-%m-%d").date()
            except Exception:
                valid_until = None

        # Calculate audience
        preview = CampaignService.preview_campaign_audience(tenant_id, audience_type, custom_ids, branch_id)
        target_customers = CampaignService.fetch_target_customers(tenant_id, audience_type, custom_ids, branch_id)

        campaign = WhatsAppCampaign(
            tenant_id=tenant_id,
            created_by_user_id=user_id,
            title=title,
            template_type=template_type,
            offer_message=offer_message,
            image_url=image_url,
            coupon_code=coupon_code,
            valid_until=valid_until,
            audience_type=audience_type,
            template_name=template_name or None,
            template_params_json=json.dumps(template_params) if template_params else None,
            total_target_customers=preview["total_target_customers"],
            valid_whatsapp_count=preview["valid_whatsapp_count"],
            skipped_count=preview["skipped_count"],
            status="QUEUED"
        )
        db.session.add(campaign)
        db.session.flush()

        # Build Recipient Queue Entries
        for c in target_customers:
            is_opted_out = getattr(c, "whatsapp_opt_out", False)
            phone = (c.phone or "").strip()
            clean = "".join(filter(str.isdigit, phone))

            if is_opted_out:
                rec = WhatsAppCampaignRecipient(
                    tenant_id=tenant_id,
                    campaign_id=campaign.id,
                    customer_id=c.id,
                    customer_name=f"{c.first_name} {c.last_name or ''}".strip(),
                    whatsapp_number=phone or "N/A",
                    status="SKIPPED",
                    failure_reason="Customer Opted Out of Marketing"
                )
            elif not phone or len(clean) < 10:
                rec = WhatsAppCampaignRecipient(
                    tenant_id=tenant_id,
                    campaign_id=campaign.id,
                    customer_id=c.id,
                    customer_name=f"{c.first_name} {c.last_name or ''}".strip(),
                    whatsapp_number=phone or "N/A",
                    status="SKIPPED",
                    failure_reason="Invalid or Missing Phone Number"
                )
            else:
                rec = WhatsAppCampaignRecipient(
                    tenant_id=tenant_id,
                    campaign_id=campaign.id,
                    customer_id=c.id,
                    customer_name=f"{c.first_name} {c.last_name or ''}".strip(),
                    whatsapp_number=phone,
                    status="QUEUED"
                )
            db.session.add(rec)

        db.session.commit()
        return campaign

    @staticmethod
    def process_campaign_batch(campaign_id: int, batch_size: int = 30) -> dict:
        """Executes one batch of message dispatches for a campaign."""
        campaign = WhatsAppCampaign.query.get(campaign_id)
        if not campaign or campaign.status in ["COMPLETED", "CANCELLED"]:
            return {"status": campaign.status if campaign else "NOT_FOUND", "processed": 0}

        tenant_setting = get_tenant_query(WhatsAppSetting).filter_by(tenant_id=campaign.tenant_id).first()
        if not tenant_setting:
            tenant_setting = WhatsAppSetting(
                tenant_id=campaign.tenant_id,
                status="CONNECTED",
                phone_number="+91 98765 43210",
                business_name="Salon WhatsApp Business"
            )

        if campaign.status == "QUEUED":
            campaign.status = "SENDING"
            campaign.started_at = datetime.now(timezone.utc)
            db.session.commit()

        # Fetch queued items for this campaign
        queued_items = WhatsAppCampaignRecipient.query.filter_by(
            campaign_id=campaign_id,
            status="QUEUED"
        ).limit(batch_size).all()

        if not queued_items:
            # Check if all completed
            remaining = WhatsAppCampaignRecipient.query.filter_by(
                campaign_id=campaign_id,
                status="QUEUED"
            ).count()
            if remaining == 0:
                campaign.status = "COMPLETED"
                campaign.completed_at = datetime.now(timezone.utc)
                db.session.commit()
            return {"status": campaign.status, "processed": 0}

        processed_count = 0
        for item in queued_items:
            item.status = "PROCESSING"
            db.session.commit()

            # Compose message with optional coupon and valid until
            body_text = campaign.offer_message
            if campaign.coupon_code:
                body_text += f"\n\n🎁 Coupon Code: {campaign.coupon_code}"
            if campaign.valid_until:
                body_text += f"\n⏰ Valid Until: {campaign.valid_until.strftime('%d %b %Y')}"

            # Parse template params if campaign uses a Meta-approved template
            template_params = []
            if campaign.template_params_json:
                try:
                    template_params = json.loads(campaign.template_params_json) or []
                except (ValueError, TypeError):
                    template_params = []

            # Dispatch message via WhatsAppService
            if campaign.template_type == "IMAGE_WITH_CAPTION" and campaign.image_url:
                res = WhatsAppService.send_image_message(tenant_setting, item.whatsapp_number, campaign.image_url, body_text)
            else:
                res = WhatsAppService.send_text_message(
                    tenant_setting,
                    item.whatsapp_number,
                    body_text,
                    template_name=campaign.template_name or None,
                    template_params=template_params,
                )

            if res["success"]:
                item.status = "SENT"
                item.meta_message_id = res["meta_message_id"]
                item.sent_at = datetime.now(timezone.utc)
                campaign.sent_count += 1
            else:
                item.status = "FAILED"
                item.failure_reason = res.get("error", "Failed to send message.")
                campaign.failed_count += 1

            processed_count += 1
            db.session.commit()

        # Check if queue finished
        remaining_count = WhatsAppCampaignRecipient.query.filter_by(
            campaign_id=campaign_id,
            status="QUEUED"
        ).count()

        if remaining_count == 0:
            campaign.status = "COMPLETED"
            campaign.completed_at = datetime.now(timezone.utc)
            db.session.commit()

        return {
            "status": campaign.status,
            "processed": processed_count,
            "sent_count": campaign.sent_count,
            "failed_count": campaign.failed_count,
            "remaining": remaining_count
        }
