"""
Test Super Admin login with correct credentials
"""
import requests
import json

BASE = 'http://localhost:5000/api/v1'

print("Testing Super Admin login with correct credentials...")

# Try with the existing Super Admin
r = requests.post(f'{BASE}/auth/login', json={'email': 'superadmin@smartgonext.com', 'password': 'admin123'}, timeout=5)
print(f"Login status: {r.status_code}")
print(f"Response: {r.text[:500]}")

if r.status_code == 200:
    data = r.json()
    token = data.get('data', {}).get('token', data.get('token', ''))
    print(f"Token obtained: {str(token)[:50]}...")
    
    headers = {'Authorization': f'Bearer {token}'}
    
    print("\nTesting Super Admin APIs one by one:")
    apis = [
        '/super-admin/dashboard',
        '/super-admin/tenants',
        '/super-admin/branches',
        '/super-admin/subscription-plans',
        '/super-admin/users',
        '/super-admin/analytics',
        '/super-admin/settings',
        '/super-admin/system-health',
        '/super-admin/audit-logs',
    ]
    
    for api in apis:
        try:
            r = requests.get(f'{BASE}{api}', headers=headers, timeout=10)
            print(f"  {api}: {r.status_code}")
            if r.status_code != 200:
                print(f"    Error response: {r.text[:500]}")
        except Exception as e:
            print(f"  {api}: Error - {e}")
