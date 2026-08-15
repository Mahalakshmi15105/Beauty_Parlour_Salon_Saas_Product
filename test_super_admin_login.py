"""
Test Super Admin login and APIs to identify the error
"""
import requests
import json

BASE = 'http://localhost:5000/api/v1'

print("Testing Super Admin APIs...")

# First, try to find or create a Super Admin user
# Check if we can access any endpoint to see if there's a Super Admin

# Test health endpoint
try:
    r = requests.get(f'{BASE}/health', timeout=5)
    print(f"Health check: {r.status_code}")
except Exception as e:
    print(f"Health check error: {e}")

# Try to register a Super Admin (if the endpoint exists)
print("\nAttempting to create Super Admin user...")
super_admin_data = {
    'email': 'superadmin@test.com',
    'password': 'admin123',
    'role': 'SuperAdmin'
}

# Try direct login with potential Super Admin credentials
test_credentials = [
    ('admin@smartgonext.com', 'admin123'),
    ('superadmin@test.com', 'admin123'),
]

for email, password in test_credentials:
    try:
        r = requests.post(f'{BASE}/auth/login', json={'email': email, 'password': password}, timeout=5)
        print(f"Login attempt {email}: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            token = data.get('data', {}).get('token', data.get('token', ''))
            if token:
                print(f"Login successful! Token: {str(token)[:50]}...")
                
                # Now test Super Admin APIs with this token
                headers = {'Authorization': f'Bearer {token}'}
                
                print("\nTesting Super Admin APIs:")
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
                            print(f"    Error: {r.text[:200]}")
                    except Exception as e:
                        print(f"  {api}: Error - {e}")
                
                break
    except Exception as e:
        print(f"Login error {email}: {e}")
