"""
Test Invoice model directly to check attributes
"""
import sys
sys.path.append('C:/Users/mahal/OneDrive/Desktop/parlour/backend')

from app import create_app
from app.database import db
from app.models.billing import Invoice

app = create_app()

with app.app_context():
    # Get an invoice
    invoice = Invoice.query.first()
    if invoice:
        print(f"Invoice ID: {invoice.id}")
        print(f"Invoice status: {invoice.status}")
        print(f"Invoice total: {invoice.total}")
        print(f"Invoice has total_amount: {hasattr(invoice, 'total_amount')}")
        print(f"Invoice attributes: {[attr for attr in dir(invoice) if not attr.startswith('_')]}")
    else:
        print("No invoices found")
