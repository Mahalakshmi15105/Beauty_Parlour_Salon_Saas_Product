import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.customer import Customer
from app.models.branch import Branch
from app.database import db

app = create_app()

with app.app_context():
    # Get the test customers
    customers = Customer.query.filter(Customer.first_name.in_(['John', 'Jane'])).order_by(Customer.id.desc()).limit(2).all()
    
    print("Direct database query results:")
    for customer in customers:
        print(f"  ID: {customer.id}, Name: {customer.first_name} {customer.last_name}, branch_id: {customer.branch_id}")
    
    # Test get_branch_query with simulated BranchAdmin context
    from flask import g
    g.parlour_id = 1
    g.role = "BranchAdmin"
    g.branch_id = 14
    
    from app.utils.auth import get_branch_query
    query = get_branch_query(Customer)
    print(f"Query: {query}")
    branch_customers = query.all()
    
    print(f"\nBranchAdmin (branch_id=14) query results:")
    print(f"  Count: {len(branch_customers)}")
    for customer in branch_customers:
        print(f"  ID: {customer.id}, Name: {customer.first_name} {customer.last_name}, branch_id: {customer.branch_id}")
