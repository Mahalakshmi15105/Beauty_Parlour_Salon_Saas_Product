"""
Storage & Google Drive Management Routes
========================================
Provides API endpoints for Google Drive OAuth2 connection, folder provisioning,
status checking, and optimized WebP image uploading to Drive folders.
"""

import time
import uuid
import logging
from flask import Blueprint, request, g, current_app
from app.database import db
from app.models.user import TenantSetting
from app.models.branch import Branch
from app.utils.auth import require_role
from app.utils.responses import success_response, error_response
from app.services.google_drive_service import (
    generate_auth_url,
    exchange_code,
    provision_salon_folders,
    upload_image_to_drive,
    disconnect_google_drive
)
from app.services.image_service import optimize_and_convert_to_webp

logger = logging.getLogger(__name__)

storage_bp = Blueprint("storage", __name__)


def _get_or_create_tenant_setting():
    """Helper to retrieve or initialize tenant setting for current tenant/branch context."""
    tenant_id = getattr(g, "parlour_id", None) or getattr(g, "tenant_id", None)
    if not tenant_id:
        raise ValueError("Tenant context not found in request.")

    setting = TenantSetting.query.filter_by(tenant_id=tenant_id).first()
    if not setting:
        setting = TenantSetting(tenant_id=tenant_id)
        db.session.add(setting)
        db.session.commit()
    return setting


