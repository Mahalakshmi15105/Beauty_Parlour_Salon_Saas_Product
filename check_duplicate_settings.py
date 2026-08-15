"""
Check for duplicate tenant_settings
"""
import sys
sys.path.append('C:/Users/mahal/OneDrive/Desktop/parlour/backend')

from app import create_app
from app.database import db
from app.models.user import TenantSetting

app = create_app()

with app.app_context():
    # Check for duplicates
    all_settings = TenantSetting.query.all()
    print(f"Total settings: {len(all_settings)}")
    
    # Group by tenant_id
    from collections import defaultdict
    by_tenant = defaultdict(list)
    for setting in all_settings:
        by_tenant[setting.tenant_id].append(setting)
    
    for tenant_id, settings in by_tenant.items():
        if len(settings) > 1:
            print(f"\nTenant {tenant_id} has {len(settings)} settings:")
            for s in settings:
                print(f"  - ID {s.id}, branch_id={s.branch_id}")
