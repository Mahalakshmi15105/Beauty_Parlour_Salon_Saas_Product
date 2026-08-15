"""
Fix duplicate tenant_settings entries
"""
import sys
sys.path.append('C:/Users/mahal/OneDrive/Desktop/parlour/backend')

from app import create_app
from app.database import db
from app.models.user import TenantSetting

app = create_app()

with app.app_context():
    # Find duplicate tenant_settings for tenant_id 13
    duplicates = TenantSetting.query.filter_by(tenant_id=13).all()
    print(f"Found {len(duplicates)} settings for tenant_id 13")
    
    if len(duplicates) > 1:
        # Keep the first one, delete the rest
        for i, dup in enumerate(duplicates):
            if i == 0:
                print(f"Keeping ID {dup.id} (branch_id={dup.branch_id})")
            else:
                print(f"Deleting duplicate ID {dup.id} (branch_id={dup.branch_id})")
                db.session.delete(dup)
        
        db.session.commit()
        print("Fixed duplicate settings")
    else:
        print("No duplicates found")
