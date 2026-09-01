import sys
import os
import re
from sqlalchemy import create_engine, text

sys.path.insert(0, r"c:\Users\mahal\OneDrive\Desktop\parlour\backend")

MYSQL_BASE_URI = "mysql+pymysql://root:root@localhost:3306/"
MASTER_DB_URI = "mysql+pymysql://root:root@localhost:3306/parlour_master?charset=utf8mb4"
OLD_SHARED_DB_URI = "mysql+pymysql://root:root@localhost:3306/smartgonext_beauty_saas?charset=utf8mb4"

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

TENANT_DOMAINS = [
    "branches",
    "users",
    "tenant_settings",
    "customers",
    "employees",
    "service_categories",
    "services",
    "products",
    "suppliers",
    "membership_plans",
    "customer_memberships",
    "appointments",
    "invoices",
    "bills",
    "whatsapp_settings",
    "whatsapp_campaigns",
    "audit_logs"
]

def main():
    sys_engine = create_engine(MYSQL_BASE_URI)
    master_engine = create_engine(MASTER_DB_URI)
    old_engine = create_engine(OLD_SHARED_DB_URI)

    # 1. Fetch all databases from MySQL Server matching 'tenant_%'
    with sys_engine.connect() as sys_conn:
        db_rows = sys_conn.execute(text("SHOW DATABASES LIKE 'tenant_%';")).all()
        actual_databases = set([r[0] for r in db_rows])

    print("=" * 85)
    print(f"PART 1: SERVER DATABASE DISCOVERY (SHOW DATABASES LIKE 'tenant_%%')")
    print(f"Total Physical Tenant Databases Found on MySQL Server: {len(actual_databases)}")
    print("=" * 85)
    for db_item in sorted(actual_databases):
        print(f"  - {db_item}")

    # 2. Fetch all 35 tenants from parlour_master.tenants
    print("\n" + "=" * 85)
    print("PART 2: PARLOUR_MASTER TENANT REGISTRY BREAKDOWN (ALL ROWS IN MASTER DB)")
    print("=" * 85)
    with master_engine.connect() as master_conn:
        tenants = master_conn.execute(text("SELECT id, name, status, db_name, db_connection_uri, is_deleted FROM tenants ORDER BY id ASC;")).mappings().all()

    print(f"{'ID':<4} | {'Tenant Name':<30} | {'Status':<10} | {'IsDeleted':<10} | {'Registered DB Name':<35} | Exists on Server?")
    print("-" * 105)

    missing_tenants = []
    for t in tenants:
        t_id = t["id"]
        t_name = t["name"]
        t_status = t["status"]
        is_del = t["is_deleted"]
        db_name = t["db_name"] or "NULL"
        exists = "YES [✔]" if db_name in actual_databases else "MISSING [❌]"

        if db_name not in actual_databases:
            missing_tenants.append(t)

        print(f"{t_id:<4} | {t_name:<30} | {t_status:<10} | {str(is_del):<10} | {db_name:<35} | {exists}")

    print("\n" + "=" * 85)
    print("PART 3: MISSING TENANTS ANALYSIS")
    print("=" * 85)
    if not missing_tenants:
        print("None! All registered tenants have corresponding physical databases on MySQL server.")
    else:
        print(f"Detected {len(missing_tenants)} missing tenant database(s):")
        for mt in missing_tenants:
            print(f"  - Tenant #{mt['id']} ('{mt['name']}'): Status={mt['status']}, IsDeleted={mt['is_deleted']}, DB Name={mt['db_name']}")

    # 3. Explicit SELECT DATABASE() verification per tenant
    print("\n" + "=" * 85)
    print("PART 4: BULLETPROOF ROW-COUNT VERIFICATION WITH SELECT DATABASE()")
    print("=" * 85)

    all_verifications_pass = True

    with old_engine.connect() as old_conn:
        for t in tenants:
            t_id = t["id"]
            db_name = t["db_name"]
            
            print(f"\n--- Verifying Tenant #{t_id} ('{t['name']}') | Registered DB: `{db_name}` ---")

            if not db_name or db_name not in actual_databases:
                print(f"  [❌] SKIP: Database `{db_name}` does not exist on MySQL server!")
                all_verifications_pass = False
                continue

            tenant_db_uri = f"{MYSQL_BASE_URI}{db_name}?charset=utf8mb4"
            tenant_engine = create_engine(tenant_db_uri)

            with tenant_engine.connect() as t_conn:
                current_db = t_conn.execute(text("SELECT DATABASE();")).scalar()
                print(f"  [CONFIRMED CONNECTION CONTEXT] SELECT DATABASE() = `{current_db}`")

                if current_db != db_name:
                    print(f"  [❌] CRITICAL ERROR: Connected database `{current_db}` does not match expected `{db_name}`!")
                    all_verifications_pass = False
                    continue

                tenant_pass = True
                print(f"  {'Table Name':<25} | {'Old Shared Count':<18} | {'New Tenant DB Count':<20} | Status")
                print("  " + "-" * 75)

                for table_name in TENANT_DOMAINS:
                    # Count in old shared DB for this tenant_id
                    try:
                        old_cnt = old_conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}` WHERE tenant_id = :t_id"), {"t_id": t_id}).scalar()
                    except Exception:
                        old_cnt = 0

                    # Count in new isolated tenant DB
                    try:
                        new_cnt = t_conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`")).scalar()
                    except Exception:
                        new_cnt = 0

                    match = (old_cnt == new_cnt)
                    if not match:
                        tenant_pass = False
                        all_verifications_pass = False

                    status_str = "PASS [✔]" if match else "FAIL [❌] (MISMATCH)"
                    print(f"  {table_name:<25} | {old_cnt:<18} | {new_cnt:<20} | {status_str}")

                print(f"  Verdict for Tenant #{t_id}: {'[✔] PASS - 100% Match' if tenant_pass else '[❌] FAIL - Row Mismatch'}")

    print("\n" + "=" * 85)
    if all_verifications_pass:
        print("FINAL VERDICT: ALL TENANTS VERIFIED CLEANLY WITH 100% MATCHING ROW COUNTS AND CONFIRMED DATABASE CONTEXT!")
    else:
        print("FINAL VERDICT: DISCREPANCIES DETECTED IN TENANT COUNT OR ROW COUNTS.")
    print("=" * 85)

if __name__ == "__main__":
    main()
