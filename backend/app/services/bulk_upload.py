"""
Bulk Upload Service
Shared functionality for processing Excel bulk uploads for Customers, Employees, Services, and Products
"""
from io import BytesIO
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation
from flask import g

logger = logging.getLogger(__name__)

# Canonical headers for downloadable Excel templates
TEMPLATE_HEADERS = {
    'customers': [
        'First Name',
        'Last Name',
        'Phone Number',
        'Gender',
        'Date of Birth',
        'Address',
        'Spot'
    ],
    'employees': [
        'First Name',
        'Last Name',
        'Phone Number',
        'Role / Job Title',
        'Login Username / Email',
        'Login Password',
        'Specialization',
        'Salary',
        'Target',
        'Level',
        'Status',
        'Joining Date',
        'Shift Start Time',
        'Shift End Time',
        'Monthly Paid Offs'
    ],
    'services': [
        'Service Name',
        'Category Name',
        'Price',
        'Status',
        'Membership Plan Name',
        'Membership Discount (%)',
        'Membership Discount Amount'
    ],
    'products': [
        'Product Name',
        'Category',
        'SKU',
        'Barcode',
        'Cost Price',
        'Selling Price',
        'MRP',
        'Stock Quantity',
        'Low Stock Threshold',
        'Status'
    ]
}

# Field mapping configurations for each module (including aliases for robust parsing)
FIELD_MAPPINGS = {
    'customers': {
        'First Name': 'first_name',
        'Last Name': 'last_name',
        'Phone Number': 'phone',
        'Gender': 'gender',
        'Date of Birth': 'date_of_birth',
        'Address': 'address',
        'Spot': 'spot',
        # Tolerant aliases so variant header names are never rejected
        'Last Name (Optional)': 'last_name',
        'Date of Birth (Optional)': 'date_of_birth',
        'Address (Optional)': 'address',
        'Gender (Optional)': 'gender',
        'Email': 'email',
        'Email Address': 'email',
        'Notes': 'notes',
        'Phone': 'phone',
        'Mobile': 'phone',
        'Mobile Number': 'phone',
        'DOB': 'date_of_birth',
        'Birth Date': 'date_of_birth',
        'First Name *': 'first_name',
        'Phone Number *': 'phone',
    },
    'employees': {
        'First Name': 'first_name',
        'Last Name': 'last_name',
        'Phone Number': 'phone',
        'Role / Job Title': 'role',
        'Role': 'role',
        'Login Username / Email': 'username',
        'Login Password': 'password',
        'Specialization': 'specialization',
        'Salary': 'salary',
        'Target': 'target',
        'Level': 'level',
        'Status': 'status',
        'Joining Date': 'joining_date',
        'Shift Start Time': 'shift_start_time',
        'Shift End Time': 'shift_end_time',
        'Monthly Paid Offs': 'monthly_offs',
        # Tolerant header aliases
        'Last Name (Optional)': 'last_name',
        'Role / Job Title (Optional)': 'role',
        'Role (Optional)': 'role',
        'Job Title': 'role',
        'Job Title (Optional)': 'role',
        'Specialization (Optional)': 'specialization',
        'Login Username': 'username',
        'Login Email': 'username',
        'Username / Email': 'username',
        'Username': 'username',
        'Email': 'username',
        'Password': 'password',
        'First Name *': 'first_name',
        'Phone Number *': 'phone',
        'Salary *': 'salary',
        'Salary (₹)': 'salary',
        'Target (₹)': 'target',
        'Target *': 'target',
        'Level (L1/L2/L3)': 'level',
        'Monthly Offs': 'monthly_offs',
        'Monthly Paid Offs': 'monthly_offs',
        'Paid Offs': 'monthly_offs',
        'Shift Start': 'shift_start_time',
        'Shift End': 'shift_end_time',
        'Phone': 'phone',
        'Mobile': 'phone',
        'Mobile Number': 'phone',
        'Commission %': 'commission_percentage',
        'Commission': 'commission_percentage',
    },
    'services': {
        'Service Name': 'name',
        'Category Name': 'category_name',
        'Category': 'category_name',
        'Price': 'price',
        'Price (₹)': 'price',
        'Status': 'status',
        'Membership Plan Name': 'membership_plan_name',
        'Membership Discount (%)': 'membership_discount_percentage',
        'Membership Discount Amount': 'membership_discount_amount',
        'Duration (minutes)': 'duration_minutes',
        'Duration (mins)': 'duration_minutes',
        'Duration': 'duration_minutes',
        'Description': 'description',
        'Service Name *': 'name',
        'Category Name *': 'category_name',
        'Price *': 'price',
    },
    'products': {
        'Product Name': 'name',
        'Category': 'category',
        'SKU': 'sku',
        'Barcode': 'barcode',
        'Cost Price': 'cost_price',
        'Selling Price': 'selling_price',
        'MRP': 'mrp',
        'Stock Quantity': 'stock_quantity',
        'Low Stock Threshold': 'low_stock_threshold',
        'Status': 'status'
    }
}

