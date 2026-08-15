"""
Check Flask app routes
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app import create_app

app = create_app()

print("All routes:")
for rule in app.url_map.iter_rules():
    if 'bulk' in str(rule):
        print(f"  {rule.rule} -> {rule.endpoint}")

print("\nBlueprints:")
for blueprint_name, blueprint in app.blueprints.items():
    print(f"  {blueprint_name}: {blueprint.name}")