"""
Google Drive Cloud Media Storage Service
========================================
Handles Google Drive OAuth2 token exchange, automatic token refresh,
hierarchical folder provisioning (Services, Products, Logos, Campaigns),
and direct public image uploads via Google Drive API v3.
"""

import json
import logging
import urllib.parse
from datetime import datetime, timedelta
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from flask import current_app
from app.database import db

logger = logging.getLogger(__name__)

GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
GOOGLE_UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3"

SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email"
]

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Connection": "close"
}


def _get_http_session():
    """Returns a requests Session with automated retries and robust headers."""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def _make_google_request(method, url, **kwargs):
    """Executes an HTTP request to Google API with robust session management and error handling."""
    session = _get_http_session()
    headers = dict(DEFAULT_HEADERS)
    if "headers" in kwargs:
        headers.update(kwargs.pop("headers"))
    
    timeout = kwargs.pop("timeout", 25)
    return session.request(method, url, headers=headers, timeout=timeout, **kwargs)


def _get_oauth_credentials(tenant_setting=None):
    """Retrieve Google OAuth Client ID and Secret (Tenant level or System Config)."""
    client_id = ""
    client_secret = ""

    if tenant_setting:
        client_id = tenant_setting.google_client_id or ""
        client_secret = tenant_setting.google_client_secret or ""

    if not client_id:
        client_id = current_app.config.get("GOOGLE_CLIENT_ID", "")
    if not client_secret:
        client_secret = current_app.config.get("GOOGLE_CLIENT_SECRET", "")

    return client_id.strip(), client_secret.strip()


def generate_auth_url(tenant_id, redirect_uri, tenant_setting=None):
    """Generates the Google OAuth2 authorization URL with offline access."""
    client_id, _ = _get_oauth_credentials(tenant_setting)
    if not client_id:
        raise ValueError("Google Client ID is not configured. Please configure it in Settings or environment.")

    state_data = json.dumps({"tenant_id": tenant_id})
    state_param = urllib.parse.quote(state_data)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",  # Ensures refresh token is always returned
        "state": state_param,
        "include_granted_scopes": "true",
    }
    query_string = urllib.parse.urlencode(params)
    return f"{GOOGLE_AUTH_BASE}?{query_string}"


def exchange_code(code, redirect_uri, tenant_setting=None):
    """Exchanges authorization code for access and refresh tokens."""
    client_id, client_secret = _get_oauth_credentials(tenant_setting)
    if not client_id or not client_secret:
        raise ValueError("Google Client ID and Secret must be configured.")

    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    resp = _make_google_request("POST", GOOGLE_TOKEN_URL, data=payload, timeout=25)
    if not resp.ok:
        logger.error(f"Failed to exchange Google OAuth code: {resp.text}")
        raise ValueError(f"Google authorization failed: {resp.text}")

    token_data = resp.json()
    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    expires_in = token_data.get("expires_in", 3600)

    # Fetch user's Google email
    email = ""
    try:
        userinfo_resp = _make_google_request(
            "GET",
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=15
        )
        if userinfo_resp.ok:
            email = userinfo_resp.json().get("email", "")
    except Exception as e:
        logger.warning(f"Could not fetch Google userinfo email: {e}")

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        "email": email,
    }


def get_valid_access_token(tenant_setting):
    """Returns a valid access token, auto-refreshing if expired."""
    if not tenant_setting.google_drive_enabled or not tenant_setting.google_drive_refresh_token:
        raise ValueError("Google Drive is not connected for this parlour.")

    now = datetime.utcnow()
    # If token exists and hasn't expired (with 2 min buffer), return it
    if (
        tenant_setting.google_drive_access_token
        and tenant_setting.google_drive_token_expiry
        and tenant_setting.google_drive_token_expiry > now + timedelta(minutes=2)
    ):
        return tenant_setting.google_drive_access_token

    # Token needs refresh
    client_id, client_secret = _get_oauth_credentials(tenant_setting)
    if not client_id or not client_secret:
        raise ValueError("Google Client ID or Secret is missing for token refresh.")

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": tenant_setting.google_drive_refresh_token,
        "grant_type": "refresh_token",
    }

    resp = _make_google_request("POST", GOOGLE_TOKEN_URL, data=payload, timeout=25)
    if not resp.ok:
        logger.error(f"Failed to refresh Google access token: {resp.text}")
        raise ValueError(f"Failed to refresh Google Drive access token. Please re-authorize: {resp.text}")

    token_data = resp.json()
    new_access_token = token_data.get("access_token")
    expires_in = token_data.get("expires_in", 3600)

    tenant_setting.google_drive_access_token = new_access_token
    tenant_setting.google_drive_token_expiry = now + timedelta(seconds=expires_in)
    db.session.commit()

    return new_access_token


def _create_or_get_folder(access_token, folder_name, parent_id=None):
    """Finds an existing folder by name (and parent) or creates a new one."""
    headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
    
    # Check if folder exists
    query = f"mimeType = 'application/vnd.google-apps.folder' and name = '{folder_name}' and trashed = false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
    
    search_resp = _make_google_request(
        "GET",
        f"{GOOGLE_DRIVE_API_BASE}/files",
        headers=headers,
        params={"q": query, "fields": "files(id, name)"},
        timeout=20
    )

    if search_resp.ok:
        files = search_resp.json().get("files", [])
        if files:
            return files[0]["id"]

    # Create folder if not found
    folder_metadata = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        folder_metadata["parents"] = [parent_id]

    create_resp = _make_google_request(
        "POST",
        f"{GOOGLE_DRIVE_API_BASE}/files",
        headers=headers,
        json=folder_metadata,
        timeout=20
    )

    if not create_resp.ok:
        raise ValueError(f"Failed to create Google Drive folder '{folder_name}': {create_resp.text}")

    return create_resp.json().get("id")


