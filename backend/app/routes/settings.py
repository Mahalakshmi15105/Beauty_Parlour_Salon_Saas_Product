from flask import Blueprint, request, g
from app.database import db
from app.models.user import TenantSetting
from app.models.global_models import Tenant
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)
settings_bp = Blueprint("settings", __name__)

@settings_bp.route("/settings", methods=["GET"])
@require_role(["ParlourAdmin", "Receptionist", "Employee"])
def get_settings():
    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if not setting:
        # Create default tenant settings if missing
        setting = TenantSetting(tenant_id=g.parlour_id)
        db.session.add(setting)
        db.session.commit()

    tenant = Tenant.query.get(g.parlour_id)

    return success_response({
        "business_profile": {
            "name": tenant.name if tenant else "Beauty Parlour",
            "logo_url": setting.logo_url or "",
            "owner_name": setting.owner_name or "",
            "phone": setting.alternate_phone or "",
            "alternate_phone": setting.alternate_phone or "",
            "email": setting.website or "",
            "gst_number": setting.gst_number or "",
            "address": setting.address or "",
            "city": setting.city or "",
            "state": setting.state or "",
            "country": setting.country or "",
            "postal_code": setting.postal_code or "",
            "website": setting.website or "",
            "description": setting.description or ""
        },
        "invoice_settings": {
            "invoice_prefix": setting.invoice_prefix or "INV",
            "tax_name": setting.tax_name or "GST",
            "tax_rate": float(setting.tax_rate or 18.00),
            "receipt_header": setting.receipt_header or "",
            "receipt_footer": setting.receipt_footer or "",
            "terms_and_conditions": setting.terms_and_conditions or "",
            "show_logo": setting.show_logo if setting.show_logo is not None else True
        },
        "regional_settings": {
            "currency": getattr(setting, "currency_code", None) or setting.currency or "INR",
            "currency_code": getattr(setting, "currency_code", None) or setting.currency or "INR",
            "currency_symbol": setting.currency_symbol or "₹",
            "language": getattr(setting, "language", None) or "English",
            "date_format": setting.date_format or "YYYY-MM-DD",
            "timezone": setting.timezone or "UTC"
        },
        "receipt_settings": {
            "receipt_template": getattr(setting, "receipt_template", "Classic") or "Classic",
            "paper_size": getattr(setting, "paper_size", "80mm") or "80mm",
            "show_logo": getattr(setting, "show_logo", True),
            "show_gst": getattr(setting, "show_gst", True),
            "show_address": getattr(setting, "show_address", True),
            "show_phone": getattr(setting, "show_phone", True),
            "show_email": getattr(setting, "show_email", True),
            "show_website": getattr(setting, "show_website", True),
            "show_qr_code": getattr(setting, "show_qr_code", False),
            "auto_print": getattr(setting, "auto_print", False),
            "thank_you_message": getattr(setting, "thank_you_message", "Thank you for visiting. Please visit again.") or "Thank you for visiting. Please visit again.",
            "receipt_header": setting.receipt_header or "",
            "receipt_footer": setting.receipt_footer or "",
        },
        "theme_settings": {
            "theme_name": getattr(setting, "theme_name", "Default Pink") or "Default Pink",
            "primary_color": getattr(setting, "primary_color", "#EC4899") or "#EC4899",
            "secondary_color": getattr(setting, "secondary_color", "#F472B6") or "#F472B6",
            "accent_color": getattr(setting, "accent_color", "#FDF2F8") or "#FDF2F8"
        },
        "marketing_settings": {
            "churn_days_threshold": getattr(setting, "churn_days_threshold", 45) or 45
        }
    })