# Required fields for each module
REQUIRED_FIELDS = {
    'customers': ['First Name', 'Phone Number'],
    'employees': ['First Name', 'Phone Number'],
    'services': ['Service Name', 'Category Name', 'Price'],
    'products': ['Product Name', 'Cost Price', 'Selling Price', 'MRP', 'Stock Quantity']
}

# Optional fields for each module
OPTIONAL_FIELDS = {
    'customers': ['Last Name', 'Gender', 'Date of Birth', 'Address', 'Spot', 'Email', 'Notes'],
    'employees': ['Last Name', 'Role / Job Title', 'Role', 'Login Username / Email', 'Login Password', 'Specialization', 'Salary', 'Target', 'Level', 'Status', 'Joining Date', 'Shift Start Time', 'Shift End Time', 'Monthly Paid Offs', 'Commission %'],
    'services': ['Status', 'Membership Plan Name', 'Membership Discount (%)', 'Membership Discount Amount', 'Duration (minutes)', 'Description'],
    'products': ['Category', 'SKU', 'Barcode', 'Low Stock Threshold', 'Status']
}

def get_membership_mode(tenant_id, branch_id=None):
    if not tenant_id:
        return "paid_plan"
    try:
        from app.models.visit_membership import VisitMembershipSetting
        from app.utils.auth import get_tenant_query
        was_master = getattr(g, 'use_master_db', False)
        g.use_master_db = False
        setting = get_tenant_query(VisitMembershipSetting).filter_by(tenant_id=tenant_id).first()
        g.use_master_db = was_master
        if setting and setting.membership_mode:
            return setting.membership_mode
    except Exception:
        pass
    return "paid_plan"

