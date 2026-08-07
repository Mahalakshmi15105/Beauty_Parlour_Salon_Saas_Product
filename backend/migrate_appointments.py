import os
import sys
import json
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:password@localhost:3306/smartgonext_beautyparlour")

def migrate_appointments():
    print(f"Connecting to database: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        print("Migrating tenant_settings table columns for Appointments Module...")
        columns_to_add = [
            ("booking_enabled", "TINYINT(1) NOT NULL DEFAULT 1"),
            ("booking_type", "VARCHAR(20) NOT NULL DEFAULT 'Token'"),
            ("allow_staff_selection", "TINYINT(1) NOT NULL DEFAULT 0"),
            ("working_days", "TEXT NULL"),
            ("opening_time", "VARCHAR(20) NOT NULL DEFAULT '09:00'"),
            ("closing_time", "VARCHAR(20) NOT NULL DEFAULT '20:00'"),
            ("break_start_time", "VARCHAR(20) NULL DEFAULT '13:00'"),
            ("break_end_time", "VARCHAR(20) NULL DEFAULT '14:00'"),
            ("booking_interval_minutes", "INT NOT NULL DEFAULT 30"),
            ("max_daily_bookings", "INT NOT NULL DEFAULT 50"),
            ("max_concurrent_slots", "INT NOT NULL DEFAULT 2"),
        ]

        for col_name, col_def in columns_to_add:
            try:
                conn.execute(text(f"ALTER TABLE tenant_settings ADD COLUMN {col_name} {col_def};"))
                print(f"  + Added column: tenant_settings.{col_name}")
            except Exception as e:
                if "Duplicate column name" in str(e) or "1060" in str(e):
                    print(f"  - Column tenant_settings.{col_name} already exists.")
                else:
                    print(f"  ! Error adding {col_name}: {e}")

        conn.commit()

        print("Migrating appointments table for is_deleted column...")
        try:
            conn.execute(text("ALTER TABLE appointments ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0;"))
            print("  + Added column: appointments.is_deleted")
        except Exception as e:
            if "Duplicate column name" in str(e) or "1060" in str(e):
                print("  - Column appointments.is_deleted already exists.")
            else:
                print(f"  ! Note on appointments.is_deleted: {e}")

        conn.commit()

        print("Creating appointments table if not exists...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS appointments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL,
                appointment_number VARCHAR(100) NOT NULL,
                customer_id INT NULL,
                customer_name VARCHAR(150) NOT NULL,
                customer_phone VARCHAR(50) NOT NULL,
                customer_email VARCHAR(120) NULL,
                appointment_date DATE NOT NULL,
                start_time TIME NULL,
                end_time TIME NULL,
                token_number INT NULL,
                total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                estimated_duration_minutes INT NOT NULL DEFAULT 30,
                booking_source VARCHAR(50) NOT NULL DEFAULT 'Walk-in',
                booking_channel VARCHAR(50) NOT NULL DEFAULT 'Website',
                appointment_type VARCHAR(50) NOT NULL DEFAULT 'Regular',
                status VARCHAR(50) NOT NULL DEFAULT 'Booked',
                notes TEXT NULL,
                is_deleted TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted_at DATETIME NULL,
                INDEX idx_app_tenant (tenant_id),
                INDEX idx_app_date (appointment_date),
                INDEX idx_app_phone (customer_phone),
                INDEX idx_app_num (appointment_number),
                INDEX idx_app_deleted (is_deleted),
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """))
        conn.commit()
        print("  + Table appointments ready.")

        print("Creating appointment_items table if not exists...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS appointment_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL,
                appointment_id INT NOT NULL,
                service_id INT NOT NULL,
                employee_id INT NULL,
                price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                duration_minutes INT NOT NULL DEFAULT 30,
                status VARCHAR(50) NOT NULL DEFAULT 'Booked',
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_item_tenant (tenant_id),
                INDEX idx_item_app (appointment_id),
                INDEX idx_item_service (service_id),
                INDEX idx_item_employee (employee_id),
                FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
                FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
                FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """))
        conn.commit()
        print("  + Table appointment_items ready.")

    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate_appointments()
