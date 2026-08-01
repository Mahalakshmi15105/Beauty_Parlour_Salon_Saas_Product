"""Tests the running backend server's /whatsapp/send-message endpoint to verify LIVE delivery.

This tells us whether the RUNNING server has loaded the new config.py (real token)
or is still running old code (empty token -> simulated).
"""
import json
import os
import sys
import requests
from dotenv import load_dotenv

# Load env for local use
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path)

BASE = "http://localhost:5000/api/v1"

def get_token():
    """Login to get a JWT for the ParlourAdmin demo account."""
    resp = requests.post(
        f"{BASE}/auth/login",
        json={"email": "admin@smartgonext.com", "password": "ParlourAdmin123!"},
        timeout=10,
    )
    data = resp.json()
    if not data.get("success"):
        print(f"[LOGIN FAILED] {data.get('message', resp.text)}")
        return None
    return data["data"]["token"]

def main():
    token = get_token()
    if not token:
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}

    # 1. Check what settings the server currently has
    print("\n[1] Fetching current WhatsApp settings from running server...")
    resp = requests.get(f"{BASE}/whatsapp/settings", headers=headers, timeout=10)
    settings = resp.json().get("data", {})
    print(f"    Status: {settings.get('status')}")
    print(f"    Business: {settings.get('business_name')}")
    print(f"    Phone: {settings.get('phone_number')}")
    print(f"    Phone ID: {settings.get('meta_phone_number_id')}")
    print(f"    WABA ID: {settings.get('meta_waba_id')}")

    # 2. Send a test message through the running server
    print("\n[2] Sending test message via running server...")
    resp = requests.post(
        f"{BASE}/whatsapp/send-message",
        headers=headers,
        json={
            "phone_number": "+91 9655321915",
            "message": "LIVE SERVER TEST - Salon Software",
        },
        timeout=20,
    )
    data = resp.json()
    if data.get("success"):
        send_data = data["data"]
        print(f"    Message: {send_data.get('message')}")
        print(f"    Mode: {send_data.get('mode')}")
        print(f"    Status: {send_data.get('status')}")
        print(f"    Meta ID: {send_data.get('meta_message_id')}")
        print(f"    Note: {send_data.get('note', '')}")
        if send_data.get("mode") in ("LIVE", "LIVE_TEMPLATE"):
            print("\n    ✅ RUNNING SERVER IS SENDING LIVE MESSAGES!")
        else:
            print("\n    ⚠️ RUNNING SERVER IS IN SIMULATED MODE - SERVER NEEDS RESTART!")
    else:
        print(f"    [SEND FAILED] {data.get('message')}")

if __name__ == "__main__":
    main()