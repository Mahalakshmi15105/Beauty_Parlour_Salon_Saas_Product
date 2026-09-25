from flask import Blueprint, request, g
from app.database import db
from app.models.billing import Invoice, InvoiceLineItem, InvoicePayment
from app.models.catalog import Service, Product
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.membership import CustomerMembership
from app.models.attendance import Attendance
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)
dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/dashboard/summary", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Employee"])
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
    if g.branch_id:
        base_inv_query = base_inv_query.filter(Invoice.branch_id == g.branch_id)

    total_revenue = base_inv_query.scalar()
    today_revenue = base_inv_query.filter(Invoice.created_at >= today_start).scalar()
    weekly_revenue = base_inv_query.filter(Invoice.created_at >= week_start).scalar()
    monthly_revenue = base_inv_query.filter(Invoice.created_at >= month_start).scalar()

    # 2. Invoice Counts
    base_count_query = db.session.query(func.count(Invoice.id)).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    )
    if g.branch_id:
        base_count_query = base_count_query.filter(Invoice.branch_id == g.branch_id)
    today_bills = base_count_query.filter(Invoice.created_at >= today_start).scalar()
    month_bills = base_count_query.filter(Invoice.created_at >= month_first_day).scalar()

    # 3. Customer Metrics
    total_customers = get_tenant_query(Customer).count()
    new_customers = get_tenant_query(Customer).filter(Customer.created_at >= month_first_day).count()

    # 4. Membership Metrics
    base_mem_query = db.session.query(func.count(CustomerMembership.id)).filter(
        CustomerMembership.tenant_id == g.parlour_id,
        CustomerMembership.status == "active",
        CustomerMembership.expires_at >= now
    )
    if g.branch_id:
        base_mem_query = base_mem_query.filter(CustomerMembership.branch_id == g.branch_id)
    active_memberships = base_mem_query.scalar()

    base_exp_query = db.session.query(func.count(CustomerMembership.id)).filter(
        CustomerMembership.tenant_id == g.parlour_id,
        CustomerMembership.status == "active",
        CustomerMembership.expires_at >= now,
        CustomerMembership.expires_at <= now + timedelta(days=7)
    )
    if g.branch_id:
        base_exp_query = base_exp_query.filter(CustomerMembership.branch_id == g.branch_id)
    expiring_soon = base_exp_query.scalar()

    # 5. Low Stock Products Alert List
    low_stock_query = get_tenant_query(Product).filter(
        Product.stock_quantity <= Product.low_stock_threshold,
        Product.status == "active"
    )
    if g.branch_id:
        low_stock_query = low_stock_query.filter(Product.branch_id == g.branch_id)
    low_stock_items = low_stock_query.all()

    low_stock_data = [
        {
            "id": p.id,
            "name": p.name,
            "stock_quantity": p.stock_quantity,
            "low_stock_threshold": p.low_stock_threshold
        } for p in low_stock_items
    ]

    # 6. Today's Attendance Metrics (Branch Scoped)
    att_query = db.session.query(Attendance).filter(
        Attendance.timestamp >= today_start
    )
    if g.branch_id:
        att_query = att_query.filter(Attendance.branch_id == g.branch_id)
    today_atts = att_query.all()
    total_checked_in = len([a for a in today_atts if a.status in ["P", "HP", "Present", "HalfDay"]])
    present_cnt = len([a for a in today_atts if a.status in ["P", "Present"]])
    half_cnt = len([a for a in today_atts if a.status in ["HP", "HalfDay"]])
    off_cnt = len([a for a in today_atts if a.status in ["OFF", "DayOff", "L", "Leave"]])

    # 7. Top 3 Target Performers (Current Month)
    employees = get_tenant_query(Employee).filter(Employee.status == "active").all()
    top_performers = []

    for emp in employees:
        target_val = float(getattr(emp, "target", 0.0) or 0.0)
        achieved_val = 0.0

        try:
            filter_conds = [
                Invoice.tenant_id == g.parlour_id,
                Invoice.status != "Voided",
                Invoice.created_at >= month_first_day,
                InvoiceLineItem.employee_id == emp.id
            ]

            emp_items = db.session.query(func.coalesce(func.sum(InvoiceLineItem.line_total), Decimal("0.00"))).join(
                Invoice, Invoice.id == InvoiceLineItem.invoice_id
            ).filter(*filter_conds)

            if g.branch_id:
                emp_items = emp_items.filter(Invoice.branch_id == g.branch_id)
            
            achieved_val = float(emp_items.scalar() or 0.0)
        except Exception as e:
            logger.error(f"Error calculating target performance for employee {emp.id}: {e}")
            achieved_val = 0.0

        percentage = (achieved_val / target_val * 100) if target_val > 0 else 0.0

        top_performers.append({
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
            "role": emp.role or "Staff",
            "target": target_val,
            "achieved": achieved_val,
            "percentage": round(percentage, 1)
        })

    # Sort by percentage & achieved revenue desc, pick top 3
    top_performers.sort(key=lambda x: (x["percentage"], x["achieved"]), reverse=True)
    top_3_performers = top_performers[:3]

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
        "attendance": {
            "total_checked_in": total_checked_in,
            "present": present_cnt,
            "half_day": half_cnt,
            "off": off_cnt
        },
        "low_stock_alerts": low_stock_data,
        "top_performers": top_3_performers
    })


