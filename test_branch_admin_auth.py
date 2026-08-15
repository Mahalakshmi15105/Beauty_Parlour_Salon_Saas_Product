import requests
import json

BASE_URL = "http://localhost:5000/api/v1"

print("Testing BranchAdmin Authorization Fix")
print("=" * 50)

# Login as BranchAdmin
print("\n1. Logging in as BranchAdmin...")
login_response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "branchadmin1786547115@test.com",
    "password": "BranchAdmin123!"
})

if login_response.status_code == 200:
    token = login_response.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("SUCCESS: BranchAdmin login successful")
else:
    print(f"FAILED: Login failed: {login_response.text}")
    exit(1)

# Test various endpoints
endpoints_to_test = [
    ("GET /customers", "/customers"),
    ("GET /employees", "/employees"),
    ("GET /services", "/services"),
    ("GET /products", "/products"),
    ("GET /invoices", "/invoices"),
    ("GET /notifications", "/notifications?limit=10"),
    ("GET /settings", "/settings"),
    ("GET /reports/dashboard", "/reports/dashboard"),
    ("GET /memberships", "/memberships"),
]

print("\n2. Testing endpoint access...")
for name, endpoint in endpoints_to_test:
    response = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
    status = "PASS" if response.status_code == 200 else "FAIL"
    print(f"{status} {name}: {response.status_code}")
    if response.status_code != 200:
        print(f"  Error: {response.text[:100]}")

print("\n3. Testing that BranchAdmin cannot access branch management...")
response = requests.get(f"{BASE_URL}/branches", headers=headers)
status = "PASS" if response.status_code == 403 else "FAIL"
print(f"{status} GET /branches: {response.status_code} (should be 403)")

print("\nAuthorization fix testing complete!")
