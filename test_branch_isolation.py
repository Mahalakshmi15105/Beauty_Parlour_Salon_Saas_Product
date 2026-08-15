import sys
sys.path.insert(0, r'C:\Users\mahal\OneDrive\Desktop\parlour\backend')

from app import create_app
from app.models.branch import Branch
from app.models.user import User
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.global_models import Tenant
from app.database import db
import time

app = create_app()

with app.app_context():
    print("Branch Isolation Test")
    print("=" * 50)
    
    # Get tenant
    tenant = db.session.get(Tenant, 1)
    print(f"Tenant: {tenant.name}")
    
    # Create Branch 1
    timestamp1 = int(time.time())
    branch1 = Branch(
        tenant_id=1,
        name="Branch Test Alpha",
        address="Address Alpha",
        phone="1111111111",
        email="alpha@branch.com",
        opening_time="09:00",
        closing_time="20:00",
        status="active"
    )
    db.session.add(branch1)
    db.session.flush()
    
    branch1_admin = User(
        tenant_id=1,
        branch_id=branch1.id,
        email=f"branchadmin1_{timestamp1}@test.com",
        role="BranchAdmin",
        status="active"
    )
    branch1_admin.set_password("BranchAdmin123!")
    db.session.add(branch1_admin)
    
    # Create Branch 2
    timestamp2 = int(time.time())
    branch2 = Branch(
        tenant_id=1,
        name="Branch Test Beta",
        address="Address Beta",
        phone="2222222222",
        email="beta@branch.com",
        opening_time="09:00",
        closing_time="20:00",
        status="active"
    )
    db.session.add(branch2)
    db.session.flush()
    
    branch2_admin = User(
        tenant_id=1,
        branch_id=branch2.id,
        email=f"branchadmin2_{timestamp2}@test.com",
        role="BranchAdmin",
        status="active"
    )
    branch2_admin.set_password("BranchAdmin123!")
    db.session.add(branch2_admin)
    
    db.session.commit()
    
    print(f"Branch 1 created: {branch1.name} (ID: {branch1.id})")
    print(f"Branch 1 Admin: {branch1_admin.email}")
    print(f"Branch 2 created: {branch2.name} (ID: {branch2.id})")
    print(f"Branch 2 Admin: {branch2_admin.email}")
    
    # Create test data for Branch 1
    customer1 = Customer(
        tenant_id=1,
        branch_id=branch1.id,
        first_name="Alpha",
        last_name="Customer",
        phone="9999999991",
        email="alpha@customer.com"
    )
    db.session.add(customer1)
    
    employee1 = Employee(
        tenant_id=1,
        branch_id=branch1.id,
        first_name="Alpha",
        last_name="Employee",
        phone="8888888881",
        specialization="Hair Styling",
        status="active"
    )
    db.session.add(employee1)
    
    # Create test data for Branch 2
    customer2 = Customer(
        tenant_id=1,
        branch_id=branch2.id,
        first_name="Beta",
        last_name="Customer",
        phone="9999999992",
        email="beta@customer.com"
    )
    db.session.add(customer2)
    
    employee2 = Employee(
        tenant_id=1,
        branch_id=branch2.id,
        first_name="Beta",
        last_name="Employee",
        phone="8888888882",
        specialization="Skin Care",
        status="active"
    )
    db.session.add(employee2)
    
    db.session.commit()
    
    print(f"\nTest Data Created:")
    print(f"Branch 1 Customer: {customer1.first_name} {customer1.last_name}")
    print(f"Branch 1 Employee: {employee1.first_name} {employee1.last_name}")
    print(f"Branch 2 Customer: {customer2.first_name} {customer2.last_name}")
    print(f"Branch 2 Employee: {employee2.first_name} {employee2.last_name}")
    
    # Test isolation
    print(f"\nTesting Data Isolation:")
    
    # Branch 1 should only see its own data
    branch1_customers = Customer.query.filter_by(tenant_id=1, branch_id=branch1.id).all()
    branch1_employees = Employee.query.filter_by(tenant_id=1, branch_id=branch1.id).all()
    
    print(f"Branch 1 Customers: {len(branch1_customers)} (expected: 1)")
    print(f"Branch 1 Employees: {len(branch1_employees)} (expected: 1)")
    
    # Branch 2 should only see its own data
    branch2_customers = Customer.query.filter_by(tenant_id=1, branch_id=branch2.id).all()
    branch2_employees = Employee.query.filter_by(tenant_id=1, branch_id=branch2.id).all()
    
    print(f"Branch 2 Customers: {len(branch2_customers)} (expected: 1)")
    print(f"Branch 2 Employees: {len(branch2_employees)} (expected: 1)")
    
    # Verify no cross-contamination
    branch1_customer_ids = [c.id for c in branch1_customers]
    branch2_customer_ids = [c.id for c in branch2_customers]
    
    assert customer1.id in branch1_customer_ids, "Branch 1 should see customer1"
    assert customer2.id not in branch1_customer_ids, "Branch 1 should NOT see customer2"
    assert customer2.id in branch2_customer_ids, "Branch 2 should see customer2"
    assert customer1.id not in branch2_customer_ids, "Branch 2 should NOT see customer1"
    
    print(f"\nIsolation Test: PASSED")
    print(f"Test Credentials:")
    print(f"Branch 1 Admin: {branch1_admin.email} / BranchAdmin123!")
    print(f"Branch 2 Admin: {branch2_admin.email} / BranchAdmin123!")
    print(f"Frontend URL: http://localhost:5173")
