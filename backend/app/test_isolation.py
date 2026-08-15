import requests
from app import create_app
from app.models.user import User
from flask_jwt_extended import create_access_token

BASE_URL = "http://localhost:5000/api/v1"

def get_tokens():
    app = create_app()
    with app.app_context():
        u1 = User.query.filter_by(tenant_id=1, role='ParlourAdmin').first()
        u3 = User.query.filter_by(tenant_id=3, role='ParlourAdmin').first()
        t1 = create_access_token(identity=str(u1.id), additional_claims={'parlour_id': u1.tenant_id, 'branch_id': u1.branch_id, 'role': u1.role})
        t3 = create_access_token(identity=str(u3.id), additional_claims={'parlour_id': u3.tenant_id, 'branch_id': u3.branch_id, 'role': u3.role})
        return t1, t3

def test_isolation():
    print("=== STARTING COMPREHENSIVE MULTI-TENANT & BRANCH ISOLATION SECURITY TESTS ===")
    
    p1_token, p3_token = get_tokens()
    headers_p1 = {"Authorization": f"Bearer {p1_token}"}
    headers_p3 = {"Authorization": f"Bearer {p3_token}"}

    # TEST 1: Cross-Parlour Customer Access Check
    print("\n[TEST 1] Testing Cross-Parlour Customer Isolation...")
    res_p1_cust = requests.get(f"{BASE_URL}/customers?limit=100", headers=headers_p1).json()
    p1_cust_ids = [c["id"] for c in res_p1_cust.get("data", {}).get("items", [])]
    
    res_p3_cust = requests.get(f"{BASE_URL}/customers?limit=100", headers=headers_p3).json()
    p3_cust_ids = [c["id"] for c in res_p3_cust.get("data", {}).get("items", [])]

    overlap = set(p1_cust_ids).intersection(set(p3_cust_ids))
    print(f"  Tenant 1 Customers: {len(p1_cust_ids)} | Tenant 3 Customers: {len(p3_cust_ids)}")
    if overlap:
        print(f"  [FAIL] Overlapping customer IDs found between tenants: {overlap}")
    else:
        print("  [PASS] Tenant Customer isolation verified (0 overlapping IDs).")

    # TEST 2: Cross-Parlour Direct Object Reference Attempt
    if p3_cust_ids:
        target_id = p3_cust_ids[0]
        res_cross = requests.get(f"{BASE_URL}/customers/{target_id}", headers=headers_p1)
        print(f"  Attempting Tenant 1 access to Tenant 3 Customer ID {target_id}: Status {res_cross.status_code}")
        if res_cross.status_code == 404:
            print("  [PASS] Unauthorized cross-tenant customer GET blocked with HTTP 404.")
        else:
            print(f"  [FAIL] Unauthorized cross-tenant GET allowed! Status: {res_cross.status_code}")

    # TEST 3: Employee Branch Assignment & Security Validation
    print("\n[TEST 3] Testing Employee Branch Assignment Security...")
    emp_payload = {
        "first_name": "HackEmp",
        "last_name": "Test",
        "phone": "9998887771",
        "branch_id": 9999
    }
    res_emp_hack = requests.post(f"{BASE_URL}/employees", json=emp_payload, headers=headers_p1)
    print(f"  Creating employee with invalid branch_id=9999: Status {res_emp_hack.status_code}")
    if res_emp_hack.status_code == 400:
        print("  [PASS] Invalid branch_id assignment rejected with HTTP 400.")
    else:
        print(f"  [FAIL] Invalid branch_id accepted! Status: {res_emp_hack.status_code}")

    # TEST 4: Public Booking URL & Branch Appointment Isolation
    print("\n[TEST 4] Testing Public Booking URL & Branch Appointment Isolation...")
    res_b_config = requests.get(f"{BASE_URL}/public/booking/3/config").json()
    b_data = res_b_config.get("data", {})
    print(f"  Public Config for Tenant 3: Name='{b_data.get('parlour_name')}' | Theme={b_data.get('theme', {}).get('primary_color')}")
    
    booking_payload = {
        "customer_name": "Public Security Tester",
        "customer_phone": "9876543210",
        "appointment_date": "2026-08-20",
        "start_time": "11:00",
        "booking_type": "Slot",
        "branch_id": 999,  # Malicious injected branch_id
        "items": [{"service_id": 1}]
    }
    res_book = requests.post(f"{BASE_URL}/public/booking/3", json=booking_payload)
    print(f"  Public booking attempt with injected branch_id=999: Status {res_book.status_code}")
    if res_book.status_code in (201, 200):
        data_apt = res_book.json().get("data", {})
        print(f"  Appointment created with ID {data_apt.get('id')}. Appointment branch_id={data_apt.get('branch_id')}")
        if data_apt.get("branch_id") != 999:
            print("  [PASS] Injected payload branch_id was ignored; appointment bound to resolved URL context.")
        else:
            print("  [FAIL] Malicious branch_id from JSON payload was trusted!")

    print("\n=== MULTI-TENANT & BRANCH ISOLATION SECURITY TESTS COMPLETED ===")

if __name__ == "__main__":
    test_isolation()
