"""
Database setup script for fresh installations.
This script handles database initialization, migrations, and seeding.
"""
import os
import sys
from app import create_app
from app.database import db

def setup_database():
    """Initialize database with tables and seed data."""
    app = create_app()
    
    with app.app_context():
        print("Setting up database...")
        
        # Create all tables
        print("Creating database tables...")
        db.create_all()
        print("SUCCESS: Database tables created successfully")
        
        # Check if we need to seed data
        from app.models.global_models import Tenant
        tenant_count = Tenant.query.count()
        
        if tenant_count == 0:
            print("No existing data found. Running seed script...")
            from seed import seed_database
            seed_database()
            print("SUCCESS: Database seeded successfully")
        else:
            print(f"SUCCESS: Database already contains {tenant_count} tenant(s). Skipping seed.")
        
        print("\nSUCCESS: Database setup complete!")
        print("\nDefault credentials:")
        print("  Super Admin: superadmin@smartgonext.com / SuperAdmin123!")
        print("  Parlour Admin: admin@smartgonext.com / ParlourAdmin123!")

if __name__ == "__main__":
    try:
        setup_database()
    except Exception as e:
        print(f"\nERROR: Error during database setup: {e}")
        sys.exit(1)
