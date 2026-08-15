"""
Test DB query timing through SQLAlchemy
"""
import time
from app import create_app
from app.database import db
from sqlalchemy import text

app = create_app()

with app.app_context():
    print("Testing SQLAlchemy query timing:")
    
    # Warm up
    db.session.execute(text("SELECT 1"))
    db.session.commit()
    
    times = []
    for i in range(10):
        start = time.time()
        db.session.execute(text("SELECT 1"))
        db.session.commit()
        elapsed = (time.time() - start) * 1000
        times.append(elapsed)
        print(f"  Query {i+1}: {elapsed:.0f}ms")
    
    print(f"Average: {sum(times)/len(times):.0f}ms")
