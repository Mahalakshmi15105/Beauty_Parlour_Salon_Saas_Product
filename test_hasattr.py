import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.customer import Customer
from flask import g

app = create_app()

with app.app_context():
    print("Testing hasattr with Customer model:")
    print(f"  hasattr(Customer, 'branch_id'): {hasattr(Customer, 'branch_id')}")
    print(f"  hasattr(Customer, 'nonexistent'): {hasattr(Customer, 'nonexistent')}")
    
    # Test like in get_branch_query
    print(f"\n  hasattr(Customer, 'branch_id') (like in auth): {hasattr(Customer, 'branch_id')}")
    
    # Test with instance
    customer = Customer(first_name="Test", phone="123")
    print(f"  hasattr(customer, 'branch_id'): {hasattr(customer, 'branch_id')}")
