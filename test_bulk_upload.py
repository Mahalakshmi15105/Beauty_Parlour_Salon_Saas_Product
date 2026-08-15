"""
Test Bulk Upload APIs
"""
import requests
import openpyxl
from io import BytesIO

API_BASE = "http://localhost:5000/api/v1"

# Login first
print("Testing login...")
login_response = requests.post(f"{API_BASE}/auth/login", json={
    "email": "superadmin@smartgonext.com",
    "password": "admin123"
})

if login_response.status_code == 200:
    token = login_response.json().get("data", {}).get("token")
    print(f"Login successful")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test if bulk upload route exists
    print("\nTesting bulk upload route availability...")
    test_response = requests.get(f"{API_BASE}/bulk-upload/template/customers", headers=headers)
    print(f"Route test: {test_response.status_code}")
    print(f"Response: {test_response.text}")
    
    # Test existing routes to make sure auth is working
    print("\nTesting existing dashboard route...")
    dashboard_response = requests.get(f"{API_BASE}/super-admin/dashboard", headers=headers)
    print(f"Dashboard: {dashboard_response.status_code}")
else:
    print(f"Login failed: {login_response.text}")