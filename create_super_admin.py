"""
Create a Super Admin user directly in the database
"""
import sys
sys.path.append('C:/Users/mahal/OneDrive/Desktop/parlour/backend')

from app import create_app
from app.database import db
from app.models.user import User
from app.models.global_models import Tenant

app = create_app()

with app.app_context():
    # Check if Super Admin already exists
    existing_super = User.query.filter_by(role='SuperAdmin').first()
    if existing_super:
        print(f"Super Admin already exists: {existing_super.email}")
    else:
        # Create Super Admin user
        super_admin = User(
            email='superadmin@smartgonext.com',
            role='SuperAdmin',
            status='active',
            tenant_id=None,  # Platform-level user
            branch_id=None
        )
        super_admin.set_password('admin123')
        db.session.add(super_admin)
        db.session.commit()
        print("Super Admin user created successfully!")
        print("Email: superadmin@smartgonext.com")
        print("Password: admin123")
