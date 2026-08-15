"""
Simple test to check if the server is accessible
"""
import requests

print("Testing server accessibility...")

try:
    response = requests.get("http://localhost:5000/api/v1/health")
    print(f"Health check: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")

try:
    response = requests.post("http://localhost:5000/api/v1/auth/login", json={
        "email": "superadmin@smartgonext.com",
        "password": "admin123"
    })
    print(f"\nLogin: {response.status_code}")
    if response.status_code == 200:
        token = response.json().get("data", {}).get("token")
        print(f"Got token: {token[:20] if token else 'None'}...")
        
        # Test bulk upload with simple request
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get("http://localhost:5000/api/v1/bulk-upload/template/customers", headers=headers)
        print(f"\nBulk upload template: {response.status_code}")
        print(f"Response: {response.text[:200]}")
except Exception as e:
    print(f"Error: {e}")