def generate_excel_template(module_name, tenant_id=None, branch_id=None):
    """
    Generate an Excel template for the specified module
    Returns the Excel file as bytes
    """
    try:
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = f"{module_name.capitalize()} Template"
        
        # Get field mapping for this module
        field_mapping = FIELD_MAPPINGS.get(module_name, {})
        mode = get_membership_mode(tenant_id, branch_id)

        if module_name == 'services' and mode not in ['paid_plan', 'discount_plan']:
            headers = ['Service Name', 'Category Name', 'Price', 'Status']
        elif module_name == 'services':
            headers = ['Service Name', 'Category Name', 'Price', 'Status', 'Membership Plan Name', 'Membership Discount (%)', 'Membership Discount Amount']
        elif module_name in TEMPLATE_HEADERS:
            headers = list(TEMPLATE_HEADERS[module_name])
        else:
            headers = list(field_mapping.keys())
        
        # Style the header row
        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="EC4899", end_color="EC4899", fill_type="solid")
        header_alignment = Alignment(horizontal="center", vertical="center")
        
        # Write headers
        for col_num, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col_num, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_alignment
        
        # Add sample data row
        sample_data = get_sample_data(module_name, membership_mode=mode)
        if sample_data:
            for row_num, row_data in enumerate(sample_data, 2):
                for col_num, header in enumerate(headers, 1):
                    field_key = field_mapping[header]
                    value = row_data.get(field_key, '')
                    ws.cell(row=row_num, column=col_num, value=value)
                
                # Pre-fill dynamic Excel formula for Membership Discount Amount if present
                if module_name == 'services' and 'Membership Discount Amount' in headers and 'Price' in headers and 'Membership Discount (%)' in headers:
                    price_col = openpyxl.utils.get_column_letter(headers.index('Price') + 1)
                    pct_col = openpyxl.utils.get_column_letter(headers.index('Membership Discount (%)') + 1)
                    amt_col_idx = headers.index('Membership Discount Amount') + 1
                    formula_str = f"=IF(AND(ISNUMBER({price_col}{row_num}), ISNUMBER({pct_col}{row_num})), ROUND({price_col}{row_num}*({pct_col}{row_num}/100), 2), \"\")"
                    ws.cell(row=row_num, column=amt_col_idx, value=formula_str)
        
        # Auto-adjust column widths with proper padding so headers are clearly readable
        for col_num, header in enumerate(headers, 1):
            col_letter = openpyxl.utils.get_column_letter(col_num) if hasattr(openpyxl.utils, 'get_column_letter') else chr(64 + col_num)
            header_len = len(str(header))
            sample_val = str(sample_data[0].get(field_mapping.get(header, ''), '')) if sample_data else ''
            max_len = max(header_len, len(sample_val), 14)
            ws.column_dimensions[col_letter].width = max_len + 6
        
        # Add Excel Data Validation Dropdowns
        from openpyxl.worksheet.datavalidation import DataValidation
        from app.utils.auth import get_tenant_query
        
        if module_name == 'services' and tenant_id:
            from app.models.membership import MembershipPlan
            from app.models.catalog import ServiceCategory
            was_master = getattr(g, 'use_master_db', False)
            g.use_master_db = False

            # Category Name Dropdown (Col B)
            try:
                cats = get_tenant_query(ServiceCategory).filter_by(tenant_id=tenant_id, is_deleted=False).all()
                cat_names = [c.name.replace('"', '').strip() for c in cats if c.name]
                if cat_names:
                    cat_formula = f'"{",".join(cat_names)}"'
                    dv_cat = DataValidation(type="list", formula1=cat_formula, allow_blank=True)
                    dv_cat.hide_drop_down = None
                    dv_cat.showInputMessage = True
                    dv_cat.promptTitle = "Category Selection"
                    dv_cat.prompt = "Select an existing category from the dropdown or type a new category name."
                    dv_cat.showErrorMessage = True
                    dv_cat.errorStyle = "information"
                    dv_cat.errorTitle = "Category Notice"
                    dv_cat.error = f"Existing categories: {', '.join(cat_names)}. You can also type a new category name."
                    ws.add_data_validation(dv_cat)
                    dv_cat.add("B2:B500")
            except Exception as e:
                logger.error(f"Error adding category validation dropdown: {e}")

            # Status Dropdown
            try:
                dv_status = DataValidation(type="list", formula1='"active,inactive"', allow_blank=True)
                dv_status.hide_drop_down = None
                dv_status.showInputMessage = True
                dv_status.promptTitle = "Status Selection"
                dv_status.prompt = "Select 'active' or 'inactive'."
                dv_status.showErrorMessage = True
                dv_status.errorStyle = "information"
                dv_status.errorTitle = "Status Selection"
                dv_status.error = "Please select either 'active' or 'inactive'."
                ws.add_data_validation(dv_status)
                status_idx = headers.index('Status') + 1 if 'Status' in headers else 6
                status_col = openpyxl.utils.get_column_letter(status_idx) if hasattr(openpyxl.utils, 'get_column_letter') else chr(64 + status_idx)
                dv_status.add(f"{status_col}2:{status_col}500")
            except Exception as e:
                logger.error(f"Error adding status validation dropdown: {e}")

            # Membership Plan Name Dropdown (Col G when in paid_plan mode)
            if 'Membership Plan Name' in headers:
                try:
                    plans = get_tenant_query(MembershipPlan).filter_by(tenant_id=tenant_id, status='active').all()
                    plan_names = [p.name or p.plan_name for p in plans if (p.name or p.plan_name)]
                    plan_names = [p.replace('"', '').strip() for p in plan_names if p]
                    if plan_names:
                        plan_formula = f'"{",".join(plan_names)}"'
                        dv_plan = DataValidation(type="list", formula1=plan_formula, allow_blank=True)
                        dv_plan.hide_drop_down = None
                        dv_plan.showInputMessage = True
                        dv_plan.promptTitle = "Membership Plan Selection"
                        dv_plan.prompt = f"Select an active plan from dropdown: {', '.join(plan_names)}"
                        dv_plan.showErrorMessage = True
                        dv_plan.errorStyle = "information"
                        dv_plan.errorTitle = "Membership Plan Selection"
                        dv_plan.error = f"Active membership plans: {', '.join(plan_names)}"
                        ws.add_data_validation(dv_plan)
                        plan_idx = headers.index('Membership Plan Name') + 1
                        plan_col = openpyxl.utils.get_column_letter(plan_idx) if hasattr(openpyxl.utils, 'get_column_letter') else chr(64 + plan_idx)
                        dv_plan.add(f"{plan_col}2:{plan_col}500")
                except Exception as e:
                    logger.error(f"Error adding membership plan validation dropdown: {e}")

            g.use_master_db = was_master

        elif module_name == 'customers':
            try:
                dv_gender = DataValidation(type="list", formula1='"Female,Male,Other"', allow_blank=True)
                dv_gender.hide_drop_down = None
                dv_gender.showInputMessage = True
                dv_gender.promptTitle = "Gender Selection"
                dv_gender.prompt = "Select Female, Male, or Other."
                dv_gender.showErrorMessage = True
                dv_gender.errorStyle = "information"
                dv_gender.errorTitle = "Gender Selection"
                dv_gender.error = "Please select Female, Male, or Other."
                ws.add_data_validation(dv_gender)
                gender_idx = headers.index('Gender') + 1 if 'Gender' in headers else 4
                gender_col = openpyxl.utils.get_column_letter(gender_idx) if hasattr(openpyxl.utils, 'get_column_letter') else 'D'
                dv_gender.add(f"{gender_col}2:{gender_col}500")
            except Exception as e:
                logger.error(f"Error adding customer gender dropdown: {e}")

        elif module_name == 'employees':
            try:
                # Status dropdown
                dv_status = DataValidation(type="list", formula1='"active,inactive"', allow_blank=True)
                dv_status.hide_drop_down = None
                dv_status.showInputMessage = True
                dv_status.promptTitle = "Status Selection"
                dv_status.prompt = "Select 'active' or 'inactive'."
                ws.add_data_validation(dv_status)
                status_idx = headers.index('Status') + 1 if 'Status' in headers else len(headers)
                status_col = openpyxl.utils.get_column_letter(status_idx) if hasattr(openpyxl.utils, 'get_column_letter') else chr(64 + status_idx)
                dv_status.add(f"{status_col}2:{status_col}500")

                # Level dropdown
                dv_level = DataValidation(type="list", formula1='"L1,L2,L3"', allow_blank=True)
                dv_level.hide_drop_down = None
                dv_level.showInputMessage = True
                dv_level.promptTitle = "Level Selection"
                dv_level.prompt = "Select 'L1', 'L2', or 'L3'."
                ws.add_data_validation(dv_level)
                level_idx = headers.index('Level') + 1 if 'Level' in headers else 8
                level_col = openpyxl.utils.get_column_letter(level_idx) if hasattr(openpyxl.utils, 'get_column_letter') else 'H'
                dv_level.add(f"{level_col}2:{level_col}500")
            except Exception as e:
                logger.error(f"Error adding employee dropdowns: {e}")

        elif module_name == 'products':
            try:
                dv_status = DataValidation(type="list", formula1='"active,inactive"', allow_blank=True)
                dv_status.hide_drop_down = None
                dv_status.showInputMessage = True
                dv_status.promptTitle = "Status Selection"
                dv_status.prompt = "Select 'active' or 'inactive'."
                dv_status.showErrorMessage = True
                dv_status.errorStyle = "information"
                dv_status.errorTitle = "Status Selection"
                dv_status.error = "Please select either 'active' or 'inactive'."
                ws.add_data_validation(dv_status)
                status_idx = headers.index('Status') + 1 if 'Status' in headers else len(headers)
                status_col = openpyxl.utils.get_column_letter(status_idx) if hasattr(openpyxl.utils, 'get_column_letter') else chr(64 + status_idx)
                dv_status.add(f"{status_col}2:{status_col}500")
            except Exception as e:
                logger.error(f"Error adding status dropdown: {e}")

        # Save to bytes
        file_stream = BytesIO()
        wb.save(file_stream)
        file_stream.seek(0)
        
        return file_stream.getvalue()
    except Exception as e:
        logger.error(f"Error generating Excel template for {module_name}: {str(e)}")
        raise

