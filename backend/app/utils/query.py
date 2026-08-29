def paginate_query(query, model, limit_val=20, cursor=None, sort_field="id", sort_desc=False):
    """
    Applies keyset cursor-based pagination and sorting to a query.
    """
    # Parse limit
    try:
        limit_val = min(int(limit_val), 10000)
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
