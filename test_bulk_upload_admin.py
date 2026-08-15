"""
Test Bulk Upload APIs with ParlourAdmin
"""
import requests

API_BASE = "http://localhost:5000/api/v1"

# Try to login as a regular parlour admin (tenant admin)
print("Testing login with different credentials...")
# First, let's try to get a list of tenants to find a parlour admin
super_admin_login = requests.post(f"{API_BASE}/auth/login", json={
    "email": "superadmin@smartgonext.com",
    "password": "admin123"
})

if super_admin_login.status_code == 200:
    super_token = super_admin_login.json().get("data", {}).get("token")
    headers = {"Authorization": f"Bearer {super_token}"}
    
    # Get tenants to find user emails
    tenants_response = requests.get(f"{API_BASE}/super-admin/tenants", headers=headers)
    print(f"Tenants: {tenants_response.status_code}")
    
    if tenants_response.status_code == 200:
        tenants = tenants_response.json().get("data", [])
        print(f"Found {len(tenants)} tenants")
        
        # Try template download as SuperAdmin first
        print("\nTesting template download as SuperAdmin...")
        template_response = requests.get(f"{API_BASE}/bulk-upload/template/customers", headers=headers)
        print(f"Template download (SuperAdmin): {template_response.status_code}")
        print(f"Response: {template_response.text[:200]}")
else:
    print("SuperAdmin login failed")