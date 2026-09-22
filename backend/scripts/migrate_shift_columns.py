import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import db
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_shift_columns():
    """Add shift_start_time and shift_end_time to employees table in all tenant DBs."""
    try:
        master_engine = db.get_master_engine()
        with master_engine.connect() as conn:
            tenants = conn.execute(text("SELECT id, db_connection_uri FROM tenants WHERE is_deleted = 0")).mappings().all()

        for t in tenants:
            t_id = t["id"]
            uri = t["db_connection_uri"]
            logger.info(f"Migrating shift columns for Tenant #{t_id}...")

            engine = db.get_tenant_engine(uri)
            with engine.connect() as conn:
                # Check columns on employees table
                cols = conn.execute(text("SHOW COLUMNS FROM employees")).mappings().all()
                col_names = [c["Field"] for c in cols]

                if "shift_start_time" not in col_names:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN shift_start_time VARCHAR(10) DEFAULT '09:00'"))
                    logger.info(f"Added shift_start_time to Tenant #{t_id}")
                if "shift_end_time" not in col_names:
                    conn.execute(text("ALTER TABLE employees ADD COLUMN shift_end_time VARCHAR(10) DEFAULT '18:00'"))
                    logger.info(f"Added shift_end_time to Tenant #{t_id}")

                conn.commit()

        logger.info("All tenant DBs successfully updated with employee shift columns.")
    except Exception as e:
        logger.error(f"Migration error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    from app import create_app
    app = create_app()
    with app.app_context():
        migrate_shift_columns()
