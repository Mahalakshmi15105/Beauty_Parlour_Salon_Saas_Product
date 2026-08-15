"""
Test minimal Flask endpoint without database
"""
import requests
import time

BASE = 'http://localhost:5000/api/v1'

print("Testing simple endpoint without database:")

# Create a simple test endpoint in health.py that doesn't use DB
# For now, just test if the delay is in the DB or in Flask routing

for i in range(5):
    start = time.time()
    r = requests.get(f'{BASE}/health', timeout=10)
    elapsed = (time.time() - start) * 1000
    print(f"Request {i+1}: {elapsed:.0f}ms (Status: {r.status_code})")
