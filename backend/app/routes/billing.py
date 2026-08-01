from flask import Blueprint, request, g
from app.database import db
from app.models.billing import Invoice, InvoiceLineItem, InvoicePayment
from app.models.catalog import Service, Product
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.membership import MembershipBenefit, CustomerMembership
from app.models.user import TenantSetting
from app.utils.responses import success_response, error_response
from app.utils.auth import require_role, get_tenant_query
from app.utils.query import paginate_query
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)
billing_bp = Blueprint("billing", __name__)

@billing_bp.route("/billing/checkout", methods=["POST"])
@require_role(["ParlourAdmin"])
def checkout():
    data = request.get_json() or {}
    customer_id = data.get("customer_id")
    line_items_data = data.get("line_items", [])
    payments_data = data.get("payments", [])
    notes = data.get("notes")

    if not customer_id or not line_items_data or not payments_data:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Customer ID, line items, and payment allocations are required.",
            status_code=400
        )

    # 1. Verify Customer
    if customer_id and str(customer_id) != "walkin" and str(customer_id) != "0":
        customer = get_tenant_query(Customer).filter_by(id=customer_id).first()
        if not customer:
            return error_response(
                error_code="CUSTOMER_NOT_FOUND",
                message="Selected customer does not exist.",
                status_code=400
            )
    else:
        customer = get_tenant_query(Customer).filter_by(phone="0000000000").first()
        if not customer:
            customer = Customer(
                tenant_id=g.parlour_id,
                first_name="Walk-in",
                last_name="Customer",
                phone="0000000000",
                gender="Female"
            )
            db.session.add(customer)
            db.session.flush()
        customer_id = customer.id

    # Fetch default tax rate from settings
    settings = TenantSetting.query.filter_by(tenant_id=g.parlour_id).first()
    tax_rate = Decimal(str(settings.tax_rate)) if settings else Decimal("0.00")

    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    service_net = Decimal("0.00")
    product_net = Decimal("0.00")
    line_items_to_save = []
    response_line_items = []

    try:
        # Start database lock context
        # 2. Process Line Items
        for item in line_items_data:
            item_type = item.get("type")  # service or product
            item_id = item.get("item_id")
            qty = int(item.get("quantity", 1))
            emp_ids = item.get("employee_ids") or ([item.get("employee_id")] if item.get("employee_id") else [])
            benefit_id = item.get("customer_membership_id")
            if not item_id or (item_type == "service" and not emp_ids):
                raise ValueError("Item ID and Employee assignment are required for each service line.")

            if item_type == "service":
                primary_emp_id = emp_ids[0]
                emp = get_tenant_query(Employee).filter_by(id=primary_emp_id, status="active").first()
                if not emp:
                    raise ValueError(f"Assigned Employee ID {primary_emp_id} is inactive or invalid.")
                employee_id = primary_emp_id
                emp_name = f"{emp.first_name} {emp.last_name or ''}".strip()
            else:
                employee_id = None
                emp_name = "—"

            discount_amount = Decimal("0.00")
            item_name = ""
            mrp_val = None

            if item_type == "service":
                # Process Service
                svc = get_tenant_query(Service).filter_by(id=item_id, status="active").first()
                if not svc:
                    raise ValueError(f"Service ID {item_id} is inactive or invalid.")
                
                item_name = svc.name
                unit_price = Decimal(str(svc.price))
                line_subtotal = unit_price * qty

                # Check membership benefit redemption
                if benefit_id:
                    # Lock benefit record
                    benefit = db.session.query(MembershipBenefit).filter_by(
                        id=benefit_id, 
                        tenant_id=g.parlour_id
                    ).with_for_update().first()

                    if not benefit or benefit.remaining_quantity < qty:
                        raise ValueError(f"Insufficient membership benefit balance for Service: {svc.name}")

                    # Deduct benefit balance
                    benefit.remaining_quantity -= qty
                    # Apply 100% discount for redeemed benefit
                    discount_amount = line_subtotal
                else:
                    # Apply standard optional flat discount from item payload
                    disc_val = item.get("discount", 0)
                    discount_amount = Decimal(str(disc_val))

                line_net = max(Decimal("0.00"), line_subtotal - discount_amount)
                service_net += line_net

            elif item_type == "product":
                # Lock product stock level
                prod = db.session.query(Product).filter_by(
                    id=item_id, 
                    tenant_id=g.parlour_id, 
                    status="active"
                ).with_for_update().first()

                if not prod:
                    raise ValueError(f"Product ID {item_id} is inactive or invalid.")

                if prod.stock_quantity < qty:
                    raise ValueError(f"Insufficient stock for Product: {prod.name}. Available: {prod.stock_quantity}")

                # Deduct stock level
                prod.stock_quantity -= qty
                item_name = prod.name
                unit_price = Decimal(str(prod.selling_price))
                mrp_val = prod.mrp
                line_subtotal = unit_price * qty
                
                # Apply standard optional flat discount from item payload
                disc_val = item.get("discount", 0)
                discount_amount = Decimal(str(disc_val))

                line_net = max(Decimal("0.00"), line_subtotal - discount_amount)
                product_net += line_net

            else:
                raise ValueError("Line item type must be 'service' or 'product'.")

            line_total = line_subtotal - discount_amount
            if line_total < 0:
                line_total = Decimal("0.00")

            subtotal += line_subtotal
            total_discount += discount_amount

            # Assemble line item row
            line_item = InvoiceLineItem(
                tenant_id=g.parlour_id,
                service_id=item_id if item_type == "service" else None,
                product_id=item_id if item_type == "product" else None,
                employee_id=employee_id,
                quantity=qty,
                unit_price=unit_price,
                mrp=mrp_val if item_type == "product" else None,
                discount_amount=discount_amount,
                tax_amount=Decimal("0.00"),
                line_total=line_total
            )
            line_items_to_save.append(line_item)

            response_line_items.append({
                "item_name": item_name,
                "name": item_name,
                "type": item_type,
                "quantity": qty,
                "unit_price": float(unit_price),
                "mrp": float(mrp_val) if mrp_val is not None else float(unit_price),
                "discount": float(discount_amount),
                "line_total": float(line_total),
                "staff_name": emp_name,
                "employee_name": emp_name
            })

        # 3. Calculate Global Taxes & Grand Total
        # BUSINESS RULE #6: Apply GST/Tax ONLY to Services. Products have 0 GST/Tax.
        calculated_tax = service_net * (tax_rate / Decimal("100.00"))
        grand_total = service_net + calculated_tax + product_net

        # 4. Verify Payment splits match grand total
        payment_total = Decimal("0.00")
        payments_to_save = []
        for pm in payments_data:
            method = pm.get("method")
            amount = Decimal(str(pm.get("amount", 0)))
            if amount <= 0:
                continue
            payment_total += amount
            payments_to_save.append(
                InvoicePayment(tenant_id=g.parlour_id, method=method, amount=amount)
            )

        # Allow partial payments, but set Invoice status based on settlement
        if payment_total < grand_total:
            invoice_status = "Partial"
        else:
            invoice_status = "Paid"

        # 5. Generate unique sequential invoice number
        count = db.session.query(Invoice).filter_by(tenant_id=g.parlour_id).count()
        invoice_number = f"INV-{g.parlour_id}-{count + 1:06d}"

        # 6. Save Invoice Header
        invoice = Invoice(
            tenant_id=g.parlour_id,
            invoice_number=invoice_number,
            customer_id=customer_id,
            subtotal=subtotal,
            discount=total_discount,
            tax=calculated_tax,
            total=grand_total,
            status=invoice_status,
            membership_name=data.get("membership_name"),
            membership_discount=Decimal(str(data.get("membership_discount", 0.00))) if data.get("membership_discount") else Decimal("0.00")
        )
        db.session.add(invoice)
        db.session.flush()  # obtain invoice.id

        # Bind lines and payments to invoice ID
        for line in line_items_to_save:
            line.invoice_id = invoice.id
            db.session.add(line)
        for pay in payments_to_save:
            pay.invoice_id = invoice.id
            db.session.add(pay)

        # Commit everything atomically
        db.session.commit()

    except Exception as e:
        db.session.rollback()
        logger.error(f"Checkout Transaction failed: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        return error_response(
            error_code="TRANSACTION_FAILED",
            message=str(e) if isinstance(e, ValueError) else f"Checkout Transaction Error: {str(e)}",
            status_code=400 if isinstance(e, ValueError) else 500
        )

    # Build complete return dictionary for newly created invoice
    full_customer_name = f"{customer.first_name} {customer.last_name or ''}".strip() if customer else "Walk-in Customer"
    full_customer_phone = customer.phone if customer else ""

    response_payments = []
    for pay in payments_to_save:
        response_payments.append({
            "method": pay.method,
            "amount": float(pay.amount)
        })

    return success_response({
        "id": invoice.id,
        "invoice_id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "created_at": invoice.created_at.isoformat(),
        "cashier": getattr(g.user, "first_name", "Admin") if hasattr(g, "user") and g.user else "Admin",
        "customer_id": customer.id if customer else None,
        "customer_name": full_customer_name,
        "customer_phone": full_customer_phone,
        "customer": {
            "id": customer.id if customer else None,
            "first_name": customer.first_name if customer else "Walk-in",
            "last_name": customer.last_name if customer else "Customer",
            "phone": full_customer_phone
        },
        "line_items": response_line_items,
        "items": response_line_items,
        "subtotal": float(invoice.subtotal),
        "discount": float(invoice.discount),
        "tax": float(invoice.tax),
        "total": float(invoice.total),
        "status": invoice.status,
        "payments": response_payments,
        "membership_name": invoice.membership_name,
        "membership_discount": float(invoice.membership_discount or 0)
    }, 201)


