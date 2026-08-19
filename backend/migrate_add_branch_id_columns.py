import sys
import os
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app import create_app
from app.database import db

def run_migrations():
    app = create_app()
    with app.app_context():
        tables = [
            "service_categories",
            "services",
            "products",
            "suppliers",
            "membership_plans",
            "customer_memberships",
            "membership_benefits"
        ]

        for tbl in tables:
            try:
                db.session.execute(text(f"ALTER TABLE `{tbl}` ADD COLUMN `branch_id` INT NULL INDEX (`branch_id`);"))
                db.session.commit()
                print(f"[MIGRATED] Added branch_id column to '{tbl}' table.")
            except Exception as e:
                db.session.rollback()
                if "Duplicate column name" in str(e) or "1060" in str(e):
                    print(f"[SKIP] Column branch_id already exists in '{tbl}' table.")
                else:
                    # Retry without INDEX keyword syntax if MySQL vs SQLite
                    try:
                        db.session.execute(text(f"ALTER TABLE `{tbl}` ADD COLUMN `branch_id` INT NULL;"))
                        db.session.commit()
                        print(f"[MIGRATED] Added branch_id column to '{tbl}' table.")
                    except Exception as e2:
                        db.session.rollback()
                        print(f"[INFO] '{tbl}': {e2}")

if __name__ == "__main__":
    run_migrations()
