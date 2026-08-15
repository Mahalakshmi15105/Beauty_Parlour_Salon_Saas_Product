from flask import Blueprint, request, g, Response
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
import io
import csv
import logging

logger = logging.getLogger(__name__)
reports_bp = Blueprint("reports", __name__)

def parse_date_range(preset, start_str=None, end_str=None):
    now = datetime.now(timezone.utc)
    if preset == "today":
        start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        end = now
    elif preset == "yesterday":
        yest = now - timedelta(days=1)
        start = datetime(yest.year, yest.month, yest.day, tzinfo=timezone.utc)
        end = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    elif preset == "7days":
        start = now - timedelta(days=7)
        end = now
    elif preset == "30days":
        start = now - timedelta(days=30)
        end = now
    elif preset == "this_month":
        start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        end = now
    elif preset == "last_month":
        first_this = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        last_prev = first_this - timedelta(days=1)
        start = datetime(last_prev.year, last_prev.month, 1, tzinfo=timezone.utc)
        end = first_this
    elif preset == "custom" and start_str and end_str:
        try:
            start = datetime.strptime(start_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            end = datetime.strptime(end_str, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(days=1)
        except ValueError:
            start = now - timedelta(days=30)
            end = now
    else:
        start = now - timedelta(days=30)
        end = now
    return start, end


@reports_bp.route("/reports/sales", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_sales_report():
    preset = request.args.get("preset", "30days")
    start_date, end_date = parse_date_range(preset, request.args.get("start_date"), request.args.get("end_date"))
    status_filter = request.args.get("status")
    employee_id = request.args.get("employee_id")

    query = get_tenant_query(Invoice).filter(
        Invoice.created_at >= start_date,
        Invoice.created_at <= end_date
    )

    if status_filter:
        query = query.filter(Invoice.status == status_filter)

    invoices = query.order_by(Invoice.created_at.desc()).all()

    items = []
    total_sales = Decimal("0.00")
    total_tax = Decimal("0.00")
    total_discount = Decimal("0.00")

    for inv in invoices:
        if inv.status != "Voided":
            total_sales += inv.total
            total_tax += inv.tax
            total_discount += inv.discount

        items.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "date": inv.created_at.strftime("%Y-%m-%d %H:%M"),
            "customer_name": f"{inv.customer.first_name} {inv.customer.last_name or ''}".strip(),
            "subtotal": float(inv.subtotal),
            "discount": float(inv.discount),
            "tax": float(inv.tax),
            "total": float(inv.total),
            "status": inv.status
        })

    return success_response({
        "summary": {
            "total_sales": float(total_sales),
            "total_tax": float(total_tax),
            "total_discount": float(total_discount),
            "total_orders": len(invoices)
        },
        "items": items
    })


@reports_bp.route("/reports/tax", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_tax_report():
    preset = request.args.get("preset", "30days")
    start_date, end_date = parse_date_range(preset, request.args.get("start_date"), request.args.get("end_date"))

    tax_query = db.session.query(
        cast(Invoice.created_at, Date).label("date"),
        func.sum(Invoice.subtotal).label("gross_subtotal"),
        func.sum(Invoice.discount).label("discount"),
        func.sum(Invoice.tax).label("tax_collected"),
        func.sum(Invoice.total).label("net_total")
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided",
        Invoice.created_at >= start_date,
        Invoice.created_at <= end_date
    ).group_by(cast(Invoice.created_at, Date)).order_by(cast(Invoice.created_at, Date).desc()).all()

    items = []
    total_tax_collected = Decimal("0.00")

    for row in tax_query:
        tax_val = row.tax_collected or Decimal("0.00")
        total_tax_collected += tax_val
        items.append({
            "date": row.date.strftime("%Y-%m-%d") if row.date else "",
            "gross_subtotal": float(row.gross_subtotal or 0.0),
            "discount": float(row.discount or 0.0),
            "tax_collected": float(tax_val),
            "net_total": float(row.net_total or 0.0)
        })

    return success_response({
        "total_tax_collected": float(total_tax_collected),
        "daily_tax_logs": items
    })


@reports_bp.route("/reports/employees", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_employee_report():
    preset = request.args.get("preset", "30days")
    start_date, end_date = parse_date_range(preset, request.args.get("start_date"), request.args.get("end_date"))

    query = db.session.query(
        Employee.id,
        Employee.first_name,
        Employee.last_name,
        Employee.commission_percentage,
        func.count(InvoiceLineItem.id).label("services_rendered"),
        func.sum(InvoiceLineItem.line_total).label("total_revenue")
    ).join(InvoiceLineItem, Employee.id == InvoiceLineItem.employee_id).join(
        Invoice, InvoiceLineItem.invoice_id == Invoice.id
    ).filter(
        Invoice.tenant_id == g.parlour_id,
        Invoice.status != "Voided",
        Invoice.created_at >= start_date,
        Invoice.created_at <= end_date
    ).group_by(Employee.id, Employee.first_name, Employee.last_name, Employee.commission_percentage).all()

    items = []
    for row in query:
        rev = Decimal(str(row.total_revenue or 0.0))
        comm_pct = Decimal(str(row.commission_percentage or 0.0))
        comm_earned = rev * (comm_pct / Decimal("100.00"))

        items.append({
            "employee_id": row.id,
            "name": f"{row.first_name} {row.last_name or ''}".strip(),
            "commission_percentage": float(comm_pct),
            "services_rendered": row.services_rendered,
            "total_revenue": float(rev),
            "estimated_commission": float(comm_earned)
        })

    return success_response(items)


@reports_bp.route("/reports/products", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_product_report():
    query = db.session.query(
        Product.id,
        Product.name,
        Product.sku,
        Product.stock_quantity,
        Product.selling_price,
        func.coalesce(func.sum(InvoiceLineItem.quantity), 0).label("units_sold"),
        func.coalesce(func.sum(InvoiceLineItem.line_total), Decimal("0.00")).label("total_sales")
    ).outerjoin(InvoiceLineItem, Product.id == InvoiceLineItem.product_id).filter(
        Product.tenant_id == g.parlour_id,
        Product.status == "active"
    ).group_by(Product.id, Product.name, Product.sku, Product.stock_quantity, Product.selling_price).all()

    items = []
    for row in query:
        items.append({
            "id": row.id,
            "name": row.name,
            "sku": row.sku,
            "stock_quantity": row.stock_quantity,
            "selling_price": float(row.selling_price),
            "units_sold": int(row.units_sold),
            "total_sales": float(row.total_sales)
        })

    return success_response(items)


@reports_bp.route("/reports/export", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def export_csv_report():
    report_type = request.args.get("type", "sales")
    preset = request.args.get("preset", "30days")
    start_date, end_date = parse_date_range(preset, request.args.get("start_date"), request.args.get("end_date"))

    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == "sales":
        writer.writerow(["Invoice Number", "Date", "Customer Name", "Subtotal (INR)", "Discount (INR)", "Tax (INR)", "Total (INR)", "Status"])
        invoices = get_tenant_query(Invoice).filter(
            Invoice.created_at >= start_date,
            Invoice.created_at <= end_date
        ).order_by(Invoice.created_at.desc()).all()

        for inv in invoices:
            writer.writerow([
                inv.invoice_number,
                inv.created_at.strftime("%Y-%m-%d %H:%M"),
                f"{inv.customer.first_name} {inv.customer.last_name or ''}".strip(),
                float(inv.subtotal),
                float(inv.discount),
                float(inv.tax),
                float(inv.total),
                inv.status
            ])

    elif report_type == "tax":
        writer.writerow(["Date", "Gross Subtotal (INR)", "Discounts (INR)", "Tax Collected (INR)", "Net Total (INR)"])
        tax_rows = db.session.query(
            cast(Invoice.created_at, Date).label("date"),
            func.sum(Invoice.subtotal).label("gross_subtotal"),
            func.sum(Invoice.discount).label("discount"),
            func.sum(Invoice.tax).label("tax_collected"),
            func.sum(Invoice.total).label("net_total")
        ).filter(
            Invoice.tenant_id == g.parlour_id,
            Invoice.status != "Voided",
            Invoice.created_at >= start_date,
            Invoice.created_at <= end_date
        ).group_by(cast(Invoice.created_at, Date)).all()

        for row in tax_rows:
            writer.writerow([
                row.date.strftime("%Y-%m-%d") if row.date else "",
                float(row.gross_subtotal or 0.0),
                float(row.discount or 0.0),
                float(row.tax_collected or 0.0),
                float(row.net_total or 0.0)
            ])

    elif report_type == "employees":
        writer.writerow(["Employee Name", "Commission Rate (%)", "Services Rendered", "Total Revenue (INR)", "Estimated Commission (INR)"])
        emp_rows = db.session.query(
            Employee.first_name,
            Employee.last_name,
            Employee.commission_percentage,
            func.count(InvoiceLineItem.id).label("services_rendered"),
            func.sum(InvoiceLineItem.line_total).label("total_revenue")
        ).join(InvoiceLineItem, Employee.id == InvoiceLineItem.employee_id).join(
            Invoice, InvoiceLineItem.invoice_id == Invoice.id
        ).filter(
            Invoice.tenant_id == g.parlour_id,
            Invoice.status != "Voided",
            Invoice.created_at >= start_date,
            Invoice.created_at <= end_date
        ).group_by(Employee.id, Employee.first_name, Employee.last_name, Employee.commission_percentage).all()

        for r in emp_rows:
            rev = Decimal(str(r.total_revenue or 0.0))
            comm_pct = Decimal(str(r.commission_percentage or 0.0))
            comm_earned = rev * (comm_pct / Decimal("100.00"))
            writer.writerow([
                f"{r.first_name} {r.last_name or ''}".strip(),
                float(comm_pct),
                r.services_rendered,
                float(rev),
                float(comm_earned)
            ])

    csv_data = output.getvalue()
    filename = f"{report_type}_report_{datetime.now().strftime('%Y%m%d')}.csv"

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@reports_bp.route("/reports/procurement", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_procurement_report():
    preset = request.args.get("preset", "30days")
    start_date, end_date = parse_date_range(preset, request.args.get("start_date"), request.args.get("end_date"))

    from app.models.catalog import StockReorderLog
    logs = get_tenant_query(StockReorderLog).filter(
        StockReorderLog.created_at >= start_date,
        StockReorderLog.created_at <= end_date
    ).order_by(StockReorderLog.created_at.desc()).all()

    total_spent = Decimal("0.00")
    total_qty = 0
    items = []

    for log in logs:
        sub = log.cost_price * log.quantity
        total_spent += sub
        total_qty += log.quantity
        items.append({
            "id": log.id,
            "date": log.created_at.strftime("%Y-%m-%d %H:%M"),
            "product_name": log.product.name if log.product else "Deleted Product",
            "supplier_name": log.supplier.name if log.supplier else "N/A",
            "quantity": log.quantity,
            "cost_price": float(log.cost_price),
            "total_price": float(sub),
            "status": log.status
        })

    return success_response({
        "summary": {
            "total_spent": float(total_spent),
            "total_quantity": total_qty,
            "total_orders": len(logs)
        },
        "items": items
    })


@reports_bp.route("/reports/memberships", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin"])
def get_memberships_report():
    preset = request.args.get("preset", "30days")
    start_date, end_date = parse_date_range(preset, request.args.get("start_date"), request.args.get("end_date"))

    logs = get_tenant_query(CustomerMembership).filter(
        CustomerMembership.created_at >= start_date,
        CustomerMembership.created_at <= end_date
    ).order_by(CustomerMembership.created_at.desc()).all()

    total_revenue = Decimal("0.00")
    items = []

    for cm in logs:
        plan_price = cm.plan.price if cm.plan else Decimal("0.00")
        # Only count active/non-cancelled memberships toward revenue
        if cm.status != "cancelled":
            total_revenue += plan_price
        items.append({
            "id": cm.id,
            "customer_name": f"{cm.customer.first_name} {cm.customer.last_name or ''}".strip() if cm.customer else "Deleted Customer",
            "plan_name": cm.plan.name if cm.plan else "Deleted Plan",
            "price": float(plan_price),
            "start_date": cm.created_at.strftime("%Y-%m-%d"),
            "end_date": cm.expires_at.strftime("%Y-%m-%d") if cm.expires_at else "—",
            "status": cm.status,
            "created_at": cm.created_at.strftime("%Y-%m-%d %H:%M")
        })

    return success_response({
        "summary": {
            "total_revenue": float(total_revenue),
            "total_sold": len(logs)
        },
        "items": items
    })

