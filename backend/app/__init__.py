import os
import logging
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.database import db, migrate
from app.utils.responses import error_response
import app.models

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
)

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})
    db.init_app(app)
    migrate.init_app(app, db)
    with app.app_context():
        alters = [
            "ALTER TABLE tenant_settings ADD COLUMN logo_url VARCHAR(255) NULL",
            "ALTER TABLE tenant_settings ADD COLUMN receipt_template VARCHAR(50) NOT NULL DEFAULT 'Classic'",
            "ALTER TABLE tenant_settings ADD COLUMN paper_size VARCHAR(20) NOT NULL DEFAULT '80mm'",
            "ALTER TABLE tenant_settings ADD COLUMN show_gst TINYINT(1) NOT NULL DEFAULT 1",
            "ALTER TABLE tenant_settings ADD COLUMN show_address TINYINT(1) NOT NULL DEFAULT 1",
            "ALTER TABLE tenant_settings ADD COLUMN show_phone TINYINT(1) NOT NULL DEFAULT 1",
            "ALTER TABLE tenant_settings ADD COLUMN show_email TINYINT(1) NOT NULL DEFAULT 1",
            "ALTER TABLE tenant_settings ADD COLUMN show_website TINYINT(1) NOT NULL DEFAULT 1",
            "ALTER TABLE tenant_settings ADD COLUMN show_qr_code TINYINT(1) NOT NULL DEFAULT 0",
            "ALTER TABLE tenant_settings ADD COLUMN auto_print TINYINT(1) NOT NULL DEFAULT 0",
            "ALTER TABLE tenant_settings ADD COLUMN thank_you_message VARCHAR(255) NULL DEFAULT 'Thank you for visiting. Please visit again.'",
            "ALTER TABLE tenant_settings ADD COLUMN theme_name VARCHAR(50) NOT NULL DEFAULT 'Default Pink'",
            "ALTER TABLE tenant_settings ADD COLUMN primary_color VARCHAR(30) NOT NULL DEFAULT '#EC4899'",
            "ALTER TABLE tenant_settings ADD COLUMN secondary_color VARCHAR(30) NOT NULL DEFAULT '#F472B6'",
            "ALTER TABLE tenant_settings ADD COLUMN accent_color VARCHAR(30) NOT NULL DEFAULT '#FDF2F8'",
            "ALTER TABLE tenant_settings ADD COLUMN churn_days_threshold INT NOT NULL DEFAULT 45",
            "ALTER TABLE invoice_line_items MODIFY COLUMN employee_id INT NULL",
            "ALTER TABLE customers ADD COLUMN spot VARCHAR(50) NULL",
            "ALTER TABLE products ADD COLUMN mrp DECIMAL(10, 2) NOT NULL DEFAULT 0.00",
            "ALTER TABLE invoice_line_items ADD COLUMN mrp DECIMAL(10, 2) NULL",
        ]
        for stmt in alters:
            try:
                db.session.execute(db.text(stmt))
                db.session.commit()
            except Exception:
                db.session.rollback()
        db.create_all()
    
    # Initialize JWT
    jwt = JWTManager(app)

    # Register blueprints
    from app.routes.health import health_bp
    from app.routes.auth import auth_bp
    from app.routes.customers import customers_bp
    from app.routes.employees import employees_bp
    from app.routes.services import services_bp
    from app.routes.products import products_bp
    from app.routes.billing import billing_bp
    from app.routes.memberships import memberships_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.reports import reports_bp
    from app.routes.settings import settings_bp
    from app.routes.super_admin import super_admin_bp
    from app.routes.notifications import notifications_bp
    from app.routes.whatsapp import whatsapp_bp
    from app.routes.campaigns import campaigns_bp
    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(auth_bp, url_prefix="/api/v1")
    app.register_blueprint(customers_bp, url_prefix="/api/v1")
    app.register_blueprint(employees_bp, url_prefix="/api/v1")
    app.register_blueprint(services_bp, url_prefix="/api/v1")
    app.register_blueprint(products_bp, url_prefix="/api/v1")
    app.register_blueprint(billing_bp, url_prefix="/api/v1")
    app.register_blueprint(memberships_bp, url_prefix="/api/v1")
    app.register_blueprint(dashboard_bp, url_prefix="/api/v1")
    app.register_blueprint(reports_bp, url_prefix="/api/v1")
    app.register_blueprint(settings_bp, url_prefix="/api/v1")
    app.register_blueprint(super_admin_bp, url_prefix="/api/v1")
    app.register_blueprint(notifications_bp, url_prefix="/api/v1")
    app.register_blueprint(whatsapp_bp, url_prefix="/api/v1")
    app.register_blueprint(campaigns_bp, url_prefix="/api/v1")

    from flask import send_from_directory
    import os

    @app.route("/api/v1/static/uploads/<path:filename>")
    def serve_static_uploads(filename):
        upload_dir = os.path.join(app.root_path, "static", "uploads")
        return send_from_directory(upload_dir, filename)

    # Global JWT Custom Error Handlers
    @jwt.unauthorized_loader
    def unauthorized_callback(err_str):
        return error_response(
            error_code="UNAUTHORIZED",
            message=err_str,
            status_code=401
        )

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return error_response(
            error_code="TOKEN_EXPIRED",
            message="The provided authorization token has expired.",
            status_code=401
        )

    @jwt.invalid_token_loader
    def invalid_token_callback(err_str):
        return error_response(
            error_code="INVALID_TOKEN",
            message=err_str,
            status_code=401
        )

    # Centralized HTTP Exception Handler
    @app.errorhandler(Exception)
    def handle_exception(e):
        # Pass HTTPExceptions through
        if isinstance(e, HTTPException):
            return error_response(
                error_code=e.name.upper().replace(" ", "_"),
                message=e.description,
                status_code=e.code
            )
        
        # Log unhandled exceptions
        app.logger.error(f"Unhandled Exception: {str(e)}", exc_info=True)
        return error_response(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred.",
            status_code=500
        )

    return app
