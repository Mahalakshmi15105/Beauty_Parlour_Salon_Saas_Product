from flask import Blueprint, request, g
from app.database import db
from app.models.billing import Invoice, InvoiceLineItem, InvoicePayment
from app.models.catalog import Service, Product
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.membership import CustomerMembership
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)
dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/dashboard/summary", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_summary():
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    month_first_day = datetime(now.year, now.month, 1, tzinfo=timezone.utc)

    # 1. Total & Period Revenue Calculations (Excluding Voided Invoices)
    base_inv_query = db.session.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00"))).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    )

    total_revenue = base_inv_query.scalar()
    today_revenue = base_inv_query.filter(Invoice.created_at >= today_start).scalar()
    weekly_revenue = base_inv_query.filter(Invoice.created_at >= week_start).scalar()
    monthly_revenue = base_inv_query.filter(Invoice.created_at >= month_start).scalar()

    # 2. Invoice Counts
    base_count_query = db.session.query(func.count(Invoice.id)).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    )
    today_bills = base_count_query.filter(Invoice.created_at >= today_start).scalar()
    month_bills = base_count_query.filter(Invoice.created_at >= month_first_day).scalar()

    # 3. Customer Metrics
    total_customers = get_tenant_query(Customer).count()
    new_customers = get_tenant_query(Customer).filter(Customer.created_at >= month_first_day).count()

    # 4. Membership Metrics
    active_memberships = db.session.query(func.count(CustomerMembership.id)).filter(
        CustomerMembership.tenant_id == g.parlour_id,
        CustomerMembership.status == "active",
        CustomerMembership.expires_at >= now
    ).scalar()

    expiring_soon = db.session.query(func.count(CustomerMembership.id)).filter(
        CustomerMembership.tenant_id == g.parlour_id,
        CustomerMembership.status == "active",
        CustomerMembership.expires_at >= now,
        CustomerMembership.expires_at <= now + timedelta(days=7)
    ).scalar()

    # 5. Low Stock Products Alert List
    low_stock_items = get_tenant_query(Product).filter(
        Product.stock_quantity <= Product.low_stock_threshold,
        Product.status == "active"
    ).all()

    low_stock_data = [
        {
            "id": p.id,
            "name": p.name,
            "stock_quantity": p.stock_quantity,
            "low_stock_threshold": p.low_stock_threshold
        } for p in low_stock_items
    ]

    return success_response({
        "revenue": {
            "today": float(today_revenue),
            "weekly": float(weekly_revenue),
            "monthly": float(monthly_revenue),
            "total": float(total_revenue)
        },
        "invoices": {
            "today": today_bills,
            "this_month": month_bills
        },
        "customers": {
            "total": total_customers,
            "new_this_month": new_customers
        },
        "memberships": {
            "active": active_memberships,
            "expiring_soon": expiring_soon
        },
        "low_stock_alerts": low_stock_data
    })


@dashboard_bp.route("/dashboard/charts", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_charts():
    range_days = request.args.get("range", 7)
    try:
        range_days = int(range_days)
    except ValueError:
        range_days = 7

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=range_days)

    # 1. Daily Revenue Trend
    daily_trend_query = db.session.query(
        cast(Invoice.created_at, Date).label("date"),
        func.sum(Invoice.total).label("revenue")
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided",
        Invoice.created_at >= start_date
    ).group_by(cast(Invoice.created_at, Date)).order_by(cast(Invoice.created_at, Date).asc()).all()

    daily_trend = [
        {
            "date": row.date.strftime("%Y-%m-%d") if row.date else "",
            "revenue": float(row.revenue or 0.0)
        } for row in daily_trend_query
    ]

    # 2. Top Services
    top_services_query = db.session.query(
        Service.name.label("name"),
        func.sum(InvoiceLineItem.line_total).label("total_revenue")
    ).join(InvoiceLineItem, Service.id == InvoiceLineItem.service_id).join(
        Invoice, InvoiceLineItem.invoice_id == Invoice.id
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    ).group_by(Service.id, Service.name).order_by(func.sum(InvoiceLineItem.line_total).desc()).limit(5).all()

    top_services = [
        {
            "name": row.name,
            "revenue": float(row.total_revenue or 0.0)
        } for row in top_services_query
    ]

    # 3. Employee Performance
    employee_perf_query = db.session.query(
        Employee.first_name.label("first_name"),
        func.sum(InvoiceLineItem.line_total).label("revenue")
    ).join(InvoiceLineItem, Employee.id == InvoiceLineItem.employee_id).join(
        Invoice, InvoiceLineItem.invoice_id == Invoice.id
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    ).group_by(Employee.id, Employee.first_name).order_by(func.sum(InvoiceLineItem.line_total).desc()).limit(5).all()

    employee_perf = [
        {
            "name": row.first_name,
            "revenue": float(row.revenue or 0.0)
        } for row in employee_perf_query
    ]

    # 4. Payment Method Distribution
    payment_dist_query = db.session.query(
        InvoicePayment.method.label("method"),
        func.sum(InvoicePayment.amount).label("amount")
    ).join(Invoice, InvoicePayment.invoice_id == Invoice.id).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    ).group_by(InvoicePayment.method).all()

    payment_dist = [
        {
            "method": row.method.capitalize(),
            "amount": float(row.amount or 0.0)
        } for row in payment_dist_query
    ]

    return success_response({
        "daily_trend": daily_trend,
        "top_services": top_services,
        "employee_performance": employee_perf,
        "payment_distribution": payment_dist
    })


@dashboard_bp.route("/dashboard/activities", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_activities():
    recent_invoices = get_tenant_query(Invoice).order_by(Invoice.created_at.desc()).limit(5).all()
    recent_customers = get_tenant_query(Customer).order_by(Customer.created_at.desc()).limit(5).all()

    invoice_data = [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": (f"{inv.customer.first_name} {inv.customer.last_name or ''}".strip()) if inv.customer else (getattr(inv, "customer_name", None) or "Walk-in Customer"),
            "total": float(inv.total or 0.0),
            "status": inv.status,
            "created_at": inv.created_at.isoformat() if inv.created_at else ""
        } for inv in recent_invoices
    ]

    customer_data = [
        {
            "id": c.id,
            "name": f"{c.first_name} {c.last_name or ''}".strip(),
            "phone": c.phone or "",
            "created_at": c.created_at.isoformat() if c.created_at else ""
        } for c in recent_customers
    ]

    return success_response({
        "recent_invoices": invoice_data,
        "recent_customers": customer_data
    })
