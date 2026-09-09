"""
Phusion Passenger WSGI Entry Point
===================================
This file is used by Phusion Passenger (cPanel / Plesk / CloudLinux
shared hosting) to serve the Flask application.

Passenger looks for a WSGI callable named `application` in this file.

How it works:
  1. Passenger loads this file on startup.
  2. `application` is the Flask app instance.
  3. Passenger handles all HTTP requests and routes them to Flask.

Single-Thread + Auto-Sleep:
  - Passenger runs the app in its own process model.
  - `.htaccess` sets `PassengerMaxPoolSize 1` -> only ONE process.
  - The auto-sleep monitor (app/services/auto_sleep.py) terminates
    the process after AUTO_SLEEP_MINUTES of inactivity.
  - `PassengerMaxRequests 1` restarts the process after each request,
    killing all threads.
"""
import os
import sys
import logging

os.environ["IN_PASSENGER"] = "true"

# Ensure the backend directory is on the Python path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s",
)
logger = logging.getLogger(__name__)


def _create_application():
    """
    Create the Flask application.

    Robust against temporary database unavailability:
    - If the database is reachable, return the full app.
    - If the database is NOT reachable (e.g. on first deploy before
      the DB user is provisioned), return a minimal Flask app that
      responds 503 with a clear diagnostic. Once the DB becomes
      available, Passenger's restart (PassengerMaxRequests 1) will
      load the full app.
    """
    try:
        from app import create_app
        from app.database import db
        app_instance = create_app()
        # Cleanly dispose pooled connection initialized during startup so child WSGI workers create fresh connections
        try:
            with app_instance.app_context():
                db.engine.dispose()
        except Exception:
            pass
        return app_instance
    except Exception as exc:
        error_message = str(exc)
        logger.error(f"Failed to create full application: {error_message}")
        logger.error("Returning degraded app; will retry on next Passenger restart.")

        from flask import Flask, jsonify
        from flask_cors import CORS

        degraded = Flask(__name__)
        # Allow CORS on the degraded app too
        CORS(degraded, resources={r"/*": {"origins": "*"}})

        @degraded.route("/")
        @degraded.route("/api/v1/health")
        def health():
            return jsonify({
                "success": True,
                "status": "degraded",
                "message": "Application loaded, but database is unreachable. "
                           "Check DATABASE_URL in .env and MySQL credentials.",
                "error": error_message,
            }), 503

        @degraded.errorhandler(Exception)
        def handle_error(err):
            return jsonify({
                "success": False,
                "error_code": "STARTUP_FAILED",
                "message": str(err),
            }), 500

        return degraded


# WSGI callable object required by Phusion Passenger
application = _create_application()

# Alias for compatibility with some cPanel / Plesk configurations
app = application

if __name__ == "__main__":
    # For local testing: python passenger_wsgi.py
    application.run(host="0.0.0.0", port=5000, threaded=False)