def get_sample_data(module_name, membership_mode="paid_plan"):
    """Get sample data for the template"""
    if module_name == 'customers':
        return [
            {
                'first_name': 'John',
                'last_name': 'Doe',
                'phone': '9876543210',
                'gender': 'Male',
                'date_of_birth': '1990-01-15',
                'address': '123 Main Street',
                'spot': 'A1'
            }
        ]
    elif module_name == 'employees':
        return [
            {
                'first_name': 'Jane',
                'last_name': 'Smith',
                'phone': '9876543211',
                'role': 'Stylist',
                'username': 'jane@salon.com',
                'password': 'Password@123',
                'specialization': 'Hair Stylist',
                'salary': '25000',
                'target': '100000',
                'level': 'L1',
                'status': 'active',
                'joining_date': '2026-01-01',
                'shift_start_time': '09:00',
                'shift_end_time': '18:00',
                'monthly_offs': '4'
            }
        ]
    elif module_name == 'services':
        sample = {
            'name': 'Haircut',
            'category_name': 'Hair Services',
            'price': '500',
            'status': 'active'
        }
        if membership_mode in ['paid_plan', 'discount_plan']:
            sample['membership_plan_name'] = 'SUPER PLAN'
            sample['membership_discount_percentage'] = '10'
            sample['membership_discount_amount'] = '50'
        return [sample]
    elif module_name == 'products':
        return [
            {
                'name': 'Shampoo',
                'category': 'Hair Care',
                'sku': 'SHM001',
                'barcode': '1234567890123',
                'cost_price': '150',
                'selling_price': '300',
                'mrp': '350',
                'stock_quantity': '50',
                'low_stock_threshold': '10',
                'status': 'active'
            }
        ]
    return []

