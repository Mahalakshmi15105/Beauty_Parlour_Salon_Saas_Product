import os
import logging
from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException

from app.config import Config
from app.database import db, migrate
from app.db_bootstrap import ensure_database_exists
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
    # CORS: allow production frontend + configured origins
    if app.config.get("CORS_ALLOW_ALL", False):
        CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=False)
    else:
        CORS(
            app,
            resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}},
            supports_credentials=True,
            allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
            methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        )
    # Configure Database-per-Tenant URI defaults dynamically from MASTER_DATABASE_URI
    import re
    master_uri = app.config.get("MASTER_DATABASE_URI") or app.config.get("SQLALCHEMY_DATABASE_URI", "mysql+pymysql://smartgo1_salon_user:Arish%40123@localhost:3306/smartgo1_salon?charset=utf8mb4")
    app.config["MASTER_DATABASE_URI"] = master_uri

    m_base = re.match(r"^(mysql\+[a-z0-9]+://[^/]+/).*", master_uri)
    if m_base:
        base_uri = m_base.group(1)
    else:
        base_uri = app.config.get("MYSQL_BASE_URI", "mysql+pymysql://smartgo1_salon_user:Arish%40123@localhost:3306/")
    app.config["MYSQL_BASE_URI"] = base_uri

    db.init_app(app)
    migrate.init_app(app, db)

    @app.before_request
    def set_default_request_context():
        from flask import g
        g.use_master_db = True

    @app.teardown_request
    def teardown_request_context(exception=None):
        db.session.remove()

    # ------------------------------------------------------------------
    # AUTO DATABASE CREATION
    # If the master database does not exist (fresh server), create it first.
    # ------------------------------------------------------------------
    ensure_database_exists(app.config["MASTER_DATABASE_URI"])

    with app.app_context():
        # ------------------------------------------------------------------
        # CREATE TABLES + AUTO-SEED
        # Wrapped in try/except so the app still starts even if the
        # database is temporarily unreachable (e.g. first deploy before
        # the MySQL user is provisioned). Requests will return 500 with
        # a clear error until the DB becomes available.
        # ------------------------------------------------------------------
        try:
            # Create Master DB tables (tenants, subscription_plans, tenant_lookups, users)
            db.create_all_master()

            # AUTO-SEED / TENANT AUTO-CHECK
            from app.models.global_models import Tenant
            tenant_count = Tenant.query.count()
            if tenant_count == 0:
                app.logger.info("Database is empty. Auto-seeding default data...")
                from seed import seed_database
                seed_database()
                app.logger.info("Auto-seed completed successfully.")
            else:
                app.logger.info(f"Master Database contains {tenant_count} tenant(s). Verifying tenant databases...")
                from app.database import tenant_metadata
                from app.db_bootstrap import sanitize_tenant_uri
                from sqlalchemy import create_engine
                master_uri = app.config.get("MASTER_DATABASE_URI", "")
                active_tenants = Tenant.query.filter_by(status="active").all()
                for t in active_tenants:
                    if t.db_connection_uri:
                        try:
                            clean_uri = sanitize_tenant_uri(t.db_connection_uri, master_uri)
                            if clean_uri != t.db_connection_uri:
                                t.db_connection_uri = clean_uri
                                db.session.commit()
                            ensure_database_exists(clean_uri)
                            t_engine = create_engine(clean_uri, pool_pre_ping=True)
                            tenant_metadata.create_all(bind=t_engine)
                            t_engine.dispose()
                        except Exception as te_err:
                            app.logger.warning(f"Tenant DB startup check notice for ID {t.id} ({t.name}): {te_err}")
                app.logger.info("Tenant database check completed successfully.")
        except Exception as db_error:
            app.logger.error(f"Database initialization failed: {db_error}")
            app.logger.error("App will start in degraded mode. Fix DATABASE_URL and MySQL credentials.")
            # Store the error so routes can report it
            app.config["DB_INIT_ERROR"] = str(db_error)
    
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
    from app.routes.appointments import appointments_bp
    from app.routes.public_booking import public_booking_bp
    from app.routes.branches import branches_bp
    from app.routes.bulk_upload import bulk_upload_bp
    from app.routes.visit_membership import visit_membership_bp
    from app.routes.attendance import attendance_bp
    from app.routes.expenses import expenses_bp
    from app.routes.cash_denominations import cash_denominations_bp
    from app.routes.payroll_adjustments import payroll_adjustments_bp
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
    app.register_blueprint(appointments_bp)
    app.register_blueprint(public_booking_bp)
    app.register_blueprint(branches_bp, url_prefix="/api/v1")
    app.register_blueprint(bulk_upload_bp, url_prefix="/api/v1")
    app.register_blueprint(visit_membership_bp, url_prefix="/api/v1")
    app.register_blueprint(attendance_bp)
    app.register_blueprint(expenses_bp)
    app.register_blueprint(cash_denominations_bp)
    app.register_blueprint(payroll_adjustments_bp)

    from flask import send_from_directory
    import os

    @app.route("/api/v1/static/uploads/<path:filename>")
    def serve_static_uploads(filename):
        upload_dir = os.path.join(app.root_path, "static", "uploads")
        return send_from_directory(upload_dir, filename)

    # Global JWT Custom Error Handlers
    @jwt.unauthorized_loader
    def unauthorized_callback(err_str):
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"JWT Unauthorized - Error: {err_str}")
        return error_response(
            error_code="UNAUTHORIZED",
            message=err_str,
            status_code=401
        )

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"JWT Expired - Payload: {jwt_payload}")
        return error_response(
            error_code="TOKEN_EXPIRED",
            message="The provided authorization token has expired.",
            status_code=401
        )

    @jwt.invalid_token_loader
    def invalid_token_callback(err_str):
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"JWT Invalid Token - Error: {err_str}")
        return error_response(
            error_code="INVALID_TOKEN",
            message=err_str,
            status_code=401
        )

    # Centralized HTTP Exception Handler
    @app.errorhandler(Exception)
    def handle_exception(e):
        try:
            db.session.rollback()
        except Exception:
            pass

        # Pass HTTPExceptions through
        if isinstance(e, HTTPException):
            return error_response(
                error_code=e.name.upper().replace(" ", "_"),
                message=e.description,
                status_code=e.code
            )
        
        # Log unhandled exceptions
        app.logger.error(f"Unhandled Exception: {str(e)}", exc_info=True)
        
        # In production, include the error detail for easier debugging
        error_detail = str(e)
        return error_response(
            error_code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred.",
            status_code=500,
            details={"error": error_detail}
        )

    @app.before_request
    def clear_stale_db_session():
        try:
            db.session.rollback()
        except Exception:
            pass

    @app.teardown_request
    def cleanup_db_session(exception=None):
        if exception:
            try:
                db.session.rollback()
            except Exception:
                pass
        try:
            db.session.remove()
        except Exception:
            pass

    # ------------------------------------------------------------------
    # REDIS CACHE INITIALIZATION
    # IP Address: 127.0.0.1 | Port: 38215 | Password: dwVmwxCL4XoHTesUR7u
    # ------------------------------------------------------------------
    from app.services.cache import cache
    cache.init_app(app)

    # ------------------------------------------------------------------
    # AUTO-SLEEP MODE
    # Starts the idle-monitor after ALL blueprints are registered so
    # the before_request hook sees every route.
    # Kills inactive process/threads after 30 minutes of idle time.
    # ------------------------------------------------------------------
    from app.services.auto_sleep import start_sleep_monitor
    start_sleep_monitor(app)

    return app
