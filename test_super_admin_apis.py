"""
Test Super Admin APIs
"""
import requests
import json
import random
import time

BASE = 'http://localhost:5000/api/v1'

# Register a Super Admin user first
print("1. Creating Super Admin user...")
random_num = random.randint(10000, 99999)
super_admin_data = {
    'email': f'superadmin{random_num}@test.com',
    'password': 'admin123',
    'role': 'SuperAdmin'
}

# Try to create user directly (might need special endpoint)
# For now, let's try to get an existing Super Admin token by looking for one

print("Testing Super Admin APIs without auth first (should fail):")

endpoints = [
    ('GET', '/super-admin/dashboard'),
    ('GET', '/super-admin/tenants'),
    ('GET', '/super-admin/branches'),
    ('GET', '/super-admin/subscription-plans'),
    ('GET', '/super-admin/users'),
    ('GET', '/super-admin/analytics'),
    ('GET', '/super-admin/settings'),
]

for method, endpoint in endpoints:
    try:
        if method == 'GET':
            r = requests.get(f'{BASE}{endpoint}', timeout=5)
        print(f'{method} {endpoint}: {r.status_code}')
    except Exception as e:
        print(f'{method} {endpoint}: Error - {e}')

print("\nAll endpoints should return 401 without Super Admin auth.")
