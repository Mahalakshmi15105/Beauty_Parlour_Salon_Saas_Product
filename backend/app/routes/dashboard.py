from flask import Blueprint, request, g
from app.database import db
from app.models.billing import Invoice, InvoiceLineItem, InvoicePayment
from app.models.catalog import Service, Product
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.membership import CustomerMembership
from app.models.attendance import Attendance
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query, get_branch_query
from app.services.cache import cache
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)
dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/dashboard/summary", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Employee"])
def get_summary():
    # 0. Check Redis cache first for lightning fast response
    cache_key = f"summary:{g.parlour_id}:{g.branch_id or 'all'}"
    try:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return success_response(cached_data)
    except Exception as c_err:
        logger.debug(f"Cache get error: {c_err}")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today_start = datetime(now.year, now.month, now.day)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)
    month_first_day = datetime(now.year, now.month, 1)

    try:
        # 1. Total & Period Revenue Calculations (Excluding Voided Invoices)
        base_inv_query = db.session.query(func.coalesce(func.sum(Invoice.total), Decimal("0.00"))).filter(
            Invoice.tenant_id == g.parlour_id,
            Invoice.status != "Voided"
        )
        if g.branch_id:
            base_inv_query = base_inv_query.filter(Invoice.branch_id == g.branch_id)

        total_revenue = base_inv_query.scalar() or Decimal("0.00")
        today_revenue = base_inv_query.filter(Invoice.created_at >= today_start).scalar() or Decimal("0.00")
        weekly_revenue = base_inv_query.filter(Invoice.created_at >= week_start).scalar() or Decimal("0.00")
        monthly_revenue = base_inv_query.filter(Invoice.created_at >= month_start).scalar() or Decimal("0.00")

        # 2. Invoice Counts
        base_count_query = db.session.query(func.count(Invoice.id)).filter(
            Invoice.tenant_id == g.parlour_id,
            Invoice.status != "Voided"
        )
        if g.branch_id:
            base_count_query = base_count_query.filter(Invoice.branch_id == g.branch_id)
        today_bills = base_count_query.filter(Invoice.created_at >= today_start).scalar() or 0
        month_bills = base_count_query.filter(Invoice.created_at >= month_first_day).scalar() or 0

        # 3. Customer Metrics
        cust_query = get_branch_query(Customer)
        total_customers = cust_query.count() or 0
        new_customers = cust_query.filter(Customer.created_at >= month_first_day).count() or 0

        # 4. Membership Metrics
        base_mem_query = db.session.query(func.count(CustomerMembership.id)).filter(
            CustomerMembership.tenant_id == g.parlour_id,
            CustomerMembership.status == "active",
            CustomerMembership.expires_at >= now
        )
        if g.branch_id:
            base_mem_query = base_mem_query.filter(CustomerMembership.branch_id == g.branch_id)
        active_memberships = base_mem_query.scalar() or 0

        base_exp_query = db.session.query(func.count(CustomerMembership.id)).filter(
            CustomerMembership.tenant_id == g.parlour_id,
            CustomerMembership.status == "active",
            CustomerMembership.expires_at >= now,
            CustomerMembership.expires_at <= now + timedelta(days=7)
        )
        if g.branch_id:
            base_exp_query = base_exp_query.filter(CustomerMembership.branch_id == g.branch_id)
        expiring_soon = base_exp_query.scalar() or 0

        # 5. Low Stock Products Alert List
        low_stock_data = []
        try:
            low_stock_query = get_branch_query(Product).filter(
                Product.stock_quantity <= Product.low_stock_threshold,
                Product.status == "active"
            )
            low_stock_items = low_stock_query.all() or []
            low_stock_data = [
                {
                    "id": p.id,
                    "name": p.name or "Product",
                    "stock_quantity": p.stock_quantity or 0,
                    "low_stock_threshold": p.low_stock_threshold or 0
                } for p in low_stock_items
            ]
        except Exception as l_err:
            logger.debug(f"Low stock calculation notice: {l_err}")

        # 6. Today's Attendance Metrics (Branch Scoped)
        total_checked_in = 0
        present_cnt = 0
        half_cnt = 0
        off_cnt = 0
        try:
            att_query = db.session.query(Attendance).filter(
                Attendance.timestamp >= today_start
            )
            if g.branch_id:
                att_query = att_query.filter(Attendance.branch_id == g.branch_id)
            today_atts = att_query.all() or []
            total_checked_in = len([a for a in today_atts if a.status in ["P", "HP", "Present", "HalfDay"]])
            present_cnt = len([a for a in today_atts if a.status in ["P", "Present"]])
            half_cnt = len([a for a in today_atts if a.status in ["HP", "HalfDay"]])
            off_cnt = len([a for a in today_atts if a.status in ["OFF", "DayOff", "L", "Leave"]])
        except Exception as att_err:
            logger.debug(f"Attendance calculation notice: {att_err}")

        # 7. Top 3 Target Performers (Current Month)
        top_3_performers = []
        try:
            emp_query = get_branch_query(Employee).filter(Employee.status == "active")
            employees = emp_query.all() or []
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

            top_performers.sort(key=lambda x: (x["percentage"], x["achieved"]), reverse=True)
            top_3_performers = top_performers[:3]
        except Exception as perf_err:
            logger.debug(f"Performer calculation notice: {perf_err}")

        summary_payload = {
            "revenue": {
                "today": float(today_revenue or 0.0),
                "weekly": float(weekly_revenue or 0.0),
                "monthly": float(monthly_revenue or 0.0),
                "total": float(total_revenue or 0.0)
            },
            "invoices": {
                "today": int(today_bills or 0),
                "this_month": int(month_bills or 0)
            },
            "customers": {
                "total": int(total_customers or 0),
                "new_this_month": int(new_customers or 0)
            },
            "memberships": {
                "active": int(active_memberships or 0),
                "expiring_soon": int(expiring_soon or 0)
            },
            "attendance": {
                "total_checked_in": int(total_checked_in),
                "present": int(present_cnt),
                "half_day": int(half_cnt),
                "off": int(off_cnt)
            },
            "low_stock_alerts": low_stock_data,
            "top_performers": top_3_performers
        }

        # Store in Redis for 30 seconds
        try:
            cache.set(cache_key, summary_payload, timeout=30)
        except Exception:
            pass

        return success_response(summary_payload)

    except Exception as summary_err:
        logger.warning(f"Dashboard summary calculation fallback (tenant {g.parlour_id}): {summary_err}")
        return success_response({
            "revenue": {"today": 0.0, "weekly": 0.0, "monthly": 0.0, "total": 0.0},
            "invoices": {"today": 0, "this_month": 0},
            "customers": {"total": 0, "new_this_month": 0},
            "memberships": {"active": 0, "expiring_soon": 0},
            "attendance": {"total_checked_in": 0, "present": 0, "half_day": 0, "off": 0},
            "low_stock_alerts": [],
            "top_performers": []
        })


