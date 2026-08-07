from app.database import db
from app.models.user import User
from app import create_app

app = create_app()
with app.app_context():
    users = User.query.all()
    print(f'Total users: {len(users)}')
    for u in users:
        print(f'User: {u.email}, Role: {u.role}, Tenant ID: {u.tenant_id}')