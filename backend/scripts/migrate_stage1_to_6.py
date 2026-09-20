import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.database import db
from sqlalchemy import text
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migrate_stage1_to_6")

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
                    # STAGE 1: Add salary, target, level columns to employees table if missing
                    for col_name, col_def in [
                        ("salary", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00"),
                        ("target", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00"),
                        ("level", "VARCHAR(50) NOT NULL DEFAULT 'L1'")
                    ]:
                        res = conn.execute(text(f"SHOW COLUMNS FROM employees LIKE '{col_name}'"))
                        if not res.fetchone():
                            logger.info(f"Adding {col_name} to employees table in Tenant {t.id} ({t.name})...")
                            conn.execute(text(f"ALTER TABLE employees ADD COLUMN `{col_name}` {col_def}"))
                            conn.commit()

                    # STAGE 2: Add opening_time, closing_time to branches table if missing
                    for col_name, col_def in [
                        ("opening_time", "VARCHAR(10) NOT NULL DEFAULT '09:00'"),
                        ("closing_time", "VARCHAR(10) NOT NULL DEFAULT '21:00'")
                    ]:
                        res = conn.execute(text(f"SHOW COLUMNS FROM branches LIKE '{col_name}'"))
                        if not res.fetchone():
                            logger.info(f"Adding {col_name} to branches table in Tenant {t.id} ({t.name})...")
                            conn.execute(text(f"ALTER TABLE branches ADD COLUMN `{col_name}` {col_def}"))
                            conn.commit()

                    # Ensure attendances table exists
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
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            INDEX idx_att_tenant (tenant_id),
                            INDEX idx_att_emp (employee_id),
                            INDEX idx_att_branch (branch_id)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """))
                    conn.commit()

                    # STAGE 2: Add check_out_time, status to attendances table if missing
                    for col_name, col_def in [
                        ("check_out_time", "DATETIME NULL"),
                        ("status", "VARCHAR(10) NOT NULL DEFAULT 'P'")
                    ]:
                        res = conn.execute(text(f"SHOW COLUMNS FROM attendances LIKE '{col_name}'"))
                        if not res.fetchone():
                            logger.info(f"Adding {col_name} to attendances table in Tenant {t.id} ({t.name})...")
                            conn.execute(text(f"ALTER TABLE attendances ADD COLUMN `{col_name}` {col_def}"))
                            conn.commit()

                    # STAGE 3: Create expenses table
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS expenses (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            tenant_id INT NOT NULL,
                            branch_id INT NOT NULL,
                            amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                            note TEXT NULL,
                            date DATE NOT NULL,
                            created_by VARCHAR(100) NULL,
                            is_deleted BOOLEAN NOT NULL DEFAULT 0,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            INDEX idx_exp_tenant (tenant_id),
                            INDEX idx_exp_branch (branch_id),
                            INDEX idx_exp_date (date)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """))
                    conn.commit()

                    res = conn.execute(text("SHOW COLUMNS FROM expenses LIKE 'updated_at'"))
                    if not res.fetchone():
                        logger.info(f"Adding updated_at to expenses table in Tenant {t.id} ({t.name})...")
                        conn.execute(text("ALTER TABLE expenses ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"))
                        conn.commit()

                    # STAGE 4: Create cash_denominations table
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS cash_denominations (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            tenant_id INT NOT NULL,
                            branch_id INT NOT NULL,
                            date DATE NOT NULL,
                            count_500 INT NOT NULL DEFAULT 0,
                            count_200 INT NOT NULL DEFAULT 0,
                            count_100 INT NOT NULL DEFAULT 0,
                            count_50 INT NOT NULL DEFAULT 0,
                            count_20 INT NOT NULL DEFAULT 0,
                            count_10 INT NOT NULL DEFAULT 0,
                            count_5 INT NOT NULL DEFAULT 0,
                            count_2 INT NOT NULL DEFAULT 0,
                            count_1 INT NOT NULL DEFAULT 0,
                            total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                            UNIQUE KEY unq_branch_date (tenant_id, branch_id, date),
                            INDEX idx_cd_tenant (tenant_id),
                            INDEX idx_cd_branch (branch_id),
                            INDEX idx_cd_date (date)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """))
                    conn.commit()

                    # STAGE 5: Create payroll_adjustments table
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS payroll_adjustments (
                            id INT AUTO_INCREMENT PRIMARY KEY,
                            tenant_id INT NOT NULL,
                            employee_id INT NOT NULL,
                            type VARCHAR(20) NOT NULL DEFAULT 'Advance',
                            amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                            note TEXT NULL,
                            date DATE NOT NULL,
                            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            INDEX idx_pa_tenant (tenant_id),
                            INDEX idx_pa_employee (employee_id),
                            INDEX idx_pa_date (date)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                    """))
                    conn.commit()

                    logger.info(f"Successfully migrated Tenant {t.id} ({t.name}).")
                success_count += 1
            except Exception as e:
                logger.error(f"Failed to migrate Tenant {t.id} ({t.name}): {e}")
                error_count += 1

        logger.info("=" * 60)
        logger.info(f"STAGE 1-6 MIGRATION COMPLETE: {success_count} succeeded, {error_count} failed out of {len(tenants)} total tenants.")
        logger.info("=" * 60)

if __name__ == "__main__":
    migrate_all_tenants()
