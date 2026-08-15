import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.customer import Customer
from flask import g

app = create_app()

with app.app_context():
    # Set up BranchAdmin context
    g.parlour_id = 1
    g.role = "BranchAdmin"
    g.branch_id = 16
    
    from app.utils.auth import get_branch_query
    query = get_branch_query(Customer)
    customers = query.all()
    
    print(f"Query results for BranchAdmin (branch_id=16):")
    print(f"  Count: {len(customers)}")
    for customer in customers:
        print(f"  ID: {customer.id}, Name: {customer.first_name} {customer.last_name}, branch_id: {customer.branch_id}")
        print(f"  Customer object type: {type(customer)}")
        print(f"  hasattr branch_id: {hasattr(customer, 'branch_id')}")
        print(f"  customer.branch_id type: {type(customer.branch_id)}")
