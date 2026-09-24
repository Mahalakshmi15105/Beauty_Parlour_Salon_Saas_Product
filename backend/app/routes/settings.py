from flask import Blueprint, request, g
from app.database import db
from app.models.user import TenantSetting
from app.models.global_models import Tenant
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role
from decimal import Decimal
import logging
import os
from PIL import Image
import io

logger = logging.getLogger(__name__)
settings_bp = Blueprint("settings", __name__)

@settings_bp.route("/settings", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"])
def get_settings():
    from app.models.branch import Branch

    # Fetch main parlour settings (branch_id=None)
    main_setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id, branch_id=None).first()
    if not main_setting:
        try:
            main_setting = TenantSetting(tenant_id=g.parlour_id, branch_id=None)
            db.session.add(main_setting)
            db.session.commit()
        except Exception:
            db.session.rollback()
            main_setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id, branch_id=None).first()

    branch = None
    branch_setting = None
    if g.role == "BranchAdmin" and g.branch_id:
        branch = Branch.query.filter_by(id=g.branch_id, tenant_id=g.parlour_id).first()
        branch_setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id, branch_id=g.branch_id).first()

    setting = branch_setting if branch_setting else main_setting
    tenant_name = "Beauty Parlour"
    try:
        with db.get_master_engine().connect() as conn:
            from sqlalchemy import text
            res = conn.execute(text("SELECT name FROM tenants WHERE id = :id AND is_deleted = 0"), {"id": g.parlour_id}).fetchone()
            if res and res[0]:
                tenant_name = res[0]
    except Exception as t_err:
        logger.warning(f"Failed to fetch tenant name from master: {t_err}")

    def _get(attr, default=""):
        val = getattr(setting, attr, None) if setting else None
        if attr == "currency_symbol":
            if not val or str(val).strip() in ["?", "\\u20b9", ""]:
                return "₹"
        return val if val is not None else default

    # Use branch logo if branch has logo; otherwise fallback to main parlour logo
    logo_url = ""
    if branch and branch.logo_url:
        logo_url = branch.logo_url
    elif main_setting and main_setting.logo_url:
        logo_url = main_setting.logo_url

    # Resolve theme: Branch custom theme -> Main Parlour theme -> Default
    theme_name = (branch.theme_name if branch and branch.theme_name else _get("theme_name", "light")) or "light"
    primary_color = (branch.primary_color if branch and branch.primary_color else _get("primary_color", "#EC4899")) or "#EC4899"
    secondary_color = (branch.secondary_color if branch and branch.secondary_color else _get("secondary_color", "#F472B6")) or "#F472B6"
    accent_color = (branch.accent_color if branch and branch.accent_color else _get("accent_color", "#FDF2F8")) or "#FDF2F8"

    # Fetch main branch location details
    main_branch = Branch.query.filter_by(tenant_id=g.parlour_id, is_main_branch=True, is_deleted=False).first()
    if not main_branch:
        main_branch = Branch.query.filter_by(tenant_id=g.parlour_id, is_deleted=False).order_by(Branch.id.asc()).first()

    main_lat = float(main_branch.latitude) if main_branch and main_branch.latitude is not None else None
    main_lng = float(main_branch.longitude) if main_branch and main_branch.longitude is not None else None
    main_radius = main_branch.geofence_radius_meters if main_branch and main_branch.geofence_radius_meters else 100

    return success_response({
        "business_profile": {
            "name": tenant_name,
            "logo_url": logo_url,
            "owner_name": _get("owner_name"),
            "phone": _get("alternate_phone"),
            "alternate_phone": _get("alternate_phone"),
            "email": _get("website"),
            "gst_number": _get("gst_number"),
            "address": _get("address"),
            "city": _get("city"),
            "state": _get("state"),
            "country": _get("country"),
            "postal_code": _get("postal_code"),
            "website": _get("website"),
            "description": _get("description"),
            "latitude": main_lat,
            "longitude": main_lng,
            "geofence_radius_meters": main_radius,
            "shop_name_typography": {
                "enabled": bool(_get("shop_name_font_enabled", False)),
                "font_family": _get("shop_name_font", "Outfit") or "Outfit",
                "font_size": int(_get("shop_name_font_size", 32) or 32),
                "font_weight": str(_get("shop_name_font_weight", "700") or "700"),
                "letter_spacing": float(_get("shop_name_letter_spacing", 0.00) or 0.00)
            }
        },
        "invoice_settings": {
            "invoice_prefix": _get("invoice_prefix", "INV"),
            "tax_name": _get("tax_name", "GST"),
            "tax_rate": float(_get("tax_rate", 18.00)),
            "receipt_header": _get("receipt_header"),
            "receipt_footer": _get("receipt_footer"),
            "terms_and_conditions": _get("terms_and_conditions"),
            "show_logo": bool(_get("show_logo", True))
        },
        "regional_settings": {
            "currency": _get("currency_code", "INR") or _get("currency", "INR"),
            "currency_code": _get("currency_code", "INR") or _get("currency", "INR"),
            "currency_symbol": _get("currency_symbol", "₹"),
            "language": _get("language", "English"),
            "date_format": _get("date_format", "YYYY-MM-DD"),
            "timezone": _get("timezone", "UTC")
        },
        "receipt_settings": {
            "receipt_template": _get("receipt_template", "Classic") or "Classic",
            "paper_size": _get("paper_size", "80mm") or "80mm",
            "show_logo": bool(_get("show_logo", True)),
            "show_gst": bool(_get("show_gst", True)),
            "show_address": bool(_get("show_address", True)),
            "show_phone": bool(_get("show_phone", True)),
            "show_email": bool(_get("show_email", True)),
            "show_website": bool(_get("show_website", True)),
            "show_qr_code": bool(_get("show_qr_code", False)),
            "show_qty": bool(_get("show_qty", True)),
            "show_rate": bool(_get("show_rate", True)),
            "show_mrp": bool(_get("show_mrp", True)),
            "show_tax": bool(_get("show_tax", True)),
            "auto_print": bool(_get("auto_print", False)),
            "thank_you_message": _get("thank_you_message", "Thank you for visiting. Please visit again.") or "Thank you for visiting. Please visit again.",
            "receipt_header": _get("receipt_header"),
            "receipt_footer": _get("receipt_footer"),
        },
        "theme_settings": {
            "theme_name": theme_name,
            "primary_color": primary_color,
            "secondary_color": secondary_color,
            "accent_color": accent_color
        },
        "marketing_settings": {
            "churn_days_threshold": int(_get("churn_days_threshold", 45) or 45)
        },
        "billing_settings": {
            "billing_mode": _get("billing_mode", "normal") or "normal"
        }
    })


