import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.database import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    from app.models.global_models import Tenant
    tenants = Tenant.query.all()
    for t in tenants:
        if not t.db_connection_uri:
            continue
        try:
            engine = db.get_tenant_engine(t.db_connection_uri)
            with engine.connect() as conn:
                res = conn.execute(text("SHOW COLUMNS FROM services LIKE 'image_url'"))
                col = res.fetchone()
                print(f"Tenant {t.id} ({t.name}): image_url column -> {col}")
        except Exception as e:
            print(f"Tenant {t.id} ({t.name}): ERROR -> {e}")
