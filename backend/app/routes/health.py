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
