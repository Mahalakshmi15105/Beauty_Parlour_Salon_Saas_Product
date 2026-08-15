"""
Reset Super Admin password
"""
import sys
sys.path.append('C:/Users/mahal/OneDrive/Desktop/parlour/backend')

from app import create_app
from app.database import db
from app.models.user import User

app = create_app()

with app.app_context():
    super_admin = User.query.filter_by(email='superadmin@smartgonext.com').first()
    if super_admin:
        super_admin.set_password('admin123')
        db.session.commit()
        print("Super Admin password reset successfully!")
        print("Email: superadmin@smartgonext.com")
        print("Password: admin123")
    else:
        print("Super Admin not found!")