@dashboard_bp.route("/dashboard/charts", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Employee"])
def get_charts():
    range_days = request.args.get("range", 7)
    try:
        range_days = int(range_days)
    except (ValueError, TypeError):
        range_days = 7

    # 0. Check Redis cache first
    cache_key = f"charts:{g.parlour_id}:{g.branch_id or 'all'}:{range_days}"
    try:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return success_response(cached_data)
    except Exception as c_err:
        logger.debug(f"Cache get error: {c_err}")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    start_date = now - timedelta(days=range_days)

    try:
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
        daily_trend_query = daily_trend_q.group_by(cast(Invoice.created_at, Date)).order_by(cast(Invoice.created_at, Date).asc()).all() or []

        revenue_by_date = {
            row.date.strftime("%Y-%m-%d") if row.date else "": float(row.revenue or 0.0)
            for row in daily_trend_query if row.date
        }

        # Build full date range with zero fill so charts always have smooth trends
        daily_trend = []
        for i in range(range_days, -1, -1):
            d_str = (now - timedelta(days=i)).strftime("%Y-%m-%d")
            daily_trend.append({
                "date": d_str,
                "revenue": revenue_by_date.get(d_str, 0.0)
            })

        # 2. Top Services
        top_services = []
        try:
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
            top_services_query = top_services_q.group_by(Service.id, Service.name).order_by(func.sum(InvoiceLineItem.line_total).desc()).limit(5).all() or []

            top_services = [
                {
                    "name": row.name or "Service",
                    "revenue": float(row.total_revenue or 0.0)
                } for row in top_services_query
            ]
        except Exception as s_err:
            logger.debug(f"Top services calculation notice: {s_err}")

        # 3. Employee Performance
        employee_perf = []
        try:
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
            employee_perf_query = employee_perf_q.group_by(Employee.id, Employee.first_name).order_by(func.sum(InvoiceLineItem.line_total).desc()).limit(5).all() or []

            employee_perf = [
                {
                    "name": row.first_name or "Staff",
                    "revenue": float(row.revenue or 0.0)
                } for row in employee_perf_query
            ]
        except Exception as ep_err:
            logger.debug(f"Employee perf calculation notice: {ep_err}")

        # 4. Payment Method Distribution
        payment_dist = []
        try:
            payment_dist_q = db.session.query(
                InvoicePayment.method.label("method"),
                func.sum(InvoicePayment.amount).label("amount")
            ).join(Invoice, InvoicePayment.invoice_id == Invoice.id).filter(
                Invoice.tenant_id == g.parlour_id,
                Invoice.status != "Voided"
            )
            if g.branch_id:
                payment_dist_q = payment_dist_q.filter(Invoice.branch_id == g.branch_id)
            payment_dist_query = payment_dist_q.group_by(InvoicePayment.method).all() or []

            payment_dist = [
                {
                    "method": (row.method or "Cash").capitalize(),
                    "amount": float(row.amount or 0.0)
                } for row in payment_dist_query
            ]
        except Exception as p_err:
            logger.debug(f"Payment dist calculation notice: {p_err}")

        charts_payload = {
            "daily_trend": daily_trend,
            "top_services": top_services,
            "employee_performance": employee_perf,
            "payment_distribution": payment_dist
        }

        # Store in Redis for 60 seconds
        try:
            cache.set(cache_key, charts_payload, timeout=60)
        except Exception:
            pass

        return success_response(charts_payload)

    except Exception as charts_err:
        logger.warning(f"Charts calculation fallback (tenant {g.parlour_id}): {charts_err}")
        return success_response({
            "daily_trend": [{"date": (now - timedelta(days=i)).strftime("%Y-%m-%d"), "revenue": 0.0} for i in range(range_days, -1, -1)],
            "top_services": [],
            "employee_performance": [],
            "payment_distribution": []
        })


@dashboard_bp.route("/dashboard/activities", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Employee"])
def get_activities():
    # 0. Check Redis cache first
    cache_key = f"activities:{g.parlour_id}:{g.branch_id or 'all'}"
    try:
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return success_response(cached_data)
    except Exception as c_err:
        logger.debug(f"Cache get error: {c_err}")

    try:
        recent_invoices = get_branch_query(Invoice).order_by(Invoice.created_at.desc()).limit(5).all() or []
        recent_customers = get_branch_query(Customer).order_by(Customer.created_at.desc()).limit(5).all() or []

        invoice_data = [
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number,
                "customer_name": (f"{inv.customer.first_name} {inv.customer.last_name or ''}".strip()) if inv.customer else (getattr(inv, "customer_name", None) or "Walk-in Customer"),
                "total": float(inv.total or 0.0),
                "status": inv.status or "Completed",
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

        activities_payload = {
            "recent_invoices": invoice_data,
            "recent_customers": customer_data
        }

        # Store in Redis for 15 seconds
        try:
            cache.set(cache_key, activities_payload, timeout=15)
        except Exception:
            pass

        return success_response(activities_payload)

    except Exception as act_err:
        logger.warning(f"Activities fallback (tenant {g.parlour_id}): {act_err}")
        return success_response({
            "recent_invoices": [],
            "recent_customers": []
        })
