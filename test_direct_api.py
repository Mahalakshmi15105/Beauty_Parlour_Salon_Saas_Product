"""
Direct API test
"""
import requests

API_BASE = "http://localhost:5000/api/v1"

# Test root endpoint
print("Testing root endpoint...")
try:
    response = requests.get("http://localhost:5000/")
    print(f"Root: {response.status_code}")
except Exception as e:
    print(f"Root error: {e}")

# Test auth endpoint
print("\nTesting auth endpoint...")
try:
    response = requests.post(f"{API_BASE}/auth/login", json={
        "email": "superadmin@smartgonext.com",
        "password": "admin123"
    })
    print(f"Auth: {response.status_code}")
    print(f"Auth response: {response.text[:200]}")
except Exception as e:
    print(f"Auth error: {e}")

# Test bulk upload endpoint directly
print("\nTesting bulk upload endpoint...")
try:
    response = requests.get(f"{API_BASE}/bulk-upload/template/customers")
    print(f"Bulk upload: {response.status_code}")
    print(f"Bulk upload response: {response.text[:200]}")
except Exception as e:
    print(f"Bulk upload error: {e}")