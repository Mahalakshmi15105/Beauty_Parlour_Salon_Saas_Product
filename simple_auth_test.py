import requests
import sys

BASE_URL = "http://localhost:5000/api/v1"

def test_auth():
    print("Testing BranchAdmin Authorization")
    print("=" * 40)
    
    # Login
    print("Login attempt...")
    r = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "branchadmin1786547115@test.com",
        "password": "BranchAdmin123!"
    })
    
    if r.status_code != 200:
        print(f"Login failed: {r.status_code}")
        print(r.text)
        return False
    
    token = r.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("Login successful")
    
    # Test endpoints
    endpoints = [
        ("/customers", "Customers"),
        ("/employees", "Employees"),
        ("/services", "Services"),
        ("/products", "Products"),
        ("/invoices", "Invoices"),
        ("/notifications?limit=10", "Notifications"),
        ("/settings", "Settings"),
        ("/reports/dashboard", "Reports"),
        ("/memberships", "Memberships"),
    ]
    
    print("\nTesting endpoints:")
    for endpoint, name in endpoints:
        r = requests.get(f"{BASE_URL}{endpoint}", headers=headers)
        status = "OK" if r.status_code == 200 else f"FAIL({r.status_code})"
        print(f"  {name}: {status}")
        if r.status_code != 200:
            print(f"    {r.text[:100]}")
    
    # Test branch management should be forbidden
    print("\nTesting branch management access:")
    r = requests.get(f"{BASE_URL}/branches", headers=headers)
    status = "OK" if r.status_code == 403 else f"FAIL({r.status_code})"
    print(f"  Branch Management: {status} (should be 403)")
    
    return True

if __name__ == "__main__":
    try:
        test_auth()
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
