"""
Test Branch Creation with Limit Enforcement
"""
import requests
import json

BASE = 'http://localhost:5000/api/v1'

print("Testing Branch Creation with Limit Enforcement...")

# First, login as a Parlour Admin to test branch creation
# We need to find a Parlour Admin with a specific plan

# Get tenants to find one with a specific plan
r = requests.post(f'{BASE}/auth/login', json={'email': 'superadmin@smartgonext.com', 'password': 'admin123'}, timeout=10)
token = r.json()['data']['token']
headers = {'Authorization': f'Bearer {token}'}

# Get tenants
r = requests.get(f'{BASE}/super-admin/tenants', headers=headers, timeout=10)
tenants = r.json()['data']['items']

print(f"\n1. Found {len(tenants)} tenants")
for tenant in tenants[:3]:
    print(f"   - {tenant['name']}: Plan={tenant.get('plan_name', 'N/A')}")

# Let's use the first tenant and test branch creation
test_tenant = tenants[0]
print(f"\n2. Testing branch creation for tenant: {test_tenant['name']}")

# We need to login as the Parlour Admin for this tenant
# For now, let's create a test tenant with Silver Plan (1 branch)

# Create a test tenant with Silver Plan
r = requests.get(f'{BASE}/super-admin/subscription-plans', headers=headers, timeout=10)
plans = r.json()['data']
silver_plan = [p for p in plans if p['name'] == 'Silver Plan'][0]

test_tenant_data = {
    'name': 'Branch Limit Test Tenant',
    'admin_email': 'branchtest@test.com',
    'admin_password': 'test123',
    'plan_id': silver_plan['id']
}

r = requests.post(f'{BASE}/super-admin/tenants', json=test_tenant_data, headers=headers, timeout=10)
print(f"   Created test tenant: {r.status_code}")
if r.status_code == 201:
    print(f"   Tenant ID: {r.json()['data']['tenant_id']}")
    tenant_id = r.json()['data']['tenant_id']
else:
    print(f"   Error: {r.text[:200]}")
    tenant_id = None

if tenant_id:
    # Login as the test tenant admin
    r = requests.post(f'{BASE}/auth/login', json={'email': 'branchtest@test.com', 'password': 'test123'}, timeout=10)
    if r.status_code == 200:
        admin_token = r.json()['data']['token']
        admin_headers = {'Authorization': f'Bearer {admin_token}'}
        
        print(f"\n3. Testing branch creation with Silver Plan (max_branches=1)")
        
        # Create first branch - should succeed
        branch1 = {
            'name': 'Branch 1',
            'address': 'Test Address 1',
            'phone': '1234567890'
        }
        r = requests.post(f'{BASE}/branches', json=branch1, headers=admin_headers, timeout=10)
        print(f"   Create Branch 1: {r.status_code}")
        if r.status_code == 201:
            print(f"   Success: {r.json()}")
        else:
            print(f"   Error: {r.text[:200]}")
        
        # Create second branch - should fail with BRANCH_LIMIT_REACHED
        branch2 = {
            'name': 'Branch 2',
            'address': 'Test Address 2',
            'phone': '1234567891'
        }
        r = requests.post(f'{BASE}/branches', json=branch2, headers=admin_headers, timeout=10)
        print(f"   Create Branch 2 (should fail): {r.status_code}")
        if r.status_code == 403:
            print(f"   Success! Branch limit enforced: {r.json()}")
        else:
            print(f"   Unexpected result: {r.text[:200]}")
        
        # Upgrade to Gold Plan (2 branches) and try again
        print(f"\n4. Upgrading tenant to Gold Plan (max_branches=2)")
        gold_plan = [p for p in plans if p['name'] == 'Gold Plan'][0]
        r = requests.put(f'{BASE}/super-admin/tenants/{tenant_id}', json={'plan_id': gold_plan['id']}, headers=headers, timeout=10)
        print(f"   Upgrade result: {r.status_code}")
        
        # Try creating second branch again - should now succeed
        r = requests.post(f'{BASE}/branches', json=branch2, headers=admin_headers, timeout=10)
        print(f"   Create Branch 2 after upgrade: {r.status_code}")
        if r.status_code == 201:
            print(f"   Success: {r.json()}")
        else:
            print(f"   Error: {r.text[:200]}")
        
        # Create third branch - should fail with BRANCH_LIMIT_REACHED
        branch3 = {
            'name': 'Branch 3',
            'address': 'Test Address 3',
            'phone': '1234567892'
        }
        r = requests.post(f'{BASE}/branches', json=branch3, headers=admin_headers, timeout=10)
        print(f"   Create Branch 3 (should fail): {r.status_code}")
        if r.status_code == 403:
            print(f"   Success! Branch limit enforced: {r.json()}")
        else:
            print(f"   Unexpected result: {r.text[:200]}")

print("\n" + "=" * 60)
print("BRANCH LIMIT ENFORCEMENT TEST COMPLETE")
print("=" * 60)