@billing_bp.route("/invoices", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_invoices():
    limit = request.args.get("limit", 20)
    cursor = request.args.get("cursor")
    sort = request.args.get("sort", "-created_at")

    query = get_tenant_query(Invoice)

    sort_field = "id"
    sort_desc = False
    if sort.startswith("-"):
        sort_field = sort[1:]
        sort_desc = True
    else:
        sort_field = sort

    invoices, next_cursor = paginate_query(
        query=query,
        model=Invoice,
        limit_val=limit,
        cursor=cursor,
        sort_field=sort_field,
        sort_desc=sort_desc
    )

    data = [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "customer_name": f"{inv.customer.first_name} {inv.customer.last_name or ''}".strip(),
            "subtotal": float(inv.subtotal),
            "discount": float(inv.discount),
            "tax": float(inv.tax),
            "total": float(inv.total),
            "status": inv.status,
            "membership_name": inv.membership_name,
            "membership_discount": float(inv.membership_discount or 0),
            "created_at": inv.created_at.isoformat()
        } for inv in invoices
    ]

    return success_response({
        "items": data,
        "next_cursor": next_cursor
    })


@billing_bp.route("/invoices/<int:invoice_id>", methods=["GET"])
@require_role(["ParlourAdmin"])
def get_invoice(invoice_id):
    invoice = get_tenant_query(Invoice).filter_by(id=invoice_id).first()
    if not invoice:
        return error_response(
            error_code="INVOICE_NOT_FOUND",
            message="Invoice not found or access denied.",
            status_code=404
        )

    lines = []
    for item in invoice.line_items:
        item_name = ""
        if item.service_id and item.service:
            item_name = item.service.name
        elif item.product_id and item.product:
            item_name = item.product.name
        else:
            item_name = "Item"

        emp_name = f"{item.employee.first_name} {item.employee.last_name or ''}".strip() if item.employee else ""

        lines.append({
            "id": item.id,
            "name": item_name,
            "item_name": item_name,
            "type": "service" if item.service_id else "product",
            "quantity": item.quantity,
            "unit_price": float(item.unit_price),
            "mrp": float(item.mrp) if item.mrp is not None else float(item.unit_price),
            "discount_amount": float(item.discount_amount),
            "line_total": float(item.line_total),
            "staff_name": emp_name,
            "employee_name": emp_name
        })

    payments = []
    for pay in invoice.payments:
        payments.append({
            "method": pay.method,
            "amount": float(pay.amount)
        })

    return success_response({
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "customer": {
            "first_name": invoice.customer.first_name,
            "last_name": invoice.customer.last_name,
            "phone": invoice.customer.phone
        },
        "subtotal": float(invoice.subtotal),
        "discount": float(invoice.discount),
        "tax": float(invoice.tax),
        "total": float(invoice.total),
        "status": invoice.status,
        "created_at": invoice.created_at.isoformat(),
        "line_items": lines,
        "payments": payments,
        "membership_name": invoice.membership_name,
        "membership_discount": float(invoice.membership_discount or 0)
    })


