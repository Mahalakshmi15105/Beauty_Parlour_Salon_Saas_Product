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

    status_code = 200 if db_status == "healthy" else 500
    
    health_data = {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status
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

