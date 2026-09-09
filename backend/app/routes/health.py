from flask import Blueprint
from app.database import db
from app.utils.responses import success_response, error_response
from sqlalchemy import text
import logging

logger = logging.getLogger(__name__)
health_bp = Blueprint("health", __name__)

@health_bp.route("/health", methods=["GET"])
def health_check():
    db_status = "healthy"
    db_error = None
    try:
        # Ping the database using connection test
        db.session.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        db_status = "unhealthy"
        db_error = str(e)

    from app.services.cache import cache
    from app.config import Config

    status_code = 200 if db_status == "healthy" else 500
    
    health_data = {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "single_thread": Config.SINGLE_THREAD,
        "threads": Config.THREADS,
        "auto_sleep": {
            "enabled": Config.AUTO_SLEEP_ENABLED,
            "timeout_minutes": Config.AUTO_SLEEP_MINUTES,
        },
        "redis_cache": cache.get_status(),
    }
    
    if db_status == "healthy":
        return success_response(health_data, status_code)
    else:
        return error_response(
            error_code="DATABASE_CONNECTION_FAILED",
            message="Unable to connect to the database.",
            status_code=status_code,
            errors=[{"detail": "Check database service and connection URI settings."}],
            details={"error": db_error}
        )

@health_bp.route("/health/fix-db-charset", methods=["GET", "POST"])
def fix_db_charset():
    try:
        with db.engine.connect() as conn:
            # Get current database name
            db_name_row = conn.execute(text("SELECT DATABASE()")).fetchone()
            if not db_name_row or not db_name_row[0]:
                return error_response(
                    error_code="NO_ACTIVE_DATABASE",
                    message="No active database found.",
                    status_code=500
                )
            dbname = db_name_row[0]
            
            # 1. Alter Database character set
            conn.execute(text(f"ALTER DATABASE `{dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
            
            # 2. Get all tables
            result = conn.execute(text("SHOW TABLES;"))
            tables = [row[0] for row in result]
            
            # 3. Alter each table's character set
            converted_tables = []
            for table in tables:
                conn.execute(text(f"ALTER TABLE `{table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
                converted_tables.append(table)
            
            conn.commit()
            
        return success_response({
            "message": "Database and all tables successfully converted to utf8mb4.",
            "database": dbname,
            "converted_tables": converted_tables
        })
    except Exception as e:
        logger.error(f"Failed to fix database charset: {str(e)}")
        return error_response(
            error_code="CHARSET_FIX_FAILED",
            message=f"Failed to convert database charset: {str(e)}",
            status_code=500
        )

@health_bp.route("/health/init-db", methods=["GET", "POST"])
def init_master_db():
    """
    On-demand endpoint to create all Master DB tables (tenants, users, plans)
    and provision/sync all active tenant databases via cPanel API.
    """
    try:
        from app.database import db, master_metadata, tenant_metadata
        from app.db_bootstrap import ensure_database_exists
        from app.models.global_models import Tenant
        from seed import seed_database
        from sqlalchemy import create_engine

        # 1. Create all Master DB tables
        from flask import g
        g.use_master_db = True
        db.create_all_master()

        # 2. Seed default users, master tenant & lookup mapping
        logger.info("[Init DB Endpoint] Running database seeder to ensure default accounts...")
        seed_database()
        seeded = True

        # 3. Provision / verify all active tenant DBs
        from app.db_bootstrap import sanitize_tenant_uri
        from flask import current_app
        master_uri = current_app.config.get("MASTER_DATABASE_URI") or current_app.config.get("SQLALCHEMY_DATABASE_URI", "")

        active_tenants = Tenant.query.filter_by(status="active").all()
        synced_tenants = []
        for t in active_tenants:
            if t.db_connection_uri:
                clean_uri = sanitize_tenant_uri(t.db_connection_uri, master_uri)
                if clean_uri != t.db_connection_uri:
                    t.db_connection_uri = clean_uri
                    db.session.commit()

                ensure_database_exists(clean_uri)
                t_engine = create_engine(clean_uri, pool_pre_ping=True)
                tenant_metadata.create_all(bind=t_engine)
                t_engine.dispose()
                synced_tenants.append({"id": t.id, "name": t.name, "db_name": t.db_name})

        return success_response({
            "message": "Master database and tenant databases initialized successfully!",
            "total_tenants": Tenant.query.count(),
            "initial_seeded": seeded,
            "synced_tenants": synced_tenants
        })
    except Exception as e:
        logger.error(f"[Init DB Endpoint] Failed: {str(e)}", exc_info=True)
        return error_response(
            error_code="INIT_DB_FAILED",
            message=f"Failed to initialize database tables: {str(e)}",
            status_code=500
        )


