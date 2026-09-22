import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.database import db
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrate_all_tenants")

def migrate_all_tenants():
    app = create_app()
    with app.app_context():
        from app.models.global_models import Tenant
        tenants = Tenant.query.all()
        logger.info(f"Found {len(tenants)} tenant(s) in Master DB.")
        
        success_count = 0
        error_count = 0

        for t in tenants:
            if not t.db_connection_uri:
                logger.warning(f"Tenant ID {t.id} ({t.name}) has no db_connection_uri. Skipping.")
                continue

            try:
                engine = db.get_tenant_engine(t.db_connection_uri)
                with engine.connect() as conn:
                    # Check services table image_url
                    res = conn.execute(text("SHOW COLUMNS FROM services LIKE 'image_url'"))
                    if not res.fetchone():
                        logger.info(f"Adding image_url column to services table in Tenant {t.id} ({t.name})...")
                        conn.execute(text("ALTER TABLE services ADD COLUMN image_url VARCHAR(500) NULL AFTER description"))
                        conn.commit()
                        logger.info(f"Successfully added image_url to services in Tenant {t.id} ({t.name}).")
                    else:
                        logger.info(f"Tenant {t.id} ({t.name}) services table already has image_url column.")

                    # Check products table image_url
                    res_prod = conn.execute(text("SHOW COLUMNS FROM products LIKE 'image_url'"))
                    if not res_prod.fetchone():
                        logger.info(f"Adding image_url column to products table in Tenant {t.id} ({t.name})...")
                        conn.execute(text("ALTER TABLE products ADD COLUMN image_url VARCHAR(500) NULL AFTER status"))
                        conn.commit()
                        logger.info(f"Successfully added image_url to products in Tenant {t.id} ({t.name}).")
                    else:
                        logger.info(f"Tenant {t.id} ({t.name}) products table already has image_url column.")

                    # Check tenant_settings table billing_mode
                    res_bill = conn.execute(text("SHOW COLUMNS FROM tenant_settings LIKE 'billing_mode'"))
                    if not res_bill.fetchone():
                        logger.info(f"Adding billing_mode column to tenant_settings table in Tenant {t.id} ({t.name})...")
                        conn.execute(text("ALTER TABLE tenant_settings ADD COLUMN billing_mode VARCHAR(20) NOT NULL DEFAULT 'normal'"))
                        conn.commit()
                        logger.info(f"Successfully added billing_mode to tenant_settings in Tenant {t.id} ({t.name}).")
                    else:
                        logger.info(f"Tenant {t.id} ({t.name}) tenant_settings table already has billing_mode column.")

                    # Check branches table geofencing & opening balance columns
                    for col_name, col_def in [("latitude", "DECIMAL(10, 8) NULL"), ("longitude", "DECIMAL(11, 8) NULL"), ("geofence_radius_meters", "INT NOT NULL DEFAULT 100"), ("initial_opening_balance", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00")]:
                        res_branch_col = conn.execute(text(f"SHOW COLUMNS FROM branches LIKE '{col_name}'"))
                        if not res_branch_col.fetchone():
                            logger.info(f"Adding {col_name} to branches table in Tenant {t.id} ({t.name})...")
                            conn.execute(text(f"ALTER TABLE branches ADD COLUMN `{col_name}` {col_def}"))
                            conn.commit()

                    # Create attendances table if missing
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS attendances (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            tenant_id INT NOT NULL,
                            employee_id INT NOT NULL,
                            branch_id INT NOT NULL,
                            timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            checkin_method VARCHAR(20) NOT NULL DEFAULT 'QR',
                            location_flagged BOOLEAN NOT NULL DEFAULT 0,
                            location_unavailable BOOLEAN NOT NULL DEFAULT 0,
                            latitude DECIMAL(10, 8) NULL,
                            longitude DECIMAL(11, 8) NULL,
                            distance_meters DECIMAL(8, 2) NULL,
                            status VARCHAR(20) NOT NULL DEFAULT 'P',
                            check_out_time DATETIME NULL,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            INDEX idx_att_tenant (tenant_id),
                            INDEX idx_att_emp (employee_id),
                            INDEX idx_att_branch (branch_id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """))
                    conn.commit()

                    # Check attendances status & check_out_time columns
                    for att_col, att_def in [("status", "VARCHAR(20) NOT NULL DEFAULT 'P'"), ("check_out_time", "DATETIME NULL")]:
                        res_att = conn.execute(text(f"SHOW COLUMNS FROM attendances LIKE '{att_col}'"))
                        if not res_att.fetchone():
                            conn.execute(text(f"ALTER TABLE attendances ADD COLUMN `{att_col}` {att_def}"))
                            conn.commit()

                    logger.info(f"Successfully verified attendances table in Tenant {t.id} ({t.name}).")
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to migrate Tenant {t.id} ({t.name}): {e}")
                error_count += 1

        logger.info("=" * 60)
        logger.info(f"MIGRATION COMPLETE: {success_count} succeeded, {error_count} failed out of {len(tenants)} total tenants.")
        logger.info("=" * 60)

if __name__ == "__main__":
    migrate_all_tenants()
