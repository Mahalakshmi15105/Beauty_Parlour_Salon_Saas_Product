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
from datetime import datetime, date, timedelta, timezone
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


@reports_bp.route("/reports/daily-sales-statement", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_daily_sales_statement():
    date_str = request.args.get("date") or date.today().isoformat()
    branch_id = request.args.get("branch_id", type=int) or getattr(g, "branch_id", 1) or 1

    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        target_date = date.today()

    from app.models.branch import Branch
    from app.models.expense import Expense
    from app.models.cash_denomination import CashDenomination
    from sqlalchemy import text

    parlour_name = "SALON"
    try:
        with db.get_master_engine().connect() as conn:
            row = conn.execute(text("SELECT name FROM tenants WHERE id = :tid"), {"tid": g.parlour_id}).fetchone()
            if row and row[0]:
                parlour_name = row[0]
    except Exception:
        pass

    branch = Branch.query.get(branch_id)
    branch_name = branch.name if branch else "MAIN BRANCH"

    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = datetime.combine(target_date, datetime.max.time())

    invoices = get_tenant_query(Invoice).filter(
        Invoice.created_at >= start_dt,
        Invoice.created_at <= end_dt,
        Invoice.status != "Voided"
    ).all()

    if branch_id:
        invoices = [inv for inv in invoices if inv.branch_id == branch_id]

    line_items_data = []
    staff_sales_map = {}
    sno = 1
    total_cash = Decimal("0.00")
    total_paytm = Decimal("0.00")
    total_card = Decimal("0.00")
    total_amt = Decimal("0.00")
    total_gst = Decimal("0.00")
    grand_total = Decimal("0.00")

    for inv in invoices:
        # Check payments for payment method breakdown
        pm_list = InvoicePayment.query.filter_by(invoice_id=inv.id).all()
        cash_paid = sum(p.amount for p in pm_list if p.payment_method == "Cash") or Decimal("0.00")
        paytm_paid = sum(p.amount for p in pm_list if p.payment_method in ["Paytm", "Google Pay", "PhonePe", "UPI"]) or Decimal("0.00")
        card_paid = sum(p.amount for p in pm_list if p.payment_method == "Card") or Decimal("0.00")

        for item in inv.items:
            serv_name = item.service.name if item.service else (item.product.name if item.product else "Service Item")
            emp_name = f"{item.employee.first_name} {item.employee.last_name or ''}".strip() if item.employee else "Staff"
            
            line_amt = item.unit_price * item.quantity
            line_gst = line_amt * Decimal("0.18") if getattr(item.service, "tax_inclusive", False) is False else Decimal("0.00")
            line_total = line_amt + line_gst

            total_amt += line_amt
            total_gst += line_gst
            grand_total += line_total

            # Track per staff
            if emp_name not in staff_sales_map:
                staff_sales_map[emp_name] = Decimal("0.00")
            staff_sales_map[emp_name] += line_total

            line_items_data.append({
                "sno": sno,
                "service": serv_name,
                "staff": emp_name,
                "amt": float(line_amt),
                "gst": float(line_gst),
                "cash": float(cash_paid) if sno == 1 else 0.0,
                "paytm": float(paytm_paid) if sno == 1 else 0.0,
                "card": float(card_paid) if sno == 1 else 0.0,
                "mc": 0,
                "total": float(line_total)
            })
            sno += 1

        total_cash += cash_paid
        total_paytm += paytm_paid
        total_card += card_paid

    # Expenses for date
    expenses = Expense.query.filter_by(tenant_id=g.parlour_id, branch_id=branch_id, is_deleted=False).filter(Expense.date == target_date).all()
    expense_list = [{"note": exp.note or "Expense", "amount": float(exp.amount)} for exp in expenses]
    total_expenses = sum(exp["amount"] for exp in expense_list)

    # Cash Denominations
    cd_rec = CashDenomination.query.filter_by(tenant_id=g.parlour_id, branch_id=branch_id, date=target_date).first()
    cd_data = {
        "500": cd_rec.count_500 if cd_rec else 0,
        "200": cd_rec.count_200 if cd_rec else 0,
        "100": cd_rec.count_100 if cd_rec else 0,
        "50": cd_rec.count_50 if cd_rec else 0,
        "20": cd_rec.count_20 if cd_rec else 0,
        "10": cd_rec.count_10 if cd_rec else 0,
        "5": cd_rec.count_5 if cd_rec else 0,
        "2": cd_rec.count_2 if cd_rec else 0,
        "1": cd_rec.count_1 if cd_rec else 0,
        "total": float(cd_rec.total) if cd_rec else 0.0
    }

    opening_bal = 130.0  # default starting balance
    closing_bal = opening_bal + float(total_cash) - total_expenses

    staff_achieved_list = [{"sno": idx + 1, "staff_name": k, "achieved": float(v)} for idx, (k, v) in enumerate(staff_sales_map.items())]

    # Month till date stats
    first_of_month = target_date.replace(day=1)
    month_invoices = get_tenant_query(Invoice).filter(
        Invoice.created_at >= datetime.combine(first_of_month, datetime.min.time()),
        Invoice.created_at <= end_dt,
        Invoice.status != "Voided"
    ).all()
    till_date_sales = sum(float(inv.subtotal) for inv in month_invoices)
    till_date_gst = sum(float(inv.tax) for inv in month_invoices)
    till_date_walkin = len(set(inv.customer_id for inv in month_invoices if inv.customer_id))
    till_date_abv = (till_date_sales / till_date_walkin) if till_date_walkin > 0 else 0.0

    return success_response({
        "parlour_name": parlour_name,
        "branch_name": branch_name,
        "date_str": target_date.strftime("%d/%m/%Y"),
        "day_name": target_date.strftime("%A").upper(),
        "line_items": line_items_data,
        "totals": {
            "amt": float(total_amt),
            "gst": float(total_gst),
            "cash": float(total_cash),
            "paytm": float(total_paytm),
            "card": float(total_card),
            "total": float(grand_total)
        },
        "expenses": expense_list,
        "total_expenses": total_expenses,
        "balance": {
            "opening_bal": opening_bal,
            "total_sale": float(grand_total),
            "cash_pay": float(total_cash),
            "phone_pay": float(total_paytm),
            "card": float(total_card),
            "expense": total_expenses,
            "closing_bal": closing_bal
        },
        "cash_denomination": cd_data,
        "staff_achieved": staff_achieved_list,
        "till_date": {
            "sales": till_date_sales,
            "with_gst": till_date_sales + till_date_gst,
            "walkin": till_date_walkin,
            "abv": till_date_abv
        }
    })


@reports_bp.route("/reports/monthly-performance-staff", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_monthly_performance_staff():
    month = request.args.get("month", type=int) or date.today().month
    year = request.args.get("year", type=int) or date.today().year
    branch_id = request.args.get("branch_id", type=int) or getattr(g, "branch_id", 1) or 1

    import calendar
    _, last_day = calendar.monthrange(year, month)
    start_dt = datetime(year, month, 1, 0, 0, 0)
    end_dt = datetime(year, month, last_day, 23, 59, 59)

    employees = get_tenant_query(Employee).filter_by(status="active").all()

    invoices = get_tenant_query(Invoice).filter(
        Invoice.created_at >= start_dt,
        Invoice.created_at <= end_dt,
        Invoice.status != "Voided"
    ).all()

    if branch_id:
        invoices = [inv for inv in invoices if inv.branch_id == branch_id]

    staff_records = []
    tot_achieved = 0.0
    tot_with_gst = 0.0
    tot_walkin = 0

    salon_male_sales = 0.0
    salon_male_walkin = set()
    salon_female_sales = 0.0
    salon_female_walkin = set()

    for idx, emp in enumerate(employees):
        emp_items = []
        emp_cust_set = set()
        emp_achieved = 0.0
        emp_tax = 0.0

        for inv in invoices:
            for item in inv.items:
                if item.employee_id == emp.id:
                    emp_achieved += float(item.line_total)
                    if inv.customer_id:
                        emp_cust_set.add(inv.customer_id)
                        cust = inv.customer
                        if cust and getattr(cust, "gender", "").lower() == "male":
                            salon_male_sales += float(item.line_total)
                            salon_male_walkin.add(inv.customer_id)
                        else:
                            salon_female_sales += float(item.line_total)
                            salon_female_walkin.add(inv.customer_id)

        walkin_cnt = len(emp_cust_set)
        salary_val = float(emp.salary or 0.0)
        target_val = float(emp.target or 0.0)
        abv_val = (emp_achieved / walkin_cnt) if walkin_cnt > 0 else 0.0
        pct_val = ((emp_achieved / target_val) * 100.0) if target_val > 0 else 0.0

        tot_achieved += emp_achieved
        tot_with_gst += emp_achieved  # inclusive total
        tot_walkin += walkin_cnt

        staff_records.append({
            "sno": idx + 1,
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
            "level": emp.level or "L1",
            "salary": salary_val,
            "target": target_val,
            "achieved": emp_achieved,
            "with_gst": emp_achieved,
            "walkin": walkin_cnt,
            "abv": abv_val,
            "percentage": pct_val,
            "review": 0,
            "mc": ""
        })

    all_walkin_cnt = len(set(inv.customer_id for inv in invoices if inv.customer_id))
    all_abv = (tot_achieved / all_walkin_cnt) if all_walkin_cnt > 0 else 0.0
    male_abv = (salon_male_sales / len(salon_male_walkin)) if len(salon_male_walkin) > 0 else 0.0
    female_abv = (salon_female_sales / len(salon_female_walkin)) if len(salon_female_walkin) > 0 else 0.0

    return success_response({
        "month_year": f"{calendar.month_name[month].upper()}-{year}",
        "staff_performance": staff_records,
        "totals": {
            "achieved": tot_achieved,
            "with_gst": tot_with_gst,
            "walkin": tot_walkin
        },
        "summary": {
            "salon_sales": {
                "sales": tot_achieved,
                "walkin": all_walkin_cnt,
                "abv": all_abv,
                "with_gst": tot_with_gst
            },
            "male_sales": {
                "sales": salon_male_sales,
                "walkin": len(salon_male_walkin),
                "abv": male_abv
            },
            "female_sales": {
                "sales": salon_female_sales,
                "walkin": len(salon_female_walkin),
                "abv": female_abv
            }
        }
    })


@reports_bp.route("/reports/attendance-salary-report", methods=["GET"])
@require_role(["ParlourAdmin", "BranchAdmin", "Receptionist"])
def get_attendance_salary_report():
    month = request.args.get("month", type=int) or date.today().month
    year = request.args.get("year", type=int) or date.today().year
    branch_id = request.args.get("branch_id", type=int) or getattr(g, "branch_id", 1) or 1

    import calendar
    from app.models.attendance import Attendance
    from app.models.payroll_adjustment import PayrollAdjustment

    _, total_days = calendar.monthrange(year, month)
    start_dt = datetime(year, month, 1, 0, 0, 0)
    end_dt = datetime(year, month, total_days, 23, 59, 59)

    days_list = []
    for d in range(1, total_days + 1):
        dt_val = date(year, month, d)
        days_list.append({
            "day": d,
            "day_name": dt_val.strftime("%A"),
            "full_date_label": dt_val.strftime("%A, %B %d, %Y")
        })

    employees = get_tenant_query(Employee).filter_by(status="active").all()
    attendances = Attendance.query.filter(
        Attendance.timestamp >= start_dt,
        Attendance.timestamp <= end_dt
    ).all()

    invoices = get_tenant_query(Invoice).filter(
        Invoice.created_at >= start_dt,
        Invoice.created_at <= end_dt,
        Invoice.status != "Voided"
    ).all()

    payroll_adjs = get_tenant_query(PayrollAdjustment).filter(
        PayrollAdjustment.date >= start_dt.date(),
        PayrollAdjustment.date <= end_dt.date()
    ).all()

    att_matrix = []
    salary_rows = []

    tot_salary = 0.0
    tot_target = 0.0
    tot_achieved = 0.0
    tot_net = 0.0
    tot_advance = 0.0
    tot_less = 0.0
    tot_payable = 0.0

    for idx, emp in enumerate(employees):
        emp_att_map = {}
        for d in range(1, total_days + 1):
            emp_att_map[str(d)] = "1"  # Default present unless logged otherwise

        emp_atts = [att for att in attendances if att.employee_id == emp.id]
        off_count = 0
        total_worked_days = 0.0

        for att in emp_atts:
            day_num = att.timestamp.day
            st = getattr(att, "status", "P") or "P"
            if st == "P":
                emp_att_map[str(day_num)] = "1"
            elif st == "HP":
                emp_att_map[str(day_num)] = "0.5"
            elif st == "OFF":
                emp_att_map[str(day_num)] = "OFF"

        for d in range(1, total_days + 1):
            val = emp_att_map[str(d)]
            if val == "1":
                total_worked_days += 1.0
            elif val == "0.5":
                total_worked_days += 0.5
            elif val == "OFF":
                off_count += 1

        att_matrix.append({
            "sno": idx + 1,
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
            "days": emp_att_map,
            "total_days": total_worked_days
        })

        # Achieved revenue this month
        emp_achieved = 0.0
        for inv in invoices:
            for item in inv.items:
                if item.employee_id == emp.id:
                    emp_achieved += float(item.line_total)

        # Advances & Deductions from Stage 5
        emp_adjs = [pa for pa in payroll_adjs if pa.employee_id == emp.id]
        emp_advances = sum(float(pa.amount) for pa in emp_adjs if pa.type == "Advance")
        emp_deductions = sum(float(pa.amount) for pa in emp_adjs if pa.type == "Deduction")

        salary_val = float(emp.salary or 0.0)
        target_val = float(emp.target or 0.0)
        net_salary = (salary_val / total_days) * total_worked_days if salary_val > 0 else 0.0
        final_payable = max(net_salary - emp_deductions + emp_advances, 0.0)

        tot_salary += salary_val
        tot_target += target_val
        tot_achieved += emp_achieved
        tot_net += net_salary
        tot_advance += emp_advances
        tot_less += emp_deductions
        tot_payable += final_payable

        salary_rows.append({
            "sno": idx + 1,
            "id": emp.id,
            "name": f"{emp.first_name} {emp.last_name or ''}".strip(),
            "salary": salary_val,
            "target": target_val,
            "achieved": emp_achieved,
            "off": off_count,
            "total_days": total_worked_days,
            "net": net_salary,
            "advance": emp_advances,
            "less_amount": emp_deductions,
            "amount": final_payable
        })

    return success_response({
        "month_year": f"{calendar.month_name[month].upper()}-{str(year)[-2:]}",
        "days_in_month": days_list,
        "attendance_matrix": att_matrix,
        "salary_report": salary_rows,
        "totals": {
            "salary": tot_salary,
            "target": tot_target,
            "achieved": tot_achieved,
            "net": tot_net,
            "advance": tot_advance,
            "less_amount": tot_less,
            "amount": tot_payable
        }
    })


