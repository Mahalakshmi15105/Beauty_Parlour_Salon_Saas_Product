"""
Test Flask app directly to measure internal latency
"""
import requests
import time

BASE = 'http://localhost:5000/api/v1'

# Make multiple requests to the same endpoint to see if there's a warmup effect
print("Testing consecutive requests to same endpoint:")

for i in range(10):
    start = time.time()
    r = requests.get(f'{BASE}/health', timeout=10)
    elapsed = (time.time() - start) * 1000
    print(f"Request {i+1}: {elapsed:.0f}ms (Status: {r.status_code})")

print("\nTesting different endpoints consecutively:")

endpoints = [
    '/health',
    '/public/booking/1/config',
    '/public/booking/1/services',
]

for endpoint in endpoints:
    for i in range(3):
        start = time.time()
        r = requests.get(f'{BASE}{endpoint}', timeout=10)
        elapsed = (time.time() - start) * 1000
        print(f"{endpoint} (run {i+1}): {elapsed:.0f}ms")
