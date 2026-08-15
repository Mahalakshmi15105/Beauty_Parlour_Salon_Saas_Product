import requests
from app import create_app
from app.models.user import User
from app.models.customer import Customer
from flask_jwt_extended import create_access_token

BASE_URL = "http://localhost:5000/api/v1"

def get_branch_admin_token():
    app = create_app()
    with app.app_context():
        # Find BranchAdmin user for Branch 27 (www3.0) or Tenant 4 Branch 19
        u = User.query.filter_by(role='BranchAdmin').first()
        if not u:
            print("No BranchAdmin user found!")
            return None, None, None
        token = create_access_token(identity=str(u.id), additional_claims={'parlour_id': u.tenant_id, 'branch_id': u.branch_id, 'role': u.role})
        return token, u.tenant_id, u.branch_id

def test_fixes():
    print("=== TESTING EXACT CUSTOMER BRANCH ASSIGNMENT & BRANCHADMIN SERVICES FIXES ===")
    
    token, tenant_id, branch_id = get_branch_admin_token()
    if not token:
        print("Failed to generate BranchAdmin token.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    print(f"Logged in as BranchAdmin | Tenant ID: {tenant_id} | Branch ID: {branch_id}")

    # TEST 1: Branch A Customer Creation
    test_phone = "9988776655"
    cust_payload = {
        "first_name": "TestBranchCust",
        "last_name": "Verified",
        "phone": test_phone
    }
    
    # Delete test customer if exists
    app = create_app()
    with app.app_context():
        existing = Customer.query.filter_by(tenant_id=tenant_id, phone=test_phone).first()
        if existing:
            from app.database import db
            db.session.delete(existing)
            db.session.commit()

    res_create = requests.post(f"{BASE_URL}/customers", json=cust_payload, headers=headers)
    print(f"\n1. POST /customers as BranchAdmin: HTTP {res_create.status_code}")
    if res_create.status_code in (201, 200):
        new_cust = res_create.json()["data"]
        cust_id = new_cust["id"]
        
        # Verify Database Record
        with app.app_context():
            db_cust = Customer.query.get(cust_id)
            print(f"   Database Record -> Customer ID: {db_cust.id} | tenant_id: {db_cust.tenant_id} | branch_id: {db_cust.branch_id}")
            if db_cust.branch_id == branch_id:
                print("   [PASS] Customer correctly saved with g.branch_id in MySQL!")
            else:
                print(f"   [FAIL] Customer saved with incorrect branch_id: {db_cust.branch_id}")

    # TEST 2: GET /services as BranchAdmin
    res_services = requests.get(f"{BASE_URL}/services?limit=100", headers=headers)
    print(f"\n2. GET /services as BranchAdmin: HTTP {res_services.status_code}")
    if res_services.status_code == 200:
        svcs = res_services.json().get("data", {}).get("items", [])
        print(f"   [PASS] Services page loaded cleanly without HTTP 403! Returned {len(svcs)} parlour services.")
    else:
        print(f"   [FAIL] GET /services failed with status {res_services.status_code}: {res_services.text}")

    # TEST 3: GET /products as BranchAdmin
    res_products = requests.get(f"{BASE_URL}/products?limit=100", headers=headers)
    print(f"\n3. GET /products as BranchAdmin: HTTP {res_products.status_code}")
    if res_products.status_code == 200:
        prods = res_products.json().get("data", {}).get("items", [])
        print(f"   [PASS] Products inventory loaded cleanly! Returned {len(prods)} parlour products.")
    else:
        print(f"   [FAIL] GET /products failed with status {res_products.status_code}")

    print("\n=== VERIFICATION TESTS COMPLETED ===")

if __name__ == "__main__":
    test_fixes()
