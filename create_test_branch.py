import requests
import time

BASE_URL = "http://localhost:5000/api/v1"

# Login as ParlourAdmin
print("1. Logging in as ParlourAdmin...")
login_response = requests.post(f"{BASE_URL}/auth/login", json={
    "email": "admin@smartgonext.com",
    "password": "ParlourAdmin123!"
})

if login_response.status_code == 200:
    token = login_response.json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("SUCCESS: ParlourAdmin logged in")
else:
    print(f"FAILED: Login failed: {login_response.text}")
    exit(1)

# Create a test branch
print("\n2. Creating test branch...")
timestamp = int(time.time())
branch_data = {
    "name": "Main Branch Test",
    "address": "123 Main Street",
    "phone": "1234567890",
    "email": "main@branch.com",
    "admin_email": f"branchadmin{timestamp}@test.com",
    "admin_password": "BranchAdmin123!"
}

branch_response = requests.post(f"{BASE_URL}/branches", json=branch_data, headers=headers)
if branch_response.status_code == 201 or (branch_response.json().get("success") and branch_response.json().get("data")):
    branch_info = branch_response.json()["data"]
    print(f"SUCCESS: Branch created with ID: {branch_info['id']}")
    print(f"Branch Admin Email: {branch_info.get('branch_admin_email')}")
    print(f"Branch Admin Password: BranchAdmin123!")
    print(f"\nYou can now test the BranchAdmin UI with these credentials:")
    print(f"Email: {branch_info.get('branch_admin_email')}")
    print(f"Password: BranchAdmin123!")
    print(f"Frontend URL: http://localhost:5174")
else:
    print(f"FAILED: Branch creation failed: {branch_response.text}")
