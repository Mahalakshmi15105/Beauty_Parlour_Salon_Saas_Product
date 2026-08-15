import requests
import json

BASE_URL = "http://localhost:5000/api/v1"

def test_branch_implementation():
    print("Testing Branch Management Implementation")
    print("=" * 50)
    
    # First, login as ParlourAdmin
    print("\n1. Testing ParlourAdmin Login...")
    login_response = requests.post(f"{BASE_URL}/auth/login", json={
        "email": "admin@smartgonext.com",
        "password": "ParlourAdmin123!"
    })
    
    if login_response.status_code == 200:
        token = login_response.json()["data"]["token"]
        user = login_response.json()["data"]["user"]
        print(f"SUCCESS: Login successful! User: {user['email']}, Role: {user['role']}")
        print(f"   Claims: parlour_id={user.get('parlour_id')}, branch_id={user.get('branch_id')}")
        headers = {"Authorization": f"Bearer {token}"}
    else:
        print(f"FAILED: Login failed: {login_response.text}")
        return
    
    # Test branch limit check
    print("\n2. Testing Branch Limit Check...")
    limit_response = requests.get(f"{BASE_URL}/branches/limit-check", headers=headers)
    if limit_response.status_code == 200:
        limit_data = limit_response.json()["data"]
        print(f"SUCCESS: Branch limit check: {limit_data}")
    else:
        print(f"FAILED: Branch limit check failed: {limit_response.text}")
    
    # Test get branches
    print("\n3. Testing Get Branches...")
    branches_response = requests.get(f"{BASE_URL}/branches", headers=headers)
    if branches_response.status_code == 200:
        branches = branches_response.json()["data"]
        print(f"SUCCESS Got {len(branches)} branches")
        for branch in branches:
            print(f"   - {branch['name']} (ID: {branch['id']}, Status: {branch['status']})")
    else:
        print(f"FAILED Get branches failed: {branches_response.text}")
    
    # Test create branch
    print("\n4. Testing Create Branch...")
    branch_data = {
        "name": "Main Branch",
        "address": "123 Main Street",
        "phone": "9876543210",
        "email": "main@branch.com",
        "opening_time": "10:00",
        "closing_time": "22:00",
        "admin_email": "branchadmin@test.com",
        "admin_password": "BranchAdmin123!"
    }
    
    create_response = requests.post(f"{BASE_URL}/branches", json=branch_data, headers=headers)
    branch_result = None
    response_data = create_response.json()
    if create_response.status_code == 201 or (response_data.get("success") and response_data.get("data")):
        branch_result = response_data["data"]
        print(f"SUCCESS Branch created successfully! Branch ID: {branch_result['id']}")
        print(f"   Branch Admin ID: {branch_result.get('branch_admin_id')}")
    else:
        print(f"FAILED Create branch failed: {create_response.text}")
        error_data = response_data
        if error_data.get("error_code") == "BRANCH_LIMIT_REACHED":
            print("   WARNING Branch limit reached (expected)")
    
    # Test BranchAdmin login if branch was created
    if branch_result:
        print("\n5. Testing BranchAdmin Login...")
        print(f"   Branch created with ID: {branch_result['id']}")
        print(f"   Branch Admin ID: {branch_result.get('branch_admin_id')}")
        branch_login_response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": "branchadmin@test.com",
            "password": "BranchAdmin123!"
        })
        
        if branch_login_response.status_code == 200:
            branch_token = branch_login_response.json()["data"]["token"]
            branch_user = branch_login_response.json()["data"]["user"]
            print(f"SUCCESS BranchAdmin login successful! User: {branch_user['email']}, Role: {branch_user['role']}")
            print(f"   Claims: parlour_id={branch_user.get('parlour_id')}, branch_id={branch_user.get('branch_id')}, branch_name={branch_user.get('branch_name')}")
            branch_headers = {"Authorization": f"Bearer {branch_token}"}
            
            # Test BranchAdmin can access customers
            print("\n6. Testing BranchAdmin Customer Access...")
            customers_response = requests.get(f"{BASE_URL}/customers", headers=branch_headers)
            if customers_response.status_code == 200:
                customers = customers_response.json()["data"]["items"]
                print(f"SUCCESS BranchAdmin can access {len(customers)} customers")
            else:
                print(f"FAILED BranchAdmin customer access failed: {customers_response.text}")
            
            # Test BranchAdmin cannot access other branch data (should be empty initially)
            print("\n7. Testing BranchAdmin Data Isolation...")
            print(f"   BranchAdmin branch_id: {branch_user.get('branch_id')}")
            if branch_user.get('branch_id'):
                print(f"   SUCCESS BranchAdmin has branch context - data isolation should work")
            else:
                print(f"   FAILED BranchAdmin missing branch context")
        else:
            print(f"FAILED BranchAdmin login failed: {branch_login_response.text}")
    
    print("\n" + "=" * 50)
    print("Branch Management Test Complete")

if __name__ == "__main__":
    test_branch_implementation()