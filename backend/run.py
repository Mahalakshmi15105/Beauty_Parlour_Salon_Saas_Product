import os
import sys
from app import create_app
from app.config import Config

app = create_app()

def run_production():
    """Production server using Waitress - SINGLE THREAD only."""
    from waitress import serve

    threads = Config.THREADS  # 1 when SINGLE_THREAD=true (default)
    print("=" * 60)
    print("  SMARTGONEXT SALON BACKEND SERVER  [PRODUCTION]")
    print("=" * 60)
    print(f"  Mode:             SINGLE-THREAD ({threads} thread{'s' if threads != 1 else ''})")
    print(f"  Auto-Sleep:       {'ENABLED' if Config.AUTO_SLEEP_ENABLED else 'DISABLED'}")
    if Config.AUTO_SLEEP_ENABLED:
        print(f"  Sleep After:      {Config.AUTO_SLEEP_MINUTES} minute(s) of inactivity")
    print(f"  Host:Port:        0.0.0.0:{Config.PORT}")
    print("=" * 60)

    serve(
        app,
        host="0.0.0.0",
        port=Config.PORT,
        threads=threads,
        channel_timeout=300,
        max_request_body_size=1073741824,  # 1 GB uploads
    )


def run_development():
    """Development server - Flask built-in, single-threaded (threaded=False)."""
    print("=" * 60)
    print("  SMARTGONEXT SALON BACKEND SERVER  [DEVELOPMENT]")
    print("=" * 60)
    print("  Mode:             SINGLE-THREAD (1 thread serves all users)")
    print(f"  Auto-Sleep:       {'ENABLED' if Config.AUTO_SLEEP_ENABLED else 'DISABLED'}")
    if Config.AUTO_SLEEP_ENABLED:
        print(f"  Sleep After:      {Config.AUTO_SLEEP_MINUTES} minute(s) of inactivity")
    print("=" * 60)

    app.run(
        host="0.0.0.0",
        port=Config.PORT,
        debug=True,
        threaded=True,   # <-- Enable multi-threading for concurrent requests
        use_reloader=False,
    )


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

    # Production vs Development
    if Config.ENVIRONMENT == "production":
        run_production()
    else:
        run_development()