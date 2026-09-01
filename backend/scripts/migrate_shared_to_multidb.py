#!/usr/bin/env python3
"""
Production One-Time Migration Script: Shared MySQL Database to Database-per-Tenant
Run: python scripts/migrate_shared_to_multidb.py [--dry-run]
"""

import os
import re
import sys
import argparse
import datetime
import subprocess
from sqlalchemy import create_engine, text, MetaData, Table

# Database URIs
OLD_SHARED_DB_URI = os.getenv("OLD_SHARED_DB_URI", "mysql+pymysql://root:root@localhost:3306/smartgonext_beauty_saas?charset=utf8mb4")
MYSQL_BASE_URI = os.getenv("MYSQL_BASE_URI", "mysql+pymysql://root:root@localhost:3306/")
MASTER_DB_NAME = "parlour_master"
MASTER_DB_URI = f"{MYSQL_BASE_URI}{MASTER_DB_NAME}?charset=utf8mb4"

# Tables to migrate to each Tenant Database
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

def sanitize_slug(name):
    s = re.sub(r'[^a-z0-9]+', '_', (name or "").lower()).strip('_')
    return s or "parlour"

def run_mysqldump_backup(db_uri):
    """
    Executes mysqldump to back up the shared database before running migration.
    """
    print("\n[STEP 1] EXECUTING AUTOMATED MYSQLDUMP PRE-BACKUP...")
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"backup_smartgonext_beauty_saas_{timestamp}.sql"
    backup_path = os.path.join(os.getcwd(), backup_filename)

    # Parse host, user, password, db_name from URI
    match = re.match(r"mysql\+pymysql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)", db_uri)
    if not match:
        print("    [!] Could not parse connection parameters for mysqldump. Skipping dump.")
        return backup_path

    user, password, host, port, db_name = match.groups()
    cmd = [
        "mysqldump",
        f"--host={host}",
        f"--port={port}",
        f"--user={user}",
        f"--password={password}",
        "--routines",
        "--triggers",
        db_name
    ]

    try:
        with open(backup_path, "w", encoding="utf-8") as f:
            res = subprocess.run(cmd, stdout=f, stderr=subprocess.PIPE, text=True, check=True)
        print(f"    [OK] PRE-BACKUP SUCCESSFUL! Created: {backup_path}")
    except Exception as e:
        print(f"    [FAIL] mysqldump failed or utility not found in PATH: {e}")
        print("    Continuing with migration (ensure manual backup exists)...")

    return backup_path