def parse_excel_file(file_data, module_name):
    """
    Parse uploaded Excel file and return structured data with validation
    Returns: (success, data, errors)
    """
    try:
        import openpyxl
        wb = openpyxl.load_workbook(BytesIO(file_data), data_only=True)
        ws = wb.active
        
        # Get headers from first row
        raw_headers = []
        for cell in ws[1]:
            if cell.value is not None and str(cell.value).strip():
                raw_headers.append(str(cell.value).strip())
        
        if not raw_headers:
            return False, [], "The uploaded Excel sheet is empty or missing a header row."

        field_mapping = FIELD_MAPPINGS.get(module_name, {})
        required = REQUIRED_FIELDS.get(module_name, [])

        def normalize_header(h):
            return str(h).lower().replace('*', '').replace('(optional)', '').replace('_', ' ').replace('-', ' ').strip()

        lookup_map = {}
        for k, v in field_mapping.items():
            lookup_map[normalize_header(k)] = (k, v)

        # Map actual header columns to target field names
        header_to_field = {}
        for h in raw_headers:
            norm = normalize_header(h)
            if norm in lookup_map:
                header_to_field[h] = lookup_map[norm][1]
            else:
                logger.info(f"Header '{h}' in {module_name} upload not in standard mapping, skipping safely.")

        # Check for missing required columns
        for req in required:
            norm_req = normalize_header(req)
            req_field = lookup_map.get(norm_req, (req, req.lower()))[1]
            if req_field not in header_to_field.values():
                return False, [], f"Missing required column: {req}"

        # Pre-calculate column index and field name for fast O(1) extraction
        header_indices = []
        for col_idx, header in enumerate(raw_headers):
            field_name = header_to_field.get(header)
            if field_name:
                header_indices.append((col_idx, field_name))

        # Parse data rows using fast values_only streaming
        data = []
        errors = []

        for row_num, row_cells in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
            if not row_cells:
                continue

            # Check if row is completely empty
            row_prefix = row_cells[:len(raw_headers)]
            if all(v is None or str(v).strip() == "" for v in row_prefix):
                continue

            row_data = {}
            row_errors = []

            for col_idx, field_name in header_indices:
                cell_value = row_cells[col_idx] if col_idx < len(row_cells) else None
                row_data[field_name] = convert_cell_value(cell_value, field_name)
            
            # Validate required fields
            for req in required:
                norm_req = normalize_header(req)
                req_field = lookup_map.get(norm_req, (req, req.lower()))[1]
                if not row_data.get(req_field):
                    row_errors.append(f"{req} is required")
            
            if row_errors:
                errors.append({
                    'row': row_num,
                    'errors': row_errors,
                    'data': row_data
                })
            else:
                data.append(row_data)
        
        return True, data, errors
        
    except Exception as e:
        logger.error(f"Error parsing Excel file: {str(e)}")
        return False, [], f"Error parsing Excel file: {str(e)}"

