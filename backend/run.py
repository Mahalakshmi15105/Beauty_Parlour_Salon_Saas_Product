import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    # Startup diagnostic to confirm real Meta credentials are loaded
    token = app.config.get("WHATSAPP_PERMANENT_ACCESS_TOKEN", "")
    phone_id = app.config.get("WHATSAPP_PHONE_NUMBER_ID", "")
    waba_id = app.config.get("WHATSAPP_BUSINESS_ACCOUNT_ID", "")
    print("=" * 60)
    print("  SMARTGONEXT SALON BACKEND SERVER")
    print("=" * 60)
    print(f"  Meta Token Loaded: {'YES (' + str(len(token)) + ' chars)' if token else 'NO!'}")
    print(f"  Phone Number ID:   {phone_id or 'MISSING!'}")
    print(f"  WABA ID:           {waba_id or 'MISSING!'}")
    if token and token.startswith("EAA"):
        print("  [ENABLED] LIVE WhatsApp delivery is ENABLED")
    else:
        print("  [WARNING] No live Meta token detected — messages will be SIMULATED")
    print("=" * 60)
    # debug=True enables auto-reload so code changes take effect without manual restart
    app.run(host="0.0.0.0", port=5000, debug=True)
