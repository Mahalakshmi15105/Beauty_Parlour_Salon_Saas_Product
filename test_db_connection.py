"""
Test database connection latency
"""
import pymysql
import time

# Parse DATABASE_URL from .env
import os
from dotenv import load_dotenv

BASE_DIR = "C:/Users/mahal/OneDrive/Desktop/parlour/backend"
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")
print(f"DATABASE_URL: {DATABASE_URL}")

# Parse connection string
# Format: mysql+pymysql://user:password@host:port/database
if DATABASE_URL.startswith("mysql+pymysql://"):
    conn_str = DATABASE_URL.replace("mysql+pymysql://", "")
    credentials, rest = conn_str.split("@")
    host_port, database = rest.split("/")
    user, password = credentials.split(":")
    if ":" in host_port:
        host, port = host_port.split(":")
        port = int(port)
    else:
        host = host_port
        port = 3306

print(f"Connecting to {host}:{port}/{database} as {user}")

# Test 1: Single connection creation
print("\nTest 1: Single connection creation")
start = time.time()
conn = pymysql.connect(host=host, user=user, password=password, database=database, port=port)
elapsed = (time.time() - start) * 1000
print(f"Connection time: {elapsed:.0f}ms")
conn.close()

# Test 2: Multiple sequential connections
print("\nTest 2: 10 sequential connections")
times = []
for i in range(10):
    start = time.time()
    conn = pymysql.connect(host=host, user=user, password=password, database=database, port=port)
    elapsed = (time.time() - start) * 1000
    times.append(elapsed)
    conn.close()
    print(f"  Connection {i+1}: {elapsed:.0f}ms")

print(f"Average: {sum(times)/len(times):.0f}ms")
print(f"Min: {min(times):.0f}ms")
print(f"Max: {max(times):.0f}ms")

# Test 3: Simple query execution
print("\nTest 3: Simple query execution (reusing connection)")
conn = pymysql.connect(host=host, user=user, password=password, database=database, port=port)
cursor = conn.cursor()

times = []
for i in range(10):
    start = time.time()
    cursor.execute("SELECT 1")
    cursor.fetchall()
    elapsed = (time.time() - start) * 1000
    times.append(elapsed)
    print(f"  Query {i+1}: {elapsed:.0f}ms")

print(f"Average query time: {sum(times)/len(times):.0f}ms")

cursor.close()
conn.close()