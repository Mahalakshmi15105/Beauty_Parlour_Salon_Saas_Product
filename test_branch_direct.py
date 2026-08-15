import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.branch import Branch
from app.models.global_models import Tenant
from app.database import db

app = create_app()

with app.app_context():
    # Test creating a branch directly
    try:
        tenant = Tenant.query.get(1)
        print(f"Tenant: {tenant.name}")
        
        branch = Branch(
            tenant_id=1,
            name="Test Branch",
            address="123 Test St",
            phone="1234567890",
            email="test@branch.com",
            opening_time="09:00",
            closing_time="20:00",
            status="active"
        )
        db.session.add(branch)
        db.session.commit()
        print(f"Branch created with ID: {branch.id}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