@dashboard_bp.route("/dashboard/charts", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Employee"])
def get_charts():
    range_days = request.args.get("range", 7)
    try:
        range_days = int(range_days)
    except ValueError:
        range_days = 7

    now = datetime.now(timezone.utc)
    start_date = now - timedelta(days=range_days)

    # 1. Daily Revenue Trend
    daily_trend_q = db.session.query(
        cast(Invoice.created_at, Date).label("date"),
        func.sum(Invoice.total).label("revenue")
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided",
        Invoice.created_at >= start_date
    )
    if g.branch_id:
        daily_trend_q = daily_trend_q.filter(Invoice.branch_id == g.branch_id)
    daily_trend_query = daily_trend_q.group_by(cast(Invoice.created_at, Date)).order_by(cast(Invoice.created_at, Date).asc()).all()

    daily_trend = [
        {
            "date": row.date.strftime("%Y-%m-%d") if row.date else "",
            "revenue": float(row.revenue or 0.0)
        } for row in daily_trend_query
    ]

    # 2. Top Services
    top_services_q = db.session.query(
        Service.name.label("name"),
        func.sum(InvoiceLineItem.line_total).label("total_revenue")
    ).join(InvoiceLineItem, Service.id == InvoiceLineItem.service_id).join(
        Invoice, InvoiceLineItem.invoice_id == Invoice.id
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    )
    if g.branch_id:
        top_services_q = top_services_q.filter(Invoice.branch_id == g.branch_id)
    top_services_query = top_services_q.group_by(Service.id, Service.name).order_by(func.sum(InvoiceLineItem.line_total).desc()).limit(5).all()

    top_services = [
        {
            "name": row.name,
            "revenue": float(row.total_revenue or 0.0)
        } for row in top_services_query
    ]

    # 3. Employee Performance
    employee_perf_q = db.session.query(
        Employee.first_name.label("first_name"),
        func.sum(InvoiceLineItem.line_total).label("revenue")
    ).join(InvoiceLineItem, Employee.id == InvoiceLineItem.employee_id).join(
        Invoice, InvoiceLineItem.invoice_id == Invoice.id
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    )
    if g.branch_id:
        employee_perf_q = employee_perf_q.filter(Invoice.branch_id == g.branch_id)
    employee_perf_query = employee_perf_q.group_by(Employee.id, Employee.first_name).order_by(func.sum(InvoiceLineItem.line_total).desc()).limit(5).all()

    employee_perf = [
        {
            "name": row.first_name,
            "revenue": float(row.revenue or 0.0)
        } for row in employee_perf_query
    ]

    # 4. Payment Method Distribution
    payment_dist_q = db.session.query(
        InvoicePayment.method.label("method"),
        func.sum(InvoicePayment.amount).label("amount")
    ).join(Invoice, InvoicePayment.invoice_id == Invoice.id).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided"
    )
    if g.branch_id:
        payment_dist_q = payment_dist_q.filter(Invoice.branch_id == g.branch_id)
    payment_dist_query = payment_dist_q.group_by(InvoicePayment.method).all()

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
@require_role(["ParlourAdmin", "BranchAdmin", "Employee"])
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