def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(description="Migrate shared MySQL database to Database-per-Tenant")
    parser.add_argument("--dry-run", action="store_true", help="Perform validation and log plan without making DB changes")
    args = parser.parse_args()

    dry_run = args.dry_run

    print("=" * 75)
    print("      ONE-TIME MULTI-TENANT DATABASE MIGRATION SCRIPT (MySQL)")
    if dry_run:
        print("                     *** MODE: DRY RUN (PREVIEW ONLY) ***")
    print("=" * 75)

    # 1. Pre-migration backup
    if not dry_run:
        run_mysqldump_backup(OLD_SHARED_DB_URI)
    else:
        print("\n[STEP 1] DRY-RUN MODE: Skipping actual mysqldump execution.")

    # 2. Inspect Old Shared DB
    print(f"\n[STEP 2] Inspecting Old Shared Database: {OLD_SHARED_DB_URI}")
    try:
        old_engine = create_engine(OLD_SHARED_DB_URI)
        old_metadata = MetaData()
        old_metadata.reflect(bind=old_engine)
    except Exception as e:
        print(f"    [FAIL] Failed to connect to old shared database: {e}")
        sys.exit(1)

    sys_engine = create_engine(MYSQL_BASE_URI)

    # 3. Create Master Database
    print(f"\n[STEP 3] Provisioning Master Database: `{MASTER_DB_NAME}`")
    if not dry_run:
        with sys_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{MASTER_DB_NAME}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))

    master_engine = create_engine(MASTER_DB_URI) if not dry_run else old_engine

    # 4. Migrate Master Metadata
    print("\n[STEP 4] Populating Master DB Metadata & Tenant Lookups...")
    with old_engine.connect() as old_conn:
        tenants = old_conn.execute(text("SELECT * FROM tenants")).mappings().all()
        print(f"    [OK] Detected {len(tenants)} tenant(s) in shared database.")

        if not dry_run:
            with master_engine.connect() as master_conn:
                # Create Master tables directly
                master_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS subscription_plans (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(100) NOT NULL UNIQUE,
                        price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                        duration_days INT NOT NULL DEFAULT 30,
                        max_employees INT NOT NULL DEFAULT 5,
                        max_services INT NOT NULL DEFAULT 20,
                        max_customers INT NOT NULL DEFAULT 100,
                        max_branches INT NOT NULL DEFAULT 3,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    );
                """))
                master_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS tenants (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(150) NOT NULL,
                        status VARCHAR(50) NOT NULL DEFAULT 'active',
                        subscription_plan_id INT NOT NULL,
                        subscription_expires_at DATETIME NULL,
                        db_name VARCHAR(150) NULL,
                        db_connection_uri VARCHAR(500) NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        is_deleted BOOLEAN NOT NULL DEFAULT 0,
                        deleted_at DATETIME NULL
                    );
                """))
                for col_def in [
                    "db_name VARCHAR(150) NULL",
                    "db_connection_uri VARCHAR(500) NULL",
                    "is_deleted BOOLEAN NOT NULL DEFAULT 0",
                    "deleted_at DATETIME NULL"
                ]:
                    try:
                        master_conn.execute(text(f"ALTER TABLE tenants ADD COLUMN {col_def};"))
                    except Exception:
                        pass

                # Copy subscription_plans
                plans = old_conn.execute(text("SELECT * FROM subscription_plans")).mappings().all()
                for p in plans:
                    master_conn.execute(
                        text("""
                            INSERT INTO subscription_plans (id, name, price, duration_days, max_employees, max_services, max_customers, max_branches, created_at, updated_at)
                            VALUES (:id, :name, :price, :duration_days, :max_employees, :max_services, :max_customers, :max_branches, :created_at, :updated_at)
                            ON DUPLICATE KEY UPDATE name=VALUES(name);
                        """),
                        dict(p)
                    )

                # Insert tenants
                for t in tenants:
                    t_dict = dict(t)
                    slug = sanitize_slug(t_dict.get("name", ""))
                    t_id = t_dict["id"]
                    db_name = f"tenant_{slug}_{t_id}"
                    db_uri = f"{MYSQL_BASE_URI}{db_name}?charset=utf8mb4"

                    params = {
                        "id": t_id,
                        "name": t_dict.get("name", ""),
                        "status": t_dict.get("status", "active"),
                        "subscription_plan_id": t_dict.get("subscription_plan_id", 1),
                        "subscription_expires_at": t_dict.get("subscription_expires_at", None),
                        "db_name": db_name,
                        "db_connection_uri": db_uri,
                        "created_at": t_dict.get("created_at", None),
                        "updated_at": t_dict.get("updated_at", None),
                        "is_deleted": t_dict.get("is_deleted", False),
                        "deleted_at": t_dict.get("deleted_at", None)
                    }

                    master_conn.execute(
                        text("""
                            INSERT INTO tenants (id, name, status, subscription_plan_id, subscription_expires_at, db_name, db_connection_uri, created_at, updated_at, is_deleted, deleted_at)
                            VALUES (:id, :name, :status, :subscription_plan_id, :subscription_expires_at, :db_name, :db_connection_uri, :created_at, :updated_at, :is_deleted, :deleted_at)
                            ON DUPLICATE KEY UPDATE db_name=VALUES(db_name), db_connection_uri=VALUES(db_connection_uri);
                        """),
                        params
                    )

                # Create tenant_lookups table
                master_conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS tenant_lookups (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        email VARCHAR(150) NOT NULL UNIQUE,
                        tenant_id INT NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                users = old_conn.execute(text("SELECT email, tenant_id FROM users WHERE tenant_id IS NOT NULL")).mappings().all()
                for u in users:
                    master_conn.execute(
                        text("INSERT IGNORE INTO tenant_lookups (email, tenant_id) VALUES (:email, :tenant_id);"),
                        {"email": u["email"], "tenant_id": u["tenant_id"]}
                    )
                master_conn.commit()

    # 5. Fault-Tolerant Tenant Migration Loop
    print(f"\n[STEP 5] Migrating {len(tenants)} Tenants (Fault-Tolerant Loop)...")
    verification_results = {}

    for t in tenants:
        t_id = t["id"]
        slug = sanitize_slug(t["name"])
        db_name = f"tenant_{slug}_{t_id}"
        tenant_db_uri = f"{MYSQL_BASE_URI}{db_name}?charset=utf8mb4"

        print(f"\n -> Processing Tenant #{t_id} ('{t['name']}') -> target DB: `{db_name}`")

        if dry_run:
            print(f"      [DRY-RUN] Planned database: `{db_name}`")
            print(f"      [DRY-RUN] Target connection URI: `{tenant_db_uri}`")
            # Count records in shared DB for preview
            with old_engine.connect() as old_conn:
                for tbl_name in TENANT_DOMAINS:
                    if tbl_name in old_metadata.tables:
                        cnt = old_conn.execute(text(f"SELECT COUNT(*) FROM `{tbl_name}` WHERE tenant_id = :t_id"), {"t_id": t_id}).scalar()
                        if cnt > 0:
                            print(f"        - {tbl_name}: {cnt} records")
            continue

        try:
            # Create physical database
            with sys_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
                conn.execute(text(f"CREATE DATABASE IF NOT EXISTS `{db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))

            # Create full schema on target tenant database using reflected old_metadata structure
            tenant_engine = create_engine(tenant_db_uri)
            old_metadata.create_all(bind=tenant_engine)

            # Copy data rows
            counts_old = {}
            counts_new = {}

            with old_engine.connect() as old_conn, tenant_engine.connect() as new_conn:
                new_conn.execute(text("SET FOREIGN_KEY_CHECKS=0;"))

                for table_name in TENANT_DOMAINS:
                    if table_name not in old_metadata.tables:
                        continue

                    table_obj = old_metadata.tables[table_name]
                    columns = [c.name for c in table_obj.columns]

                    if "tenant_id" in columns:
                        rows = old_conn.execute(
                            text(f"SELECT * FROM `{table_name}` WHERE tenant_id = :t_id"),
                            {"t_id": t_id}
                        ).mappings().all()
                    else:
                        rows = []

                    counts_old[table_name] = len(rows)

                    if rows:
                        col_names = ", ".join([f"`{c}`" for c in columns])
                        val_placeholders = ", ".join([f":{c}" for c in columns])
                        insert_sql = text(f"INSERT IGNORE INTO `{table_name}` ({col_names}) VALUES ({val_placeholders})")

                        for r in rows:
                            new_conn.execute(insert_sql, dict(r))

                    # Count rows in new DB
                    new_count = new_conn.execute(text(f"SELECT COUNT(*) FROM `{table_name}`")).scalar()
                    counts_new[table_name] = new_count

                new_conn.execute(text("SET FOREIGN_KEY_CHECKS=1;"))
                new_conn.commit()

            # Record auditing metrics for report
            verification_results[t_id] = {
                "name": t["name"],
                "status": "SUCCESS",
                "counts_old": counts_old,
                "counts_new": counts_new
            }
            print(f"      [OK] Successfully migrated data for tenant '{t['name']}'")

        except Exception as err:
            print(f"      [FAIL] ERROR migrating tenant #{t_id} ('{t['name']}'): {err}")
            verification_results[t_id] = {
                "name": t["name"],
                "status": "FAILED",
                "error": str(err)
            }
            continue

    # 6. Post-Migration Audit PASS/FAIL Report
    print("\n" + "=" * 75)
    print("               POST-MIGRATION VERIFICATION REPORT")
    print("=" * 75)

    if dry_run:
        print("[!] DRY-RUN Completed successfully. No changes were made to databases.")
        return

    all_passed = True
    for t_id, res in verification_results.items():
        print(f"\nTenant ID: {t_id} | Name: {res['name']}")
        if res["status"] == "FAILED":
            print(f"  Overall Status: [FAIL] - {res['error']}")
            all_passed = False
            continue

        tenant_pass = True
        print(f"  {'Table':<25} | {'Old Shared Count':<18} | {'New Tenant DB Count':<20} | Status")
        print("  " + "-" * 75)
        for tbl in TENANT_DOMAINS:
            old_cnt = res["counts_old"].get(tbl, 0)
            new_cnt = res["counts_new"].get(tbl, 0)
            match = (old_cnt == new_cnt)
            if not match:
                tenant_pass = False
                all_passed = False
            status_str = "PASS" if match else "FAIL [X]"
            print(f"  {tbl:<25} | {old_cnt:<18} | {new_cnt:<20} | {status_str}")

        print(f"  Tenant Result: {'[OK] PASS' if tenant_pass else '[FAIL] - Row Count Mismatch'}")

    print("\n" + "=" * 75)
    if all_passed:
        print("AUDIT PASSED: ALL TENANTS MIGRATED SUCCESSFULLY WITH 100% MATCHING ROWS!")
    else:
        print("AUDIT ALERT: ONE OR MORE TENANTS HAD MIGRATION ERRORS OR ROW COUNT MISMATCHES.")
    print("=" * 75)

if __name__ == "__main__":
    main()
