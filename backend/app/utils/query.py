def paginate_query(query, model, limit_val=20, cursor=None, sort_field="id", sort_desc=False):
    """
    Applies keyset cursor-based pagination and sorting to a query.
    """
    # Parse limit (cap at max 500 items per request for safety)
    try:
        limit_val = max(1, min(int(limit_val), 500))
    except (ValueError, TypeError):
        limit_val = 20

    # Apply cursor logic (assumes cursor is the ID of the last item)
    if cursor:
        try:
            cursor_id = int(cursor)
            if sort_desc:
                query = query.filter(model.id < cursor_id)
            else:
                query = query.filter(model.id > cursor_id)
        except ValueError:
            pass

    # Apply sorting
    sort_attr = getattr(model, sort_field, None)
    if sort_attr is None:
        sort_attr = model.id

    if sort_desc:
        query = query.order_by(sort_attr.desc(), model.id.desc())
    else:
        query = query.order_by(sort_attr.asc(), model.id.asc())

    # Fetch one extra to verify if next page exists
    items = query.limit(limit_val + 1).all()

    has_next = len(items) > limit_val
    if has_next:
        items = items[:limit_val]
        next_cursor = str(items[-1].id)
    else:
        next_cursor = None

    return items, next_cursor


def generate_unique_invoice_number(tenant_id, branch_id=None):
    """
    Generates a unique, collision-proof sequential invoice number.
    Format: INV-{tenant_id}-{sequential_number:06d}
    Guarantees uniqueness against DB unique constraint (invoices.ix_invoices_invoice_number).
    """
    from app.models.billing import Invoice
    from app.database import db

    prefix = f"INV-{tenant_id}-"

    # Query for the latest invoice row for this tenant to find the current highest integer sequence
    last_invoice = (
        db.session.query(Invoice.invoice_number)
        .filter(Invoice.tenant_id == tenant_id)
        .filter(Invoice.invoice_number.like(f"{prefix}%"))
        .order_by(Invoice.id.desc())
        .first()
    )

    next_seq = 1
    if last_invoice and last_invoice.invoice_number:
        try:
            parts = last_invoice.invoice_number.split("-")
            if len(parts) >= 3 and parts[-1].isdigit():
                next_seq = int(parts[-1]) + 1
        except Exception:
            pass

    # Safety loop: ensure candidate number does not exist anywhere in invoices table
    while True:
        candidate = f"{prefix}{next_seq:06d}"
        exists = db.session.query(Invoice.id).filter(Invoice.invoice_number == candidate).first()
        if not exists:
            return candidate
        next_seq += 1

