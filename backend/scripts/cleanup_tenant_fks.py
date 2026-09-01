import sys
from sqlalchemy import create_engine, text

sys.path.insert(0, r"c:\Users\mahal\OneDrive\Desktop\parlour\backend")

MYSQL_BASE_URI = "mysql+pymysql://root:root@localhost:3306/"

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def cleanup_all_tenant_fks():
    sys_engine = create_engine(MYSQL_BASE_URI)
    
    # Discover all physical tenant databases
    with sys_engine.connect() as conn:
        db_rows = conn.execute(text("SHOW DATABASES LIKE 'tenant_%';")).all()
        tenant_dbs = [r[0] for r in db_rows]

    print("=" * 85)
    print(f"CLEANING UP LEGACY TENANT FOREIGN KEYS ACROSS {len(tenant_dbs)} TENANT DATABASES")
    print("=" * 85)

    total_dropped = 0

    for db_name in tenant_dbs:
        db_uri = f"{MYSQL_BASE_URI}{db_name}?charset=utf8mb4"
        engine = create_engine(db_uri)

        with engine.connect() as conn:
            # Query all foreign key constraints referencing 'tenants' in this tenant DB
            sql_find_fks = text("""
                SELECT TABLE_NAME, CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE REFERENCED_TABLE_NAME = 'tenants' 
                  AND TABLE_SCHEMA = :db_name;
            """)
            fks = conn.execute(sql_find_fks, {"db_name": db_name}).all()

            if not fks:
                print(f"DB `{db_name}`: No legacy tenant FKs found.")
                continue

            print(f"DB `{db_name}`: Found {len(fks)} legacy FK(s) referencing `tenants`. Dropping...")
            for table_name, constraint_name in fks:
                try:
                    drop_sql = text(f"ALTER TABLE `{table_name}` DROP FOREIGN KEY `{constraint_name}`;")
                    conn.execute(drop_sql)
                    conn.commit()
                    total_dropped += 1
                except Exception as err:
                    print(f"   [!] Error dropping FK `{constraint_name}` on table `{table_name}`: {err}")

    print("\n" + "=" * 85)
    print(f"SUCCESS: DROPPED A TOTAL OF {total_dropped} LEGACY TENANT FOREIGN KEY CONSTRAINTS!")
    print("=" * 85)

if __name__ == "__main__":
    cleanup_all_tenant_fks()
