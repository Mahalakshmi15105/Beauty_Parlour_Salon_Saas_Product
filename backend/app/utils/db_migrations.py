"""
Automatic Database Schema Migration Utility
==========================================
Ensures all tables in existing databases have missing columns (such as `branch_id`,
`max_branches`, `show_qty`, etc.) without dropping or altering existing data.
"""

import logging
from sqlalchemy import text
from app.database import db

logger = logging.getLogger(__name__)

BRANCH_TABLES = [
    "users",
    "tenant_settings",
    "customers",
    "reminders",
    "customer_feedback",
    "employees",
    "service_categories",
    "services",
    "products",
    "suppliers",
    "membership_plans",
    "customer_memberships",
    "membership_benefits",
    "invoices",
    "invoice_line_items",
    "appointments",
    "appointment_items",
]

TENANT_SETTINGS_SCHEMA = [
    ("show_qty", "BOOLEAN NOT NULL DEFAULT 1"),
    ("show_rate", "BOOLEAN NOT NULL DEFAULT 1"),
    ("show_mrp", "BOOLEAN NOT NULL DEFAULT 1"),
    ("show_tax", "BOOLEAN NOT NULL DEFAULT 1"),
    ("auto_print", "BOOLEAN NOT NULL DEFAULT 0"),
    ("thank_you_message", "VARCHAR(255) DEFAULT 'Thank you for visiting. Please visit again.'"),
    ("shop_name_font_enabled", "BOOLEAN NOT NULL DEFAULT 0"),
    ("shop_name_font", "VARCHAR(100) DEFAULT 'Outfit'"),
    ("shop_name_font_size", "INT DEFAULT 32"),
    ("shop_name_font_weight", "VARCHAR(20) DEFAULT '700'"),
    ("shop_name_letter_spacing", "DECIMAL(4,2) DEFAULT 0.00"),
    ("churn_days_threshold", "INT DEFAULT 45"),
    ("google_drive_enabled", "BOOLEAN NOT NULL DEFAULT 0"),
    ("google_drive_email", "VARCHAR(150) NULL"),
    ("google_drive_access_token", "TEXT NULL"),
    ("google_drive_refresh_token", "TEXT NULL"),
    ("google_drive_token_expiry", "DATETIME NULL"),
    ("google_drive_root_folder_id", "VARCHAR(100) NULL"),
    ("google_drive_services_folder_id", "VARCHAR(100) NULL"),
    ("google_drive_products_folder_id", "VARCHAR(100) NULL"),
    ("google_drive_logos_folder_id", "VARCHAR(100) NULL"),
    ("google_drive_campaigns_folder_id", "VARCHAR(100) NULL"),
    ("google_client_id", "VARCHAR(255) NULL"),
    ("google_client_secret", "VARCHAR(255) NULL"),
]


def run_auto_migrations():
    """Auto-migrate database schema to ensure all multi-branch, new tables and settings columns exist."""
    try:
        # 0. Create any new missing tables
        db.create_all()

        # 1. Add branch_id and tenant_id to all relevant tables if missing
        for table in BRANCH_TABLES:
            try:
                db.session.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `branch_id` INT NULL;"))
                db.session.commit()
                logger.info(f"AUTO-MIGRATION: Added 'branch_id' column to table '{table}'.")
            except Exception:
                db.session.rollback()

        for table in ["users", "tenant_settings"]:
            try:
                db.session.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `tenant_id` INT NULL;"))
                db.session.commit()
                logger.info(f"AUTO-MIGRATION: Added 'tenant_id' column to table '{table}'.")
            except Exception:
                db.session.rollback()

        # 2. Add settings columns to tenant_settings if missing
        for col_name, col_def in TENANT_SETTINGS_SCHEMA:
            try:
                db.session.execute(text(f"ALTER TABLE `tenant_settings` ADD COLUMN `{col_name}` {col_def};"))
                db.session.commit()
                logger.info(f"AUTO-MIGRATION: Added '{col_name}' column to table 'tenant_settings'.")
            except Exception:
                db.session.rollback()

        # 3. Add max_branches to subscription_plans if missing
        try:
            db.session.execute(text("ALTER TABLE `subscription_plans` ADD COLUMN `max_branches` INT DEFAULT 1;"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # 4. Add geofencing & Wi-Fi columns to branches table if missing
        BRANCH_COLS = [
            ("is_main_branch", "TINYINT(1) NOT NULL DEFAULT 0"),
            ("latitude", "DECIMAL(10, 8) NULL"),
            ("longitude", "DECIMAL(11, 8) NULL"),
            ("geofence_radius_meters", "INT NOT NULL DEFAULT 100"),
            ("initial_opening_balance", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00"),
            ("wifi_ssid", "VARCHAR(100) NULL"),
            ("wifi_public_ip", "VARCHAR(100) NULL"),
            ("enforce_wifi", "TINYINT(1) NOT NULL DEFAULT 0")
        ]
        for col_name, col_def in BRANCH_COLS:
            try:
                db.session.execute(text(f"ALTER TABLE `branches` ADD COLUMN `{col_name}` {col_def};"))
                db.session.commit()
                logger.info(f"AUTO-MIGRATION: Added '{col_name}' column to table 'branches'.")
            except Exception:
                db.session.rollback()

        # 5. Add employee extra columns if missing
        EMPLOYEE_COLS = [
            ("email", "VARCHAR(120) NULL"),
            ("username", "VARCHAR(100) NULL"),
            ("shift_start_time", "VARCHAR(10) NULL DEFAULT '09:00'"),
            ("shift_end_time", "VARCHAR(10) NULL DEFAULT '18:00'"),
            ("monthly_offs", "INT NOT NULL DEFAULT 4"),
            ("password_plain", "VARCHAR(100) NULL"),
            ("level", "VARCHAR(50) NOT NULL DEFAULT 'L1'"),
            ("target", "DECIMAL(10, 2) NOT NULL DEFAULT 0.00"),
            ("commission_percentage", "DECIMAL(5, 2) NOT NULL DEFAULT 0.00"),
            ("status", "VARCHAR(50) NOT NULL DEFAULT 'active'")
        ]
        for col_name, col_def in EMPLOYEE_COLS:
            try:
                db.session.execute(text(f"ALTER TABLE `employees` ADD COLUMN `{col_name}` {col_def};"))
                db.session.commit()
                logger.info(f"AUTO-MIGRATION: Added '{col_name}' column to table 'employees'.")
            except Exception:
                db.session.rollback()

        logger.info("AUTO-MIGRATION: Database schema check completed successfully.")
    except Exception as e:
        logger.error(f"AUTO-MIGRATION ERROR: {e}")
        db.session.rollback()
