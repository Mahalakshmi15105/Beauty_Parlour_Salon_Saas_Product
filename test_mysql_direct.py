"""
Test MySQL directly with pooling simulation
"""
import pymysql
from pymysql import pooling
import time
import os
from dotenv import load_dotenv

BASE_DIR = "C:/Users/mahal/OneDrive/Desktop/parlour/backend"
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

DATABASE_URL = os.getenv("DATABASE_URL")
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

print("Testing with connection pool:")

# Create a connection pool
pool = pooling.ConnectionPool(
    host=host,
    user=user,
    password=password,
    database=database,
    port=port,
    pool_name="mypool",
    pool_size=10,
    max_overflow=20,
    pool_reset_session=True
)

# Test with pool
times = []
for i in range(10):
    start = time.time()
    conn = pool.get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1")
    cursor.fetchall()
    conn.close()
    elapsed = (time.time() - start) * 1000
    times.append(elapsed)
    print(f"  Request {i+1}: {elapsed:.0f}ms")

print(f"Average with pool: {sum(times)/len(times):.0f}ms")
