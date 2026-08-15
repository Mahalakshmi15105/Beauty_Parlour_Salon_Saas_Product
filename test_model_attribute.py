import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.customer import Customer

app = create_app()

with app.app_context():
    print("Checking Customer model for branch_id attribute:")
    print(f"  hasattr(Customer, 'branch_id'): {hasattr(Customer, 'branch_id')}")
    print(f"  Customer.branch_id: {Customer.branch_id}")
    print(f"  Customer.__table__.columns: {[c.name for c in Customer.__table__.columns]}")