@storage_bp.route("/storage/google-drive/status", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_drive_status():
    """Returns current Google Drive connection and folder structure status."""
    try:
        setting = _get_or_create_tenant_setting()

        return success_response({
            "connected": bool(setting.google_drive_enabled and setting.google_drive_refresh_token),
            "email": setting.google_drive_email,
            "root_folder_id": setting.google_drive_root_folder_id,
            "services_folder_id": setting.google_drive_services_folder_id,
            "products_folder_id": setting.google_drive_products_folder_id,
            "logos_folder_id": setting.google_drive_logos_folder_id,
            "campaigns_folder_id": setting.google_drive_campaigns_folder_id,
            "has_custom_credentials": bool(setting.google_client_id and setting.google_client_secret),
            "google_client_id": setting.google_client_id or "",
        })
    except Exception as e:
        logger.error(f"Error fetching Google Drive status: {str(e)}")
        return error_response("STORAGE_ERROR", f"Failed to get storage status: {str(e)}", 500)


@storage_bp.route("/storage/google-drive/auth-url", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_drive_auth_url():
    """Generates the Google OAuth2 authorization URL."""
    try:
        tenant_id = getattr(g, "parlour_id", None) or getattr(g, "tenant_id", None)
        redirect_uri = request.args.get("redirect_uri") or current_app.config.get("GOOGLE_REDIRECT_URI")
        
        setting = _get_or_create_tenant_setting()
        auth_url = generate_auth_url(tenant_id, redirect_uri, tenant_setting=setting)

        return success_response({
            "auth_url": auth_url,
            "redirect_uri": redirect_uri
        })
    except ValueError as ve:
        return error_response("CONFIG_ERROR", str(ve), 400)
    except Exception as e:
        logger.error(f"Error generating Google Drive auth URL: {str(e)}")
        return error_response("AUTH_URL_ERROR", f"Failed to generate authorization URL: {str(e)}", 500)


@storage_bp.route("/storage/google-drive/callback", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def handle_drive_callback():
    """Exchanges Google auth code for tokens and auto-provisions media folders."""
    try:
        data = request.get_json() or {}
        code = data.get("code")
        redirect_uri = data.get("redirect_uri") or current_app.config.get("GOOGLE_REDIRECT_URI")

        if not code:
            return error_response("VALIDATION_ERROR", "Authorization code is required.", 400)

        setting = _get_or_create_tenant_setting()
        
        # 1. Exchange authorization code
        tokens = exchange_code(code, redirect_uri, tenant_setting=setting)
        
        # 2. Save tokens in DB
        setting.google_drive_enabled = True
        setting.google_drive_access_token = tokens["access_token"]
        if tokens.get("refresh_token"):
            setting.google_drive_refresh_token = tokens["refresh_token"]
        from datetime import datetime, timedelta
        setting.google_drive_token_expiry = datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        setting.google_drive_email = tokens.get("email") or setting.google_drive_email
        db.session.commit()

        # 3. Retrieve salon name for folder creation
        salon_name = "Salon"
        try:
            branch = Branch.query.filter_by(tenant_id=setting.tenant_id).first()
            if branch and branch.name:
                salon_name = branch.name
        except Exception:
            pass

        # 4. Auto-provision folders in Google Drive
        folder_info = provision_salon_folders(setting, salon_name=salon_name)

        return success_response({
            "message": "Google Drive connected and folders created successfully.",
            "email": setting.google_drive_email,
            "folders": folder_info,
            "connected": True
        })
    except ValueError as ve:
        return error_response("GOOGLE_AUTH_FAILED", str(ve), 400)
    except Exception as e:
        logger.error(f"Error connecting Google Drive: {str(e)}")
        return error_response("DRIVE_CONNECT_ERROR", f"Failed to complete Google Drive setup: {str(e)}", 500)


@storage_bp.route("/storage/google-drive/credentials", methods=["POST"])
@require_role(["ParlourAdmin"])
def save_custom_credentials():
    """Save custom Google Cloud OAuth Client ID & Secret for the tenant."""
    try:
        data = request.get_json() or {}
        client_id = (data.get("google_client_id") or "").strip()
        client_secret = (data.get("google_client_secret") or "").strip()

        setting = _get_or_create_tenant_setting()
        setting.google_client_id = client_id if client_id else None
        setting.google_client_secret = client_secret if client_secret else None
        db.session.commit()

        return success_response({
            "message": "Google OAuth credentials updated successfully.",
            "has_custom_credentials": bool(client_id and client_secret)
        })
    except Exception as e:
        logger.error(f"Error saving Google OAuth credentials: {str(e)}")
        return error_response("CONFIG_ERROR", f"Failed to save credentials: {str(e)}", 500)


@storage_bp.route("/storage/google-drive/disconnect", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def disconnect_drive():
    """Disconnects Google Drive integration for this parlour."""
    try:
        setting = _get_or_create_tenant_setting()
        disconnect_google_drive(setting)
        return success_response({"message": "Google Drive disconnected successfully.", "connected": False})
    except Exception as e:
        logger.error(f"Error disconnecting Google Drive: {str(e)}")
        return error_response("DISCONNECT_ERROR", f"Failed to disconnect Google Drive: {str(e)}", 500)


@storage_bp.route("/storage/upload-image", methods=["POST"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def upload_image():
    """
    Validates Google Drive connection, converts image to WebP,
    and uploads directly to Google Drive under the category folder.
    """
    try:
        setting = _get_or_create_tenant_setting()

        # 1. Validation check: Is Google Drive connected?
        if not setting.google_drive_enabled or not setting.google_drive_refresh_token:
            return error_response(
                "GOOGLE_DRIVE_NOT_CONNECTED",
                "Google Drive storage is not connected. Please connect your Google Drive in Settings to upload images.",
                400
            )

        # 2. Extract file from request
        file = request.files.get("image") or request.files.get("file")
        if not file or not file.filename:
            return error_response("VALIDATION_ERROR", "No image file provided for upload.", 400)

        category = request.form.get("category", "general").strip().lower()
        if category not in ("services", "products", "logos", "campaigns", "general"):
            category = "general"

        raw_input = file.read()
        if len(raw_input) == 0:
            return error_response("VALIDATION_ERROR", "The uploaded image file is empty.", 400)

        # 3. Optimize and Convert to WebP
        webp_res = optimize_and_convert_to_webp(raw_input, category=category, quality=82)
        
        # 4. Generate unique filename
        timestamp = int(time.time())
        rand_id = uuid.uuid4().hex[:6]
        filename = f"{category}_{timestamp}_{rand_id}.webp"

        # 5. Upload to Google Drive
        drive_result = upload_image_to_drive(
            tenant_setting=setting,
            raw_bytes=webp_res["raw_bytes"],
            filename=filename,
            category=category
        )

        return success_response({
            "message": "Image optimized to WebP and uploaded to Google Drive successfully.",
            "image_url": drive_result["image_url"],
            "direct_image_url": drive_result["direct_image_url"],
            "web_view_link": drive_result["web_view_link"],
            "file_id": drive_result["file_id"],
            "filename": filename,
            "format": "webp",
            "width": webp_res["width"],
            "height": webp_res["height"],
            "size_bytes": webp_res["size"],
            "original_size_bytes": len(raw_input),
            "category": category
        })
    except ValueError as ve:
        return error_response("UPLOAD_FAILED", str(ve), 400)
    except Exception as e:
        logger.error(f"Error during image upload to Google Drive: {str(e)}")
        return error_response("SERVER_ERROR", f"Failed to upload image: {str(e)}", 500)