def convert_cell_value(value, field_name):
    """Convert Excel cell value to appropriate Python type"""
    if value is None:
        return None
    
    # Handle numeric and monetary fields
    if field_name in ['salary', 'price', 'cost_price', 'selling_price', 'mrp', 'commission_percentage', 'membership_discount_percentage', 'membership_discount_amount']:
        try:
            val_str = str(value).strip().replace(',', '')
            return float(val_str) if val_str else 0.0
        except (ValueError, TypeError):
            return 0.0
    elif field_name in ['duration_minutes', 'stock_quantity', 'low_stock_threshold']:
        try:
            val_str = str(value).strip().replace(',', '')
            return int(float(val_str)) if val_str else 0
        except (ValueError, TypeError):
            return 0
    elif field_name == 'phone':
        if isinstance(value, float):
            return str(int(value))
        elif isinstance(value, int):
            return str(value)
        val_str = str(value).strip() if value is not None else ""
        if val_str.endswith('.0') and val_str[:-2].replace('.', '').isdigit():
            val_str = val_str[:-2]
        return val_str if val_str and val_str.lower() not in ['none', 'null', 'nan'] else None
    elif field_name in ['date_of_birth', 'joining_date']:
        if isinstance(value, datetime):
            return value.strftime('%Y-%m-%d')
        val_str = str(value).strip()
        if not val_str or val_str.lower() in ['none', 'null', 'nan', 'na', '']:
            return None
        # Try parsing various common date formats
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y', '%Y/%m/%d', '%d.%m.%Y', '%Y.%m.%d'):
            try:
                return datetime.strptime(val_str, fmt).strftime('%Y-%m-%d')
            except ValueError:
                pass
        return val_str
    else:
        val_str = str(value).strip() if value is not None else ""
        return val_str if val_str and val_str.lower() not in ['none', 'null', 'nan'] else None

