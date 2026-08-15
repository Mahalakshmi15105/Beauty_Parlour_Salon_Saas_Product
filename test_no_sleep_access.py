"""
Test backend access after disabling auto-sleep
"""
import requests
import time

API_BASE = "http://localhost:5000/api/v1"

# Test login
print("Testing login...")
login_response = requests.post(f"{API_BASE}/auth/login", json={
    "email": "superadmin@smartgonext.com",
    "password": "admin123"
})

print(f"Login status: {login_response.status_code}")
if login_response.status_code == 200:
    token = login_response.json().get("data", {}).get("token")
    print(f"SUCCESS: Login successful, got token: {token[:20] if token else 'None'}...")
    
    if not token:
        print(f"FAILED: No token in response")
        print(f"Response: {login_response.text}")
        exit(1)
    
    # Test authenticated API calls
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\nTesting authenticated APIs...")
    
    # Test dashboard
    dashboard = requests.get(f"{API_BASE}/super-admin/dashboard", headers=headers)
    print(f"Dashboard: {dashboard.status_code} {'SUCCESS' if dashboard.status_code == 200 else 'FAILED'}")
    if dashboard.status_code != 200:
        print(f"Dashboard error: {dashboard.text}")
    
    # Test tenants
    tenants = requests.get(f"{API_BASE}/super-admin/tenants", headers=headers)
    print(f"Tenants: {tenants.status_code} {'SUCCESS' if tenants.status_code == 200 else 'FAILED'}")
    if tenants.status_code != 200:
        print(f"Tenants error: {tenants.text}")
    
    # Test analytics
    analytics = requests.get(f"{API_BASE}/super-admin/analytics", headers=headers)
    print(f"Analytics: {analytics.status_code} {'SUCCESS' if analytics.status_code == 200 else 'FAILED'}")
    if analytics.status_code != 200:
        print(f"Analytics error: {analytics.text}")
    
    print("\nSUCCESS: All APIs working after auto-sleep disabled")
else:
    print(f"FAILED: Login failed: {login_response.text}")