def provision_salon_folders(tenant_setting, salon_name="Salon"):
    """
    Ensures root folder and sub-folders (Services, Products, Logos, Campaigns) exist
    and updates tenant_setting with their IDs.
    """
    token = get_valid_access_token(tenant_setting)
    clean_name = "".join(c for c in salon_name if c.isalnum() or c in (" ", "_", "-")).strip() or "Salon"
    root_folder_name = f"SalonMedia_{clean_name}"

    # 1. Root folder
    root_id = _create_or_get_folder(token, root_folder_name)
    tenant_setting.google_drive_root_folder_id = root_id

    # 2. Sub-folders
    services_id = _create_or_get_folder(token, "Services", parent_id=root_id)
    products_id = _create_or_get_folder(token, "Products", parent_id=root_id)
    logos_id = _create_or_get_folder(token, "Logos", parent_id=root_id)
    campaigns_id = _create_or_get_folder(token, "Campaigns", parent_id=root_id)

    tenant_setting.google_drive_services_folder_id = services_id
    tenant_setting.google_drive_products_folder_id = products_id
    tenant_setting.google_drive_logos_folder_id = logos_id
    tenant_setting.google_drive_campaigns_folder_id = campaigns_id

    db.session.commit()
    logger.info(f"Provisioned Google Drive folders for tenant {tenant_setting.tenant_id} under root '{root_folder_name}' ({root_id})")

    return {
        "root_id": root_id,
        "root_folder_name": root_folder_name,
        "services_id": services_id,
        "products_id": products_id,
        "logos_id": logos_id,
        "campaigns_id": campaigns_id,
    }


def upload_image_to_drive(tenant_setting, raw_bytes, filename, category="general"):
    """
    Uploads an image (WebP) to the appropriate Google Drive folder, sets public read permission,
    and returns direct embeddable preview URLs.
    """
    token = get_valid_access_token(tenant_setting)

    # Determine target folder ID
    folder_id = tenant_setting.google_drive_root_folder_id
    cat_lower = category.lower()
    if cat_lower == "services" and tenant_setting.google_drive_services_folder_id:
        folder_id = tenant_setting.google_drive_services_folder_id
    elif cat_lower == "products" and tenant_setting.google_drive_products_folder_id:
        folder_id = tenant_setting.google_drive_products_folder_id
    elif cat_lower == "logos" and tenant_setting.google_drive_logos_folder_id:
        folder_id = tenant_setting.google_drive_logos_folder_id
    elif cat_lower == "campaigns" and tenant_setting.google_drive_campaigns_folder_id:
        folder_id = tenant_setting.google_drive_campaigns_folder_id

    # If folder IDs are missing, provision now
    if not folder_id:
        folders = provision_salon_folders(tenant_setting)
        folder_id = folders.get(f"{cat_lower}_id") or folders.get("root_id")

    # Multipart upload to Google Drive API v3
    metadata = {
        "name": filename,
        "mimeType": "image/webp",
        "parents": [folder_id] if folder_id else []
    }

    files = {
        "data": ("metadata", json.dumps(metadata), "application/json; charset=UTF-8"),
        "file": (filename, raw_bytes, "image/webp")
    }

    upload_resp = _make_google_request(
        "POST",
        f"{GOOGLE_UPLOAD_API_BASE}/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink",
        headers={"Authorization": f"Bearer {token}"},
        files=files,
        timeout=45
    )

    if not upload_resp.ok:
        logger.error(f"Google Drive upload failed: {upload_resp.text}")
        raise ValueError(f"Failed to upload image to Google Drive: {upload_resp.text}")

    upload_result = upload_resp.json()
    file_id = upload_result.get("id")

    # Set public permission (anyone with link can view)
    try:
        _make_google_request(
            "POST",
            f"{GOOGLE_DRIVE_API_BASE}/files/{file_id}/permissions",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"role": "reader", "type": "anyone"},
            timeout=15
        )
    except Exception as e:
        logger.warning(f"Could not set public permission on Drive file {file_id}: {e}")

    # High-speed direct image embed URL
    direct_image_url = f"https://lh3.googleusercontent.com/d/{file_id}"
    web_view_link = upload_result.get("webViewLink", f"https://drive.google.com/file/d/{file_id}/view")

    logger.info(f"Image uploaded to Google Drive: {filename} (ID: {file_id})")

    return {
        "file_id": file_id,
        "filename": filename,
        "image_url": direct_image_url,
        "direct_image_url": direct_image_url,
        "web_view_link": web_view_link,
        "folder_id": folder_id,
        "category": category,
        "format": "webp"
    }


def disconnect_google_drive(tenant_setting):
    """Disconnects Google Drive and resets stored folder metadata."""
    tenant_setting.google_drive_enabled = False
    tenant_setting.google_drive_access_token = None
    tenant_setting.google_drive_refresh_token = None
    tenant_setting.google_drive_token_expiry = None
    tenant_setting.google_drive_email = None
    db.session.commit()
    return True