def validate_customer_data(row_data, tenant_id, branch_id=None, existing_phones=None, seen_file_phones=None):
    """Validate customer data according to existing rules"""
    from app.models.customer import Customer
    from app.database import db
    from flask import g
    
    errors = []
    
    # Validate required fields
    if not row_data.get('first_name'):
        errors.append("First Name is required")
    if not row_data.get('phone'):
        errors.append("Phone Number is required")
    
    # Validate phone format
    phone = str(row_data.get('phone', '') or '').strip()
    if phone and len(phone) < 10:
        errors.append("Phone Number must be at least 10 digits")
    
    # Validate email format if provided (optional)
    email = row_data.get('email')
    if email and '@' not in str(email):
        errors.append("Invalid Email format")
    
    # Validate date format if provided (optional)
    dob = row_data.get('date_of_birth')
    if dob:
        try:
            datetime.strptime(str(dob), '%Y-%m-%d')
        except ValueError:
            errors.append("Date of Birth must be in YYYY-MM-DD or DD-MM-YYYY format")
    
    # Check for duplicate phone in tenant context
    if phone:
        if existing_phones is not None:
            if phone in existing_phones:
                errors.append(f"Customer with phone {phone} already exists")
            elif seen_file_phones is not None:
                if phone in seen_file_phones:
                    errors.append(f"Duplicate phone {phone} found in uploaded file")
                else:
                    seen_file_phones.add(phone)
        else:
            from app.utils.auth import get_tenant_query
            try:
                query = get_tenant_query(Customer).filter_by(phone=phone)
                if branch_id:
                    query = query.filter_by(branch_id=branch_id)
                existing = query.first()
                if existing:
                    errors.append(f"Customer with phone {phone} already exists")
            except Exception as e:
                logger.warning(f"Customer duplicate check notice: {e}")
    
    return errors

def validate_employee_data(row_data, tenant_id, branch_id=None, existing_phones=None, seen_file_phones=None):
    """Validate employee data according to existing rules"""
    from app.models.employee import Employee
    from app.database import db
    
    errors = []
    
    # Validate required fields
    if not row_data.get('first_name'):
        errors.append("First Name is required")
    if not row_data.get('phone'):
        errors.append("Phone Number is required")
    
    # Validate phone format
    phone = str(row_data.get('phone', '') or '').strip()
    if phone and len(phone) < 10:
        errors.append("Phone Number must be at least 10 digits")
    
    # Validate salary if provided
    salary = row_data.get('salary', 0)
    if salary is not None and str(salary).strip() != "":
        try:
            salary_val = float(salary)
            if salary_val < 0:
                errors.append("Salary must be >= 0")
        except (ValueError, TypeError):
            errors.append("Invalid Salary value")
    
    # Validate target if provided
    target = row_data.get('target')
    if target is not None and str(target).strip() != "":
        try:
            target_val = float(target)
            if target_val < 0:
                errors.append("Target must be >= 0")
        except (ValueError, TypeError):
            errors.append("Invalid Target value")
    
    # Validate level if provided
    level = row_data.get('level')
    if level and str(level).strip().upper() not in ['L1', 'L2', 'L3']:
        errors.append("Level must be 'L1', 'L2', or 'L3'")
    
    # Validate monthly offs if provided
    monthly_offs = row_data.get('monthly_offs')
    if monthly_offs is not None and str(monthly_offs).strip() != "":
        try:
            offs_val = int(monthly_offs)
            if offs_val < 0 or offs_val > 31:
                errors.append("Monthly Paid Offs must be between 0 and 31")
        except (ValueError, TypeError):
            errors.append("Invalid Monthly Paid Offs value")
    
    # Validate joining date if provided
    joining_date = row_data.get('joining_date')
    if joining_date:
        try:
            datetime.strptime(str(joining_date)[:10], '%Y-%m-%d')
        except ValueError:
            errors.append("Joining Date must be in YYYY-MM-DD format")
    
    # Check for duplicate phone in tenant/branch context
    if phone:
        if existing_phones is not None:
            if phone in existing_phones:
                errors.append(f"Employee with phone {phone} already exists")
            elif seen_file_phones is not None:
                if phone in seen_file_phones:
                    errors.append(f"Duplicate phone {phone} found in uploaded file")
                else:
                    seen_file_phones.add(phone)
        else:
            from app.utils.auth import get_tenant_query
            try:
                query = get_tenant_query(Employee).filter_by(phone=phone)
                if branch_id:
                    query = query.filter_by(branch_id=branch_id)
                existing = query.first()
                if existing:
                    errors.append(f"Employee with phone {phone} already exists")
            except Exception as e:
                logger.warning(f"Employee duplicate check notice: {e}")
    
    return errors

