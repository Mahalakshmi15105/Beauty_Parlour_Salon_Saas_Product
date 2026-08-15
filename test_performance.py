"""
Performance Investigation Script
Tests API response times to identify slow endpoints after login
"""

import requests
import json
import time
import random

BASE = 'http://localhost:5000/api/v1'

def test_endpoint(name, url, method='GET', payload=None, token=None):
    """Test a single endpoint and return timing"""
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    
    try:
        start = time.time()
        if method == 'GET':
            r = requests.get(f'{BASE}{url}', headers=headers, timeout=10)
        elif method == 'POST':
            r = requests.post(f'{BASE}{url}', headers=headers, json=payload, timeout=10)
        elapsed = (time.time() - start) * 1000
        return {
            'endpoint': name,
            'url': url,
            'status': r.status_code,
            'time_ms': elapsed,
            'success': r.status_code < 400
        }
    except Exception as e:
        return {
            'endpoint': name,
            'url': url,
            'status': 'ERROR',
            'time_ms': 0,
            'success': False,
            'error': str(e)
        }

def main():
    print('='*60)
    print('PERFORMANCE INVESTIGATION - POST-LOGIN API CALLS')
    print('='*60)
    
    # First, test unauthenticated endpoints (baseline)
    print('\n1. BASELINE - Unauthenticated Endpoints:')
    baseline_tests = [
        ('Health Check', '/health'),
        ('Public Booking Config', '/public/booking/1/config'),
        ('Public Booking Services', '/public/booking/1/services'),
    ]
    
    for name, url in baseline_tests:
        result = test_endpoint(name, url)
        status = 'PASS' if result['success'] else 'FAIL'
        print(f'{status} {name}: {result["time_ms"]:.0f}ms (Status: {result["status"]})')
    
    # Try to get a working token by testing registration
    print('\n2. AUTHENTICATION - Attempting to get token:')
    try:
        # Try to register a new user with unique email
        random_num = random.randint(10000, 99999)
        register_data = {
            'email': f'perftest{random_num}@test.com',
            'password': 'test123',
            'parlour_name': 'Performance Test Salon',
            'admin_name': 'Test Admin',
            'phone': f'9{random_num}'
        }
        
        start = time.time()
        r = requests.post(f'{BASE}/auth/register', json=register_data, timeout=10)
        elapsed = (time.time() - start) * 1000
        print(f'Registration: {r.status_code} ({elapsed:.0f}ms)')
        
        if r.status_code in [200, 201]:
            data = r.json()
            token = data.get('data', {}).get('token', data.get('token', ''))
            print(f'Token obtained successfully!')
        else:
            print(f'Registration failed: {r.json().get("message", "Unknown error")}')
            token = None
    except Exception as e:
        print(f'Registration error: {e}')
        token = None
    
    if not token:
        print('\nSkipping authenticated endpoint tests (no token available)')
        return
    
    # Test authenticated endpoints that load after login
    print('\n3. AUTHENTICATED ENDPOINTS - Simulating Post-Login Load:')
    
    auth_tests = [
        ('User Info', '/auth/me'),
        ('Settings', '/settings'),
        ('Dashboard Summary', '/dashboard/summary'),
        ('Dashboard Charts (7 days)', '/dashboard/charts?range=7'),
        ('Dashboard Activities', '/dashboard/activities'),
        ('Notifications', '/notifications?limit=10'),
        ('Customers List', '/customers?limit=10'),
        ('Employees List', '/employees?limit=10'),
        ('Services List', '/services?limit=10'),
        ('Appointments List', '/appointments?date=2026-08-13'),
    ]
    
    results = []
    for name, url in auth_tests:
        result = test_endpoint(name, url, token=token)
        results.append(result)
        status = 'PASS' if result['success'] else 'FAIL'
        print(f'{status} {name}: {result["time_ms"]:.0f}ms (Status: {result["status"]})')
    
    # Summary
    print('\n' + '='*60)
    print('PERFORMANCE SUMMARY')
    print('='*60)
    
    print('\nSLOWEST ENDPOINTS (>1000ms):')
    slow_endpoints = [r for r in results if r['time_ms'] > 1000]
    for r in sorted(slow_endpoints, key=lambda x: x['time_ms'], reverse=True):
        print(f'  {r["endpoint"]}: {r["time_ms"]:.0f}ms')
    
    if not slow_endpoints:
        print('  No slow endpoints found (all <1000ms)')
    
    print('\nFAILED ENDPOINTS:')
    failed_endpoints = [r for r in results if not r['success']]
    for r in failed_endpoints:
        print(f'  {r["endpoint"]}: {r.get("error", "Unknown error")}')
    
    if not failed_endpoints:
        print('  All endpoints successful')
    
    print('\nTOTAL TIME COMPARISON:')
    total_time = sum(r['time_ms'] for r in results)
    print(f'  Total authenticated API time: {total_time:.0f}ms')
    print(f'  Average per endpoint: {total_time/len(results):.0f}ms')

if __name__ == '__main__':
    main()