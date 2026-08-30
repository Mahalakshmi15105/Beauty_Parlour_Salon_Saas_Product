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
]


def run_auto_migrations():
    """Auto-migrate database schema to ensure all multi-branch and settings columns exist."""
    try:
        # 1. Add branch_id to all relevant tables if missing
        for table in BRANCH_TABLES:
            try:
                db.session.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `branch_id` INT NULL;"))
                db.session.commit()
                logger.info(f"AUTO-MIGRATION: Added 'branch_id' column to table '{table}'.")
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

        logger.info("AUTO-MIGRATION: Database schema check completed successfully.")
    except Exception as e:
        logger.error(f"AUTO-MIGRATION ERROR: {e}")
        db.session.rollback()