@settings_bp.route("/settings", methods=["PUT"])
@require_role(["ParlourAdmin"])
def update_settings():
    data = request.get_json() or {}
    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if not setting:
        setting = TenantSetting(tenant_id=g.parlour_id)
        db.session.add(setting)

    tenant = Tenant.query.get(g.parlour_id)

    biz = data.get("business_profile", {})
    inv = data.get("invoice_settings", {})
    reg = data.get("regional_settings", {})
    rec = data.get("receipt_settings", {})
    thm = data.get("theme_settings", {})
    mkt = data.get("marketing_settings", {})

    try:
        # Update Business Profile
        if tenant and biz.get("name"):
            tenant.name = biz["name"].strip()

        if "logo_url" in biz:
            setting.logo_url = biz.get("logo_url")
        setting.owner_name = biz.get("owner_name")
        setting.alternate_phone = biz.get("phone") or biz.get("alternate_phone")
        setting.gst_number = biz.get("gst_number")
        setting.address = biz.get("address")
        setting.city = biz.get("city")
        setting.state = biz.get("state")
        setting.country = biz.get("country")
        setting.postal_code = biz.get("postal_code")
        setting.website = biz.get("website")
        setting.description = biz.get("description")

        # Update Invoice Settings
        if inv.get("invoice_prefix"):
            setting.invoice_prefix = inv["invoice_prefix"].strip()
        if inv.get("tax_name"):
            setting.tax_name = inv["tax_name"].strip()
        if inv.get("tax_rate") is not None:
            setting.tax_rate = Decimal(str(inv["tax_rate"]))
        setting.receipt_header = inv.get("receipt_header")
        setting.receipt_footer = inv.get("receipt_footer")
        setting.terms_and_conditions = inv.get("terms_and_conditions")
        if inv.get("show_logo") is not None:
            setting.show_logo = bool(inv["show_logo"])

        # Update Regional Settings
        if reg.get("currency") or reg.get("currency_code"):
            curr_code = (reg.get("currency_code") or reg.get("currency")).strip()
            setting.currency = curr_code
            if hasattr(setting, "currency_code"):
                setting.currency_code = curr_code
        if reg.get("currency_symbol"):
            setting.currency_symbol = reg["currency_symbol"].strip()
        if reg.get("language") and hasattr(setting, "language"):
            setting.language = reg["language"].strip()
        if reg.get("date_format"):
            setting.date_format = reg["date_format"].strip()
        if reg.get("timezone"):
            setting.timezone = reg["timezone"].strip()

        # Update Receipt & Printing Settings
        if rec:
            if rec.get("receipt_template"):
                setting.receipt_template = rec["receipt_template"].strip()
            if rec.get("paper_size"):
                setting.paper_size = rec["paper_size"].strip()
            if rec.get("show_logo") is not None:
                setting.show_logo = bool(rec["show_logo"])
            if rec.get("show_gst") is not None:
                setting.show_gst = bool(rec["show_gst"])
            if rec.get("show_address") is not None:
                setting.show_address = bool(rec["show_address"])
            if rec.get("show_phone") is not None:
                setting.show_phone = bool(rec["show_phone"])
            if rec.get("show_email") is not None:
                setting.show_email = bool(rec["show_email"])
            if rec.get("show_website") is not None:
                setting.show_website = bool(rec["show_website"])
            if rec.get("show_qr_code") is not None:
                setting.show_qr_code = bool(rec["show_qr_code"])
            if rec.get("auto_print") is not None:
                setting.auto_print = bool(rec["auto_print"])
            if rec.get("thank_you_message"):
                setting.thank_you_message = rec["thank_you_message"].strip()
            if rec.get("receipt_header"):
                setting.receipt_header = rec["receipt_header"].strip()
            if rec.get("receipt_footer"):
                setting.receipt_footer = rec["receipt_footer"].strip()

        # Update Theme Settings
        if thm:
            if thm.get("theme_name"):
                setting.theme_name = thm["theme_name"].strip()
            if thm.get("primary_color"):
                setting.primary_color = thm["primary_color"].strip()
            if thm.get("secondary_color"):
                setting.secondary_color = thm["secondary_color"].strip()
            if thm.get("accent_color"):
                setting.accent_color = thm["accent_color"].strip()

        # Update Marketing / Churn Settings
        if mkt:
            if mkt.get("churn_days_threshold") is not None:
                try:
                    setting.churn_days_threshold = int(mkt["churn_days_threshold"])
                except ValueError:
                    pass

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update tenant settings: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update settings.",
            status_code=500
        )

    return success_response({"message": "Settings updated successfully."})


