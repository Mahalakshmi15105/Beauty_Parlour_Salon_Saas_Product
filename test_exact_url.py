"""
Test with curl-like requests
"""
import requests

API_BASE = "http://localhost:5000/api/v1"

# Test with exact URL
print("Testing exact URL...")
response = requests.get(f"{API_BASE}/bulk-upload/template/customers")
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Try with trailing slash
print("\nTesting with trailing slash...")
response = requests.get(f"{API_BASE}/bulk-upload/template/customers/")
print(f"Status: {response.status_code}")
print(f"Response: {response.text}")

# Test auth then bulk upload
print("\nTesting with auth...")
auth_response = requests.post(f"{API_BASE}/auth/login", json={
    "email": "superadmin@smartgonext.com",
    "password": "admin123"
})
if auth_response.status_code == 200:
    token = auth_response.json().get("data", {}).get("token")
    headers = {"Authorization": f"Bearer {token}"}
    
    response = requests.get(f"{API_BASE}/bulk-upload/template/customers", headers=headers)
    print(f"Status with auth: {response.status_code}")
    print(f"Response with auth: {response.text[:300]}")