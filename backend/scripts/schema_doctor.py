import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.database import db
from sqlalchemy import text, inspect
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("schema_doctor")

REQUIRED_TABLE_COLUMNS = {
    "branches": ["id", "tenant_id", "name", "is_main_branch", "latitude", "longitude", "geofence_radius_meters", "initial_opening_balance"],
    "employees": ["id", "tenant_id", "first_name", "last_name", "phone", "salary", "target", "level", "commission_percentage", "status"],
    "attendances": ["id", "tenant_id", "employee_id", "branch_id", "timestamp", "status", "check_out_time"],
    "invoices": ["id", "tenant_id", "branch_id", "customer_id", "subtotal", "discount", "tax", "total", "status", "created_at"],
    "invoice_line_items": ["id", "invoice_id", "service_id", "product_id", "employee_id", "quantity", "unit_price", "tax_amount", "line_total"],
    "expenses": ["id", "tenant_id", "branch_id", "amount", "date", "note", "is_deleted"],
    "cash_denominations": ["id", "tenant_id", "branch_id", "date", "total"],
    "payroll_adjustments": ["id", "tenant_id", "employee_id", "type", "amount", "date"]
}

def run_schema_doctor():
    app = create_app()
    with app.app_context():
        from app.models.global_models import Tenant
        tenants = Tenant.query.all()
        logger.info(f"🔍 SCHEMA DOCTOR: Auditing {len(tenants)} tenant database(s)...")

        total_issues = 0

        for t in tenants:
            if not t.db_connection_uri:
                continue

            try:
                engine = db.get_tenant_engine(t.db_connection_uri)
                inspector = inspect(engine)
                existing_tables = inspector.get_table_names()

                logger.info(f"\n--- Tenant {t.id}: {t.name} (DB: {t.db_name}) ---")
                tenant_issues = 0

                for table_name, expected_cols in REQUIRED_TABLE_COLUMNS.items():
                    if table_name not in existing_tables:
                        logger.error(f"  ❌ MISSING TABLE: '{table_name}' does not exist in tenant DB!")
                        tenant_issues += 1
                        continue

                    actual_cols = [c["name"] for c in inspector.get_columns(table_name)]
                    for col in expected_cols:
                        if col not in actual_cols:
                            logger.error(f"  ❌ MISSING COLUMN: '{table_name}.{col}' is missing!")
                            tenant_issues += 1

                if tenant_issues == 0:
                    logger.info(f"  ✅ ALL REQUIRED TABLES & COLUMNS HEALTHY for Tenant {t.id} ({t.name}).")
                else:
                    total_issues += tenant_issues

            except Exception as e:
                logger.error(f"  ❌ Failed to inspect Tenant {t.id} ({t.name}): {e}")
                total_issues += 1

        logger.info("=" * 60)
        if total_issues == 0:
            logger.info("🎉 SCHEMA DOCTOR COMPLETED: 0 Issues Found. System is 100% Ready for Deployment!")
        else:
            logger.error(f"⚠️ SCHEMA DOCTOR COMPLETED: Found {total_issues} schema issue(s). Run migrate_all_tenants.py!")
        logger.info("=" * 60)

if __name__ == "__main__":
    run_schema_doctor()
