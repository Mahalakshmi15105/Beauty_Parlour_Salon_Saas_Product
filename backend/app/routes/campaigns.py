import os
import uuid
import logging
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, g, current_app
from app.database import db
from app.models.whatsapp import WhatsAppCampaign, WhatsAppCampaignRecipient
from app.services.campaign_service import CampaignService
from app.utils.auth import require_role, get_tenant_query
from app.utils.responses import success_response, error_response

logger = logging.getLogger(__name__)

campaigns_bp = Blueprint("campaigns", __name__)

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@campaigns_bp.route("/whatsapp/campaigns/preview", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def preview_campaign_audience():
    """Generates recipient breakdown statistics (Total Target, Valid WhatsApp, Skipped Count and Reasons)."""
    data = request.get_json() or {}
    audience_type = data.get("audience_type", "ALL")
    custom_ids = data.get("custom_customer_ids", [])

    branch_id = g.branch_id if g.role == "BranchAdmin" else None
    preview = CampaignService.preview_campaign_audience(g.parlour_id, audience_type, custom_ids, branch_id)
    return success_response(preview)


@campaigns_bp.route("/whatsapp/campaigns/upload-image", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def upload_campaign_image():
    """Uploads a campaign offer image asset and returns static URL."""
    if "image" not in request.files:
        return error_response("UPLOAD_ERROR", "No image file provided in request.", 400)

    file = request.files["image"]
    if file.filename == "":
        return error_response("UPLOAD_ERROR", "No image file selected.", 400)

    if not allowed_file(file.filename):
        return error_response("VALIDATION_ERROR", "Invalid image type. Supported formats: PNG, JPG, JPEG, WEBP.", 400)

    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"campaign_{g.parlour_id}_{uuid.uuid4().hex[:10]}.{ext}"

    upload_folder = os.path.join(current_app.root_path, "static", "uploads", "campaigns")
    os.makedirs(upload_folder, exist_ok=True)

    filepath = os.path.join(upload_folder, filename)
    file.save(filepath)

    rel_url = f"/api/v1/static/uploads/campaigns/{filename}"
    return success_response({"image_url": rel_url, "message": "Campaign image uploaded successfully."})


@campaigns_bp.route("/whatsapp/campaigns/send", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def send_campaign():
    """Creates campaign record, enqueues recipient items, and processes initial batch."""
    data = request.get_json() or {}
    title = data.get("title")
    offer_message = data.get("offer_message")

    if not title or not offer_message:
        return error_response("VALIDATION_ERROR", "Campaign title and offer message are required.", 400)

    try:
        # Create campaign and recipient queue in DB
        branch_id = g.branch_id if g.role == "BranchAdmin" else None
        campaign = CampaignService.create_campaign_and_queue(g.parlour_id, g.user_id, data, branch_id)

        # Process first batch immediately (e.g. 50 items)
        batch_res = CampaignService.process_campaign_batch(campaign.id, batch_size=50)

        return success_response({
            "message": "Campaign enqueued successfully and dispatch started!",
            "campaign": campaign.to_dict(),
            "batch": batch_res
        }, 201)
    except Exception as e:
        logger.error(f"Error creating campaign: {str(e)}")
        return error_response("SERVER_ERROR", f"Failed to create campaign: {str(e)}", 500)


@campaigns_bp.route("/whatsapp/campaigns", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def list_campaigns():
    """Returns paginated list of tenant campaigns."""
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))

    query = get_tenant_query(WhatsAppCampaign).order_by(WhatsAppCampaign.created_at.desc())
    pagination = query.paginate(page=page, per_page=limit, error_out=False)

    return success_response({
        "items": [c.to_dict() for c in pagination.items],
        "total": pagination.total,
        "page": page,
        "pages": pagination.pages
    })


@campaigns_bp.route("/whatsapp/campaigns/<int:campaign_id>", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_campaign_detail(campaign_id):
    """Returns campaign summary and recipient audit drawer entries."""
    campaign = get_tenant_query(WhatsAppCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        return error_response("NOT_FOUND", "Campaign not found.", 404)

    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 100))

    recipients_query = WhatsAppCampaignRecipient.query.filter_by(campaign_id=campaign_id).order_by(WhatsAppCampaignRecipient.id.asc())
    pagination = recipients_query.paginate(page=page, per_page=limit, error_out=False)

    res_data = campaign.to_dict()
    res_data["recipients"] = [r.to_dict() for r in pagination.items]
    res_data["recipients_total"] = pagination.total
    res_data["recipients_page"] = page
    res_data["recipients_pages"] = pagination.pages

    return success_response(res_data)


@campaigns_bp.route("/whatsapp/campaigns/<int:campaign_id>/process", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def process_campaign_step(campaign_id):
    """Processes next batch of queued messages for a running campaign."""
    campaign = get_tenant_query(WhatsAppCampaign).filter_by(id=campaign_id).first()
    if not campaign:
        return error_response("NOT_FOUND", "Campaign not found.", 404)

    batch_res = CampaignService.process_campaign_batch(campaign.id, batch_size=30)
    return success_response({
        "campaign": campaign.to_dict(),
        "batch": batch_res
    })
