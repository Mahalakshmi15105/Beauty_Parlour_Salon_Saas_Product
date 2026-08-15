import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.branch import Branch
from app.models.user import User
from app.models.global_models import Tenant
from app.database import db
import time

app = create_app()

with app.app_context():
    print("Creating test branch...")
    
    # Get tenant
    tenant = Tenant.query.get(1)
    print(f"Tenant: {tenant.name}")
    
    # Create branch
    timestamp = int(time.time())
    branch_email = f"branchadmin{timestamp}@test.com"
    
    branch = Branch(
        tenant_id=1,
        name="Main Branch Test",
        address="123 Main Street",
        phone="1234567890",
        email="main@branch.com",
        opening_time="09:00",
        closing_time="20:00",
        status="active"
    )
    db.session.add(branch)
    db.session.flush()
    
    print(f"Branch created with ID: {branch.id}")
    
    # Create BranchAdmin
    branch_admin = User(
        tenant_id=1,
        branch_id=branch.id,
        email=branch_email,
        role="BranchAdmin",
        status="active"
    )
    branch_admin.set_password("BranchAdmin123!")
    db.session.add(branch_admin)
    
    db.session.commit()
    
    print(f"Branch Admin created with ID: {branch_admin.id}")
    print(f"\nBranchAdmin Login Credentials:")
    print(f"Email: {branch_email}")
    print(f"Password: BranchAdmin123!")
    print(f"Frontend URL: http://localhost:5174")