@settings_bp.route("/settings", methods=["PUT"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def update_settings():
    from app.models.branch import Branch

    data = request.get_json() or {}
    
    # Target specific branch setting row or main parlour setting row
    target_branch_id = g.branch_id if (g.role == "BranchAdmin" and g.branch_id) else None
    target_setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id, branch_id=target_branch_id).first()
    if not target_setting:
        target_setting = TenantSetting(tenant_id=g.parlour_id, branch_id=target_branch_id)
        db.session.add(target_setting)
    
    settings_list = [target_setting]

    branch = None
    if g.role == "BranchAdmin" and g.branch_id:
        branch = Branch.query.filter_by(id=g.branch_id, tenant_id=g.parlour_id).first()

    biz = data.get("business_profile", {})
    inv = data.get("invoice_settings", {})
    reg = data.get("regional_settings", {})
    rec = data.get("receipt_settings", {})
    thm = data.get("theme_settings", {})
    mkt = data.get("marketing_settings", {})

    try:
        # Update Main Branch Geofence Coordinates if provided in Business Profile
        if g.role == "ParlourAdmin" and ("latitude" in biz or "longitude" in biz or "geofence_radius_meters" in biz):
            mb = Branch.query.filter_by(tenant_id=g.parlour_id, is_main_branch=True, is_deleted=False).first()
            if not mb:
                mb = Branch.query.filter_by(tenant_id=g.parlour_id, is_deleted=False).order_by(Branch.id.asc()).first()
            if mb:
                if "latitude" in biz:
                    try:
                        mb.latitude = float(biz["latitude"]) if biz["latitude"] not in (None, "", "null") else None
                    except (TypeError, ValueError):
                        pass
                if "longitude" in biz:
                    try:
                        mb.longitude = float(biz["longitude"]) if biz["longitude"] not in (None, "", "null") else None
                    except (TypeError, ValueError):
                        pass
                if "geofence_radius_meters" in biz:
                    try:
                        mb.geofence_radius_meters = int(biz["geofence_radius_meters"]) if biz["geofence_radius_meters"] not in (None, "", "null") else 100
                    except (TypeError, ValueError):
                        pass

        # Update Business Profile across tenant setting rows
        for setting in settings_list:
            if "logo_url" in biz and g.role == "ParlourAdmin":
                setting.logo_url = biz.get("logo_url")

            if g.role == "ParlourAdmin" and biz:
                if "owner_name" in biz: setting.owner_name = biz.get("owner_name")
                if "phone" in biz or "alternate_phone" in biz: setting.alternate_phone = biz.get("phone") or biz.get("alternate_phone")
                if "gst_number" in biz: setting.gst_number = biz.get("gst_number")
                if "address" in biz: setting.address = biz.get("address")
                if "city" in biz: setting.city = biz.get("city")
                if "state" in biz: setting.state = biz.get("state")
                if "country" in biz: setting.country = biz.get("country")
                if "postal_code" in biz: setting.postal_code = biz.get("postal_code")
                if "website" in biz: setting.website = biz.get("website")
                if "description" in biz: setting.description = biz.get("description")

            # Update Invoice & Tax Settings
            if inv:
                if "tax_rate" in inv and inv["tax_rate"] is not None:
                    try:
                        setting.tax_rate = Decimal(str(inv["tax_rate"]))
                    except Exception:
                        pass
                if "tax_name" in inv and inv["tax_name"]:
                    setting.tax_name = str(inv["tax_name"]).strip()
                if "invoice_prefix" in inv and inv["invoice_prefix"]:
                    setting.invoice_prefix = str(inv["invoice_prefix"]).strip()
                if "receipt_header" in inv and inv["receipt_header"]:
                    setting.receipt_header = str(inv["receipt_header"]).strip()
                if "receipt_footer" in inv and inv["receipt_footer"]:
                    setting.receipt_footer = str(inv["receipt_footer"]).strip()
                if "terms_and_conditions" in inv and inv["terms_and_conditions"]:
                    setting.terms_and_conditions = str(inv["terms_and_conditions"]).strip()

        # Update Regional Settings across settings_list
        if reg:
            c_code = reg.get("currency_code") or reg.get("currency")
            c_sym = reg.get("currency_symbol")
            c_sym_str = str(c_sym).strip() if c_sym is not None else None
            if c_sym_str is not None and (not c_sym_str or c_sym_str in ["?", "\\u20b9", ""]):
                c_sym_str = "₹"

            for s in settings_list:
                if c_code:
                    s.currency = str(c_code).strip()
                    if hasattr(s, "currency_code"):
                        s.currency_code = str(c_code).strip()
                if c_sym_str is not None:
                    s.currency_symbol = c_sym_str
                if reg.get("language") and hasattr(s, "language"):
                    s.language = str(reg.get("language")).strip()
                if reg.get("date_format") and hasattr(s, "date_format"):
                    s.date_format = str(reg.get("date_format")).strip()
                if reg.get("timezone") and hasattr(s, "timezone"):
                    s.timezone = str(reg.get("timezone")).strip()

        # Update Receipt Settings across settings_list
        if rec:
            for s in settings_list:
                if "receipt_template" in rec:
                    s.receipt_template = rec["receipt_template"]
                if "paper_size" in rec:
                    s.paper_size = rec["paper_size"]
                if "show_logo" in rec:
                    s.show_logo = bool(rec["show_logo"])
                if "show_gst" in rec:
                    s.show_gst = bool(rec["show_gst"])
                if "show_address" in rec:
                    s.show_address = bool(rec["show_address"])
                if "show_phone" in rec:
                    s.show_phone = bool(rec["show_phone"])
                if "show_email" in rec:
                    s.show_email = bool(rec["show_email"])
                if "show_website" in rec:
                    s.show_website = bool(rec["show_website"])
                if "show_qr_code" in rec:
                    s.show_qr_code = bool(rec["show_qr_code"])
                if "show_qty" in rec:
                    s.show_qty = bool(rec["show_qty"])
                if "show_rate" in rec:
                    s.show_rate = bool(rec["show_rate"])
                if "show_mrp" in rec:
                    s.show_mrp = bool(rec["show_mrp"])
                if "show_tax" in rec:
                    s.show_tax = bool(rec["show_tax"])
                if "auto_print" in rec:
                    s.auto_print = bool(rec["auto_print"])
                if "thank_you_message" in rec:
                    s.thank_you_message = rec["thank_you_message"]

        # Update Theme Settings
        if thm:
            if g.role == "BranchAdmin" and branch:
                # Store branch theme directly on Branch record
                if thm.get("theme_name"):
                    branch.theme_name = thm["theme_name"].strip()
                if thm.get("primary_color"):
                    branch.primary_color = thm["primary_color"].strip()
                if thm.get("secondary_color"):
                    branch.secondary_color = thm["secondary_color"].strip()
                if thm.get("accent_color"):
                    branch.accent_color = thm["accent_color"].strip()
            else:
                # ParlourAdmin updates Main Parlour theme settings
                for s in settings_list:
                    if thm.get("theme_name"):
                        s.theme_name = thm["theme_name"].strip()
                    if thm.get("primary_color"):
                        s.primary_color = thm["primary_color"].strip()
                    if thm.get("secondary_color"):
                        s.secondary_color = thm["secondary_color"].strip()
                    if thm.get("accent_color"):
                        s.accent_color = thm["accent_color"].strip()

        # Update Billing Settings
        bil = data.get("billing_settings", {})
        if bil:
            if "billing_mode" in bil and bil["billing_mode"]:
                target_setting.billing_mode = str(bil["billing_mode"]).strip().lower()

        db.session.commit()

        try:
            with db.get_engine().connect() as conn:
                from sqlalchemy import text
                conn.execute(text("ALTER TABLE tenant_settings MODIFY COLUMN currency_symbol VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                conn.execute(text("UPDATE tenant_settings SET currency_symbol = '₹' WHERE currency_symbol = '?' OR currency_symbol IS NULL OR currency_symbol = '' OR currency_symbol = '?'"))
                conn.commit()
        except Exception as e:
            logger.warning(f"Charset auto-fix notice: {e}")

        # Update Tenant Name in master DB separately
        if g.role == "ParlourAdmin" and biz.get("name"):
            try:
                with db.get_master_engine().begin() as conn:
                    from sqlalchemy import text
                    conn.execute(text("UPDATE tenants SET name = :name WHERE id = :id"), {"name": biz["name"].strip(), "id": g.parlour_id})
            except Exception as t_err:
                logger.error(f"Failed to update tenant master name: {t_err}")
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
@require_role(["ParlourAdmin", "BranchAdmin"])
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
@require_role(["ParlourAdmin", "BranchAdmin"])
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
@require_role(["ParlourAdmin", "BranchAdmin"])
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
@require_role(["ParlourAdmin", "BranchAdmin"])
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
MIN_LOGO_SIZE = 1024  # 1KB minimum to prevent corrupted uploads

def is_allowed_logo(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_LOGO_EXTENSIONS

def is_valid_image(file):
    """Verify the uploaded file is a valid image by attempting to open it with PIL"""
    try:
        file.seek(0)
        image_bytes = file.read()
        file.seek(0)
        
        # Check minimum file size
        if len(image_bytes) < MIN_LOGO_SIZE:
            return False, "File is too small. Please upload a valid image file."
        
        # Try to open with PIL to verify it's a valid image
        if file.filename.lower().endswith('.svg'):
            # SVG files are text-based, handle differently
            try:
                image_bytes.decode('utf-8')
                return True, None
            except UnicodeDecodeError:
                return False, "Invalid SVG file."
        else:
            # For raster images, use PIL to verify
            try:
                img = Image.open(io.BytesIO(image_bytes))
                img.verify()
                # Re-open after verify (verify closes the image)
                img = Image.open(io.BytesIO(image_bytes))
                # Check if image has reasonable dimensions
                if img.width < 32 or img.height < 32:
                    return False, "Image dimensions too small. Minimum 32x32 pixels required."
                return True, None
            except Exception as e:
                return False, f"Invalid image file: {str(e)}"
    except Exception as e:
        return False, f"Error validating image: {str(e)}"

@settings_bp.route("/settings/upload-logo", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
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

    # Validate the image is not corrupted
    is_valid, error_msg = is_valid_image(file)
    if not is_valid:
        return error_response(
            error_code="INVALID_IMAGE",
            message=error_msg,
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

    if file_length < MIN_LOGO_SIZE:
        return error_response(
            error_code="FILE_TOO_SMALL",
            message=f"File is too small ({file_length} bytes). Please upload a valid image file.",
            status_code=400
        )

    logger.info(f"Uploading logo: {file.filename}, size: {file_length} bytes")

    ext = file.filename.rsplit(".", 1)[1].lower()

    if g.role == "BranchAdmin" and g.branch_id:
        filename = f"logo_branch_{g.branch_id}.{ext}"
    else:
        filename = f"logo_tenant_{g.parlour_id}.{ext}"

    static_folder = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads", "logos")
    os.makedirs(static_folder, exist_ok=True)
    destination = os.path.join(static_folder, filename)

    if os.path.exists(destination):
        try:
            os.remove(destination)
        except Exception as e:
            logger.warning(f"Could not remove old file: {e}")

    file.save(destination)
    logger.info(f"Saved logo file to {destination}")

    logo_url = f"/api/v1/static/uploads/logos/{filename}"

    try:
        if g.role == "BranchAdmin" and g.branch_id:
            from app.models.branch import Branch
            branch = Branch.query.filter_by(id=g.branch_id, tenant_id=g.parlour_id).first()
            if branch:
                branch.logo_url = logo_url
        else:
            setting = TenantSetting.query.filter_by(tenant_id=g.parlour_id, branch_id=None).first()
            if not setting:
                setting = TenantSetting(tenant_id=g.parlour_id, branch_id=None)
                db.session.add(setting)
            setting.logo_url = logo_url
        
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
@require_role(["ParlourAdmin", "BranchAdmin"])
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