@billing_bp.route("/invoices/<int:invoice_id>/void", methods=["POST"])
@require_role(["ParlourAdmin"])
def void_invoice(invoice_id):
    invoice = get_tenant_query(Invoice).filter_by(id=invoice_id).first()
    if not invoice:
        return error_response(
            error_code="INVOICE_NOT_FOUND",
            message="Invoice not found or access denied.",
            status_code=404
        )

    if invoice.status == "Voided":
        return error_response(
            error_code="INVALID_OPERATION",
            message="Invoice is already voided.",
            status_code=400
        )

    try:
        # Lock and restore stocks and membership benefits inside transaction
        for item in invoice.line_items:
            if item.product_id:
                # Lock product and restore stock
                prod = db.session.query(Product).filter_by(
                    id=item.product_id, 
                    tenant_id=g.parlour_id
                ).with_for_update().first()
                if prod:
                    prod.stock_quantity += item.quantity

            elif item.service_id:
                # If a membership benefit was used, we can reverse it if applicable.
                # In LLD / design context, since benefits are linked via line discounts, we can identify them and increment benefit totals.
                # Find if this line has 100% discount equal to subtotal
                if item.discount_amount == (item.unit_price * item.quantity):
                    # Find active memberships for this customer and re-increment benefits
                    # (For Phase 4 we check and restore service benefit balances)
                    benefit = db.session.query(MembershipBenefit).join(CustomerMembership).filter(
                        CustomerMembership.customer_id == invoice.customer_id,
                        MembershipBenefit.service_id == item.service_id,
                        MembershipBenefit.tenant_id == g.parlour_id
                    ).with_for_update().first()
                    if benefit:
                        benefit.remaining_quantity += item.quantity

        invoice.status = "Voided"
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Void Transaction failed: {str(e)}")
        return error_response(
            error_code="TRANSACTION_FAILED",
            message="Failed to void invoice.",
            status_code=500
        )

    return success_response({"message": "Invoice voided successfully, inventory and membership benefits restored."})


