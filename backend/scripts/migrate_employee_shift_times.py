import sys
import os
import logging
from sqlalchemy import text, inspect

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import create_app
from app.database import db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shift_time_migration")

app = create_app()

def migrate_all():
    with app.app_context():
        engine = db.get_master_engine()
        with engine.connect() as conn:
            tenants = conn.execute(text("SELECT id, db_connection_uri FROM tenants WHERE is_deleted = 0")).fetchall()

        for t in tenants:
            t_id, db_uri = t[0], t[1]
            if not db_uri:
                continue
            logger.info(f"Checking tenant DB {t_id}...")
            try:
                t_engine = db.get_tenant_engine(db_uri)
                inspector = inspect(t_engine)
                cols = [c["name"] for c in inspector.get_columns("employees")]
                with t_engine.begin() as conn:
                    if "shift_start_time" not in cols:
                        conn.execute(text("ALTER TABLE employees ADD COLUMN shift_start_time VARCHAR(10) DEFAULT '09:00'"))
                        logger.info(f"Added shift_start_time to tenant {t_id}")
                    if "shift_end_time" not in cols:
                        conn.execute(text("ALTER TABLE employees ADD COLUMN shift_end_time VARCHAR(10) DEFAULT '18:00'"))
                        logger.info(f"Added shift_end_time to tenant {t_id}")
            except Exception as e:
                logger.error(f"Error migrating tenant {t_id}: {e}")

if __name__ == "__main__":
    migrate_all()
