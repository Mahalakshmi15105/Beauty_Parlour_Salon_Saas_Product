"""
Check max_branches in database
"""
import sys
sys.path.append('C:/Users/mahal/OneDrive/Desktop/parlour/backend')

from app import create_app
from app.database import db
from app.models.global_models import SubscriptionPlan

app = create_app()

with app.app_context():
    plans = SubscriptionPlan.query.all()
    print("Plans in database:")
    for plan in plans:
        print(f"ID: {plan.id}, Name: {plan.name}, max_branches: {plan.max_branches}")