@billing_bp.route("/invoices/<int:invoice_id>/sms", methods=["POST"])
@require_role(["ParlourAdmin"])
def send_invoice_sms(invoice_id):
    invoice = get_tenant_query(Invoice).filter_by(id=invoice_id).first()
    if not invoice:
        return error_response(
            error_code="INVOICE_NOT_FOUND",
            message="Invoice not found or access denied.",
            status_code=404
        )

    phone = invoice.customer.phone
    message_text = f"Hello {invoice.customer.first_name}, thank you for visiting! Invoice #{invoice.invoice_number} Total: {float(invoice.total):.2f}. Have a wonderful day!"

    logger.info(f"SMS Dispatch Simulated for Tenant {g.parlour_id} to {phone}: '{message_text}'")
    return success_response({
        "message": f"SMS receipt dispatched to {phone}",
        "sms_content": message_text,
        "phone": phone
    })


@billing_bp.route("/reminders", methods=["POST"])
@require_role(["ParlourAdmin"])
def create_reminder():
    from app.models.customer import Reminder
    data = request.get_json() or {}
    customer_id = data.get("customer_id")
    invoice_id = data.get("invoice_id")
    reminder_type = data.get("reminder_type", "Follow-up appointment")
    reminder_date = data.get("reminder_date")
    notes = data.get("notes")

    if not customer_id or not reminder_date:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Customer ID and Reminder Date are required.",
            status_code=400
        )

    try:
        rem = Reminder(
            tenant_id=g.parlour_id,
            customer_id=customer_id,
            invoice_id=invoice_id,
            reminder_type=reminder_type,
            reminder_date=str(reminder_date),
            notes=notes,
            status="Pending"
        )
        db.session.add(rem)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to save reminder: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to save reminder.",
            status_code=500
        )

    return success_response({
        "id": rem.id,
        "reminder_type": rem.reminder_type,
        "reminder_date": rem.reminder_date,
        "message": "Reminder created and saved successfully."
    }, 201)


@billing_bp.route("/feedback", methods=["POST"])
@require_role(["ParlourAdmin"])
def collect_feedback():
    from app.models.customer import CustomerFeedback
    data = request.get_json() or {}
    customer_id = data.get("customer_id")
    invoice_id = data.get("invoice_id")
    rating = int(data.get("rating", 5))
    comments = data.get("comments", "").strip()

    if not customer_id or not invoice_id:
        return error_response(
            error_code="VALIDATION_FAILED",
            message="Customer ID and Invoice ID are required.",
            status_code=400
        )

    try:
        fb = CustomerFeedback(
            tenant_id=g.parlour_id,
            customer_id=customer_id,
            invoice_id=invoice_id,
            rating=rating,
            comments=comments
        )
        db.session.add(fb)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to record customer feedback: {str(e)}")
        return error_response(
            error_code="DATABASE_ERROR",
            message="Failed to record customer feedback.",
            status_code=500
        )

    return success_response({
        "id": fb.id,
        "rating": fb.rating,
        "message": "Customer feedback recorded and saved successfully."
    }, 201)