def validate_service_data(row_data, tenant_id):
    """Validate service data according to Add New Service form fields"""
    from app.models.catalog import Service, ServiceCategory
    from app.database import db
    from sqlalchemy import func
    
    errors = []
    
    # Validate required fields matching Add New Service popup
    if not row_data.get('name'):
        errors.append("Service Name is required")
    if not row_data.get('category_name'):
        errors.append("Category Name is required")
    if row_data.get('price') is None:
        errors.append("Price is required")
    
    # Validate price
    price = row_data.get('price', 0)
    try:
        price_val = float(price)
        if price_val < 0:
            errors.append("Price must be >= 0")
    except (ValueError, TypeError):
        errors.append("Invalid Price value")
    
    # Set default duration if not specified
    if not row_data.get('duration_minutes'):
        row_data['duration_minutes'] = 30

    # Set default status if not specified
    if not row_data.get('status'):
        row_data['status'] = 'active'
    else:
        st = str(row_data['status']).strip().lower()
        row_data['status'] = 'active' if st in ['active', '1', 'true', 'yes'] else 'inactive'
    
    # Validate or auto-create category in tenant context
    category_name = str(row_data.get('category_name', '')).strip()
    if category_name:
        category = ServiceCategory.query.filter_by(tenant_id=tenant_id, is_deleted=False).filter(
            func.lower(ServiceCategory.name) == func.lower(category_name)
        ).first()
        if category:
            row_data['category_id'] = category.id
        else:
            try:
                new_cat = ServiceCategory(tenant_id=tenant_id, name=category_name)
                db.session.add(new_cat)
                db.session.flush()
                row_data['category_id'] = new_cat.id
            except Exception as e:
                errors.append(f"Category '{category_name}' could not be created: {str(e)}")
    
    # Check for duplicate service name in tenant context
    service_name = str(row_data.get('name', '')).strip()
    if service_name:
        existing = Service.query.filter_by(tenant_id=tenant_id, is_deleted=False).filter(
            func.lower(Service.name) == func.lower(service_name)
        ).first()
        if existing:
            errors.append(f"Service '{service_name}' already exists")
    
    return errors

def validate_product_data(row_data, tenant_id):
    """Validate product data according to existing rules"""
    from app.models.catalog import Product
    from app.database import db
    
    errors = []
    
    # Validate required fields
    if not row_data.get('name'):
        errors.append("Product Name is required")
    if row_data.get('cost_price') is None:
        errors.append("Cost Price is required")
    if row_data.get('selling_price') is None:
        errors.append("Selling Price is required")
    if row_data.get('mrp') is None:
        errors.append("MRP is required")
    if row_data.get('stock_quantity') is None:
        errors.append("Stock Quantity is required")
    
    # Validate prices
    for price_field in ['cost_price', 'selling_price', 'mrp']:
        price = row_data.get(price_field, 0)
        try:
            price_val = float(price)
            if price_val < 0:
                errors.append(f"{price_field.replace('_', ' ').title()} must be >= 0")
        except (ValueError, TypeError):
            errors.append(f"Invalid {price_field.replace('_', ' ').title()} value")
    
    # Validate stock
    stock = row_data.get('stock_quantity', 0)
    try:
        stock_val = int(stock)
        if stock_val < 0:
            errors.append("Stock Quantity must be >= 0")
    except (ValueError, TypeError):
        errors.append("Invalid Stock Quantity value")
    
    # Validate low stock threshold if provided
    threshold = row_data.get('low_stock_threshold')
    if threshold is not None:
        try:
            thresh_val = int(threshold)
            if thresh_val < 0:
                errors.append("Low Stock Threshold must be >= 0")
        except (ValueError, TypeError):
            errors.append("Invalid Low Stock Threshold value")
    
    # Check for duplicate SKU in tenant context
    sku = row_data.get('sku')
    if sku:
        existing = Product.query.filter_by(tenant_id=tenant_id, sku=sku).first()
        if existing:
            errors.append(f"Product with SKU '{sku}' already exists")
    
    # Check for duplicate barcode in tenant context
    barcode = row_data.get('barcode')
    if barcode:
        existing = Product.query.filter_by(tenant_id=tenant_id, barcode=barcode).first()
        if existing:
            errors.append(f"Product with Barcode '{barcode}' already exists")
    
    return errors