@settings_bp.route("/settings/currency", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_currency_setting():
    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if not setting:
        setting = TenantSetting(tenant_id=g.parlour_id)
        db.session.add(setting)
        db.session.commit()

    curr_code = getattr(setting, "currency_code", None) or setting.currency or "INR"
    curr_sym = setting.currency_symbol or "₹"
    return success_response({
        "currency_code": curr_code,
        "currency_symbol": curr_sym,
        "example": f"{curr_sym}1,000.00"
    })


@settings_bp.route("/settings/currency", methods=["PUT"])
@require_role(["ParlourAdmin"])
def update_currency_setting():
    data = request.get_json() or {}
    curr_code = data.get("currency_code") or data.get("currency")
    curr_sym = data.get("currency_symbol")

    if not curr_code or not curr_sym:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Currency code and currency symbol are required.",
            status_code=400
        )

    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if not setting:
        setting = TenantSetting(tenant_id=g.parlour_id)
        db.session.add(setting)

    try:
        setting.currency = curr_code.strip()
        if hasattr(setting, "currency_code"):
            setting.currency_code = curr_code.strip()
        setting.currency_symbol = curr_sym.strip()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update currency settings: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update currency setting.",
            status_code=500
        )

    return success_response({
        "currency_code": setting.currency,
        "currency_symbol": setting.currency_symbol,
        "example": f"{setting.currency_symbol}1,000.00",
        "message": "Currency setting updated successfully."
    })


@settings_bp.route("/settings/language", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_language_setting():
    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if not setting:
        setting = TenantSetting(tenant_id=g.parlour_id)
        db.session.add(setting)
        db.session.commit()

    lang = getattr(setting, "language", None) or "English"
    return success_response({
        "language": lang
    })


@settings_bp.route("/settings/language", methods=["PUT"])
@require_role(["ParlourAdmin"])
def update_language_setting():
    data = request.get_json() or {}
    lang = data.get("language")

    if not lang:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Language choice is required.",
            status_code=400
        )

    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if not setting:
        setting = TenantSetting(tenant_id=g.parlour_id)
        db.session.add(setting)

    try:
        if hasattr(setting, "language"):
            setting.language = lang.strip()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update language setting: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to update language setting.",
            status_code=500
        )

    return success_response({
        "language": getattr(setting, "language", lang),
        "message": "Language setting updated successfully."
    })


import os

ALLOWED_LOGO_EXTENSIONS = {"png", "jpg", "jpeg", "svg", "webp"}
MAX_LOGO_SIZE = 5 * 1024 * 1024  # 5MB

def is_allowed_logo(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_LOGO_EXTENSIONS

@settings_bp.route("/settings/upload-logo", methods=["POST"])
@require_role(["ParlourAdmin"])
def upload_logo():
    if "logo" not in request.files:
        return error_response(
            error_code="MISSING_FILE",
            message="No logo file was provided.",
            status_code=400
        )

    file = request.files["logo"]
    if not file or file.filename == "":
        return error_response(
            error_code="EMPTY_FILE",
            message="No file selected for upload.",
            status_code=400
        )

    if not is_allowed_logo(file.filename):
        return error_response(
            error_code="INVALID_FORMAT",
            message="Invalid image format. Allowed formats: PNG, JPG, JPEG, SVG, and WEBP.",
            status_code=400
        )

    file.seek(0, os.SEEK_END)
    file_length = file.tell()
    file.seek(0)

    if file_length > MAX_LOGO_SIZE:
        return error_response(
            error_code="FILE_TOO_LARGE",
            message="File size exceeds maximum allowed limit of 5 MB.",
            status_code=400
        )

    ext = file.filename.rsplit(".", 1)[1].lower()
    filename = f"logo_tenant_{g.parlour_id}.{ext}"

    static_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "logos")
    os.makedirs(static_folder, exist_ok=True)
    destination = os.path.join(static_folder, filename)
    file.save(destination)

    logo_url = f"/api/v1/static/uploads/logos/{filename}"

    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if not setting:
        setting = TenantSetting(tenant_id=g.parlour_id)
        db.session.add(setting)

    setting.logo_url = logo_url
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to update logo_url in DB: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to save logo in database.",
            status_code=500
        )

    return success_response({
        "message": "Parlour logo uploaded successfully.",
        "logo_url": logo_url
    })


@settings_bp.route("/settings/remove-logo", methods=["DELETE"])
@require_role(["ParlourAdmin"])
def remove_logo():
    setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    if setting:
        setting.logo_url = None
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return error_response("DATABASE_ERROR", "Failed to remove logo.", status_code=500)

    return success_response({"message": "Logo removed successfully.", "logo_url": None})
