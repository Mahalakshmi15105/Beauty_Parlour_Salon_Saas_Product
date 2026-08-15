import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.branch import Branch
from app.models.global_models import Tenant
from app.models.user import User
from app.database import db

app = create_app()

with app.app_context():
    # Test creating a branch with the same data as the API call
    try:
        tenant = Tenant.query.get(1)
        print(f"Tenant: {tenant.name}")
        
        branch = Branch(
            tenant_id=1,
            name="Main Branch",
            address="123 Main Street",
            phone="9876543210",
            email="main@branch.com",
            opening_time="10:00",
            closing_time="22:00",
            status="active"
        )
        db.session.add(branch)
        db.session.flush()
        print(f"Branch created with ID: {branch.id}")
        
        # Create BranchAdmin user
        branch_admin = User(
            tenant_id=1,
            branch_id=branch.id,
            email="branchadmin@test.com",
            role="BranchAdmin",
            status="active"
        )
        branch_admin.set_password("BranchAdmin123!")
        db.session.add(branch_admin)
        
        db.session.commit()
        print(f"Branch Admin created with ID: {branch_admin.id}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
