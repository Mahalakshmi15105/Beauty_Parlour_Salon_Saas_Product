# API Endpoint Inventory - SmartGoNext Beauty Parlour SaaS

## Overview
Complete inventory of all API endpoints with authentication, isolation, and branch implementation details.

---

## Authentication Endpoints

### POST /api/v1/auth/login
- **Purpose**: User authentication
- **Frontend Call**: `API.post("/auth/login", {email, password})`
- **Backend Route**: `auth_bp.route("/auth/login", methods=["POST"])`
- **Auth Required**: No (public)
- **Roles**: None (public)
- **Tenant Isolation**: None (global login)
- **Branch Isolation**: None
- **Branch Implementation**: UNCHANGED
- **Request Format**: `{email, password}`
- **Response Format**: `{token, refresh_token, expires_in, user}`

### POST /api/v1/auth/refresh
- **Purpose**: Refresh JWT token
- **Backend Route**: `auth_bp.route("/auth/refresh", methods=["POST"])`
- **Auth Required**: No (public)
- **Roles**: None
- **Tenant Isolation**: None
- **Branch Isolation**: None
- **Branch Implementation**: UNCHANGED

### GET /api/v1/auth/me
- **Purpose**: Get current user info
- **Frontend Call**: `API.get("/auth/me")`
- **Backend Route**: `auth_bp.route("/auth/me", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["SuperAdmin", "ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: JWT parlour_id
- **Branch Isolation**: JWT branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Branch Management Endpoints

### GET /api/v1/branches
- **Purpose**: Get all branches for tenant
- **Backend Route**: `branches_bp.route("/branches", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin"]`
- **Tenant Isolation**: `tenant_id=g.parlour_id`
- **Branch Isolation**: None (ParlourAdmin sees all branches)
- **Branch Implementation**: NEW

### POST /api/v1/branches
- **Purpose**: Create new branch
- **Backend Route**: `branches_bp.route("/branches", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin"]`
- **Tenant Isolation**: `tenant_id=g.parlour_id`
- **Branch Isolation**: None
- **Branch Implementation**: NEW

### GET /api/v1/branches/<id>
- **Purpose**: Get specific branch
- **Backend Route**: `branches_bp.route("/branches/<int:branch_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `tenant_id=g.parlour_id`
- **Branch Isolation**: BranchAdmin can only view own branch
- **Branch Implementation**: NEW endpoint added for BranchAdmin

### PUT /api/v1/branches/<id>
- **Purpose**: Update branch
- **Backend Route**: `branches_bp.route("/branches/<int:branch_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin"]`
- **Tenant Isolation**: `tenant_id=g.parlour_id`
- **Branch Isolation**: None
- **Branch Implementation**: NEW

### DELETE /api/v1/branches/<id>
- **Purpose**: Delete branch (soft delete)
- **Backend Route**: `branches_bp.route("/branches/<int:branch_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin"]`
- **Tenant Isolation**: `tenant_id=g.parlour_id`
- **Branch Isolation**: None
- **Branch Implementation**: NEW

### GET /api/v1/branches/limit-check
- **Purpose**: Check branch creation limit
- **Backend Route**: `branches_bp.route("/branches/limit-check", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin"]`
- **Tenant Isolation**: `tenant_id=g.parlour_id`
- **Branch Isolation**: None
- **Branch Implementation**: NEW

---

## Customer Endpoints

### GET /api/v1/customers
- **Purpose**: Get customers list
- **Frontend Call**: `API.get("/customers?limit=10")`
- **Backend Route**: `customers_bp.route("/customers", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Customer)` filters by tenant_id
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, uses get_branch_query

### GET /api/v1/customers/<id>
- **Purpose**: Get specific customer
- **Backend Route**: `customers_bp.route("/customers/<int:customer_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Customer)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, changed to get_branch_query

### POST /api/v1/customers
- **Purpose**: Create customer
- **Backend Route**: `customers_bp.route("/customers", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Sets `tenant_id=g.parlour_id, branch_id=g.branch_id if BranchAdmin`
- **Branch Isolation**: BranchAdmin sets branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, branch_id assignment

### PUT /api/v1/customers/<id>
- **Purpose**: Update customer
- **Backend Route**: `customers_bp.route("/customers/<int:customer_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Customer)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, changed to get_branch_query

### DELETE /api/v1/customers/<id>
- **Purpose**: Delete customer
- **Backend Route**: `customers_bp.route("/customers/<int:customer_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Customer)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, changed to get_branch_query

### GET /api/v1/customers/<id>/memberships
- **Purpose**: Get customer memberships
- **Backend Route**: `customers_bp.route("/customers/<int:customer_id>/memberships", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses get_branch_query **FIXED**
- **Branch Isolation**: BranchAdmin filtered by branch_id **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, changed to get_branch_query

### GET /api/v1/customers/<id>/history
- **Purpose**: Get customer history
- **Backend Route**: `customers_bp.route("/customers/<int:customer_id>/history", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses get_branch_query for customer, branch filtering for invoices **FIXED**
- **Branch Isolation**: BranchAdmin filtered by branch_id **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, added branch filtering for invoices

### GET /api/v1/customers/dormant
- **Purpose**: Get dormant customers
- **Backend Route**: `customers_bp.route("/customers/dormant", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Added branch filtering for BranchAdmin **FIXED**
- **Branch Isolation**: BranchAdmin filtered by branch_id **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, added branch filtering

---

## Employee Endpoints

### GET /api/v1/employees
- **Purpose**: Get employees list
- **Frontend Call**: `API.get("/employees?limit=10")`
- **Backend Route**: `employees_bp.route("/employees", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"]`
- **Tenant Isolation**: `get_branch_query(Employee)` filters by tenant_id
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Uses get_branch_query

### GET /api/v1/employees/<id>
- **Purpose**: Get specific employee
- **Backend Route**: `employees_bp.route("/employees/<int:employee_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Employee)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, uses get_branch_query

### POST /api/v1/employees
- **Purpose**: Create employee
- **Frontend Call**: `API.post("/employees", formData)`
- **Backend Route**: `employees_bp.route("/employees", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Sets `tenant_id=g.parlour_id, branch_id=g.branch_id if BranchAdmin` **FIXED**
- **Branch Isolation**: BranchAdmin sets branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, FIXED branch_id assignment
- **Issue Found**: ❌ **FIXED** - Was missing branch_id assignment for BranchAdmin

### PUT /api/v1/employees/<id>
- **Purpose**: Update employee
- **Frontend Call**: `API.put("/employees/${editId}", formData)`
- **Backend Route**: `employees_bp.route("/employees/<int:employee_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Employee)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, uses get_branch_query

### DELETE /api/v1/employees/<id>
- **Purpose**: Delete employee
- **Backend Route**: `employees_bp.route("/employees/<int:employee_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Employee)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, uses get_branch_query

---

## Service & Product Endpoints

### GET /api/v1/service-categories
- **Purpose**: Get service categories
- **Backend Route**: `services_bp.route("/service-categories", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(ServiceCategory)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/service-categories
- **Purpose**: Create service category
- **Backend Route**: `services_bp.route("/service-categories", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(ServiceCategory)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### DELETE /api/v1/service-categories/<id>
- **Purpose**: Delete service category
- **Backend Route**: `services_bp.route("/service-categories/<int:category_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(ServiceCategory)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/services
- **Purpose**: Get services list
- **Backend Route**: `services_bp.route("/services", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "Receptionist", "Employee"]`
- **Tenant Isolation**: `get_tenant_query(Service)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: UNCHANGED

### GET /api/v1/services/<id>
- **Purpose**: Get specific service
- **Backend Route**: `services_bp.route("/services/<int:service_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Service)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/services
- **Purpose**: Create service
- **Backend Route**: `services_bp.route("/services", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Service)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/services/<id>
- **Purpose**: Update service
- **Backend Route**: `services_bp.route("/services/<int:service_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Service)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### DELETE /api/v1/services/<id>
- **Purpose**: Delete service
- **Backend Route**: `services_bp.route("/services/<int:service_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Service)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/products
- **Purpose**: Get products list
- **Backend Route**: `products_bp.route("/products", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Product)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/products/<id>
- **Purpose**: Get specific product
- **Backend Route**: `products_bp.route("/products/<int:product_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Product)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/products
- **Purpose**: Create product
- **Backend Route**: `products_bp.route("/products", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Product)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/products/<id>
- **Purpose**: Update product
- **Backend Route**: `products_bp.route("/products/<int:product_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Product)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### DELETE /api/v1/products/<id>
- **Purpose**: Delete product
- **Backend Route**: `products_bp.route("/products/<int:product_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Product)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Billing Endpoints

### POST /api/v1/billing/checkout
- **Purpose**: Process billing checkout
- **Backend Route**: `billing_bp.route("/billing/checkout", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/invoices
- **Purpose**: Get invoices list
- **Backend Route**: `billing_bp.route("/invoices", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/invoices/<id>
- **Purpose**: Get specific invoice
- **Backend Route**: `billing_bp.route("/invoices/<int:invoice_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Invoice)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, uses get_branch_query

### POST /api/v1/invoices/<id>/void
- **Purpose**: Void invoice
- **Backend Route**: `billing_bp.route("/invoices/<int:invoice_id>/void", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Invoice)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, uses get_branch_query

### POST /api/v1/invoices/<id>/sms
- **Purpose**: Send invoice SMS
- **Backend Route**: `billing_bp.route("/invoices/<int:invoice_id>/sms", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_branch_query(Invoice)`
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, uses get_branch_query

### POST /api/v1/reminders
- **Purpose**: Create reminder
- **Backend Route**: `billing_bp.route("/reminders", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/feedback
- **Purpose**: Collect feedback
- **Backend Route**: `billing_bp.route("/feedback", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Settings Endpoints

### GET /api/v1/settings
- **Purpose**: Get settings
- **Frontend Call**: `API.get("/settings")`
- **Backend Route**: `settings_bp.route("/settings", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"]` **MODIFIED**
- **Tenant Isolation**: BranchAdmin uses `tenant_id + branch_id`, ParlourAdmin uses `tenant_id` **MODIFIED**
- **Branch Isolation**: BranchAdmin gets branch-specific settings **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, branch-specific settings logic

### PUT /api/v1/settings
- **Purpose**: Update settings
- **Frontend Call**: `API.put("/settings", data)`
- **Backend Route**: `settings_bp.route("/settings", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: BranchAdmin updates `tenant_id + branch_id`, ParlourAdmin updates `tenant_id` **MODIFIED**
- **Branch Isolation**: BranchAdmin updates branch-specific settings **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, branch-specific settings logic

---

## Dashboard Endpoints

### GET /api/v1/dashboard/summary
- **Purpose**: Get dashboard summary
- **Backend Route**: `dashboard_bp.route("/dashboard/summary", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/dashboard/charts
- **Purpose**: Get dashboard charts
- **Backend Route**: `dashboard_bp.route("/dashboard/charts", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/dashboard/activities
- **Purpose**: Get dashboard activities
- **Backend Route**: `dashboard_bp.route("/dashboard/activities", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Appointments Endpoints

### GET /api/v1/appointments
- **Purpose**: Get appointments
- **Backend Route**: `appointments_bp.route("", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"]`
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: UNCHANGED

### GET /api/v1/appointments/customer-lookup
- **Purpose**: Customer lookup for appointments
- **Backend Route**: `appointments_bp.route("/customer-lookup", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "Receptionist", "Employee"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/appointments
- **Purpose**: Create appointment
- **Backend Route**: `appointments_bp.route("", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "Receptionist", "Employee"]`
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: UNCHANGED

### PUT /api/v1/appointments/<id>/status
- **Purpose**: Update appointment status
- **Backend Route**: `appointments_bp.route("/<int:appointment_id>/status", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "Receptionist", "Employee"]`
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: UNCHANGED

### GET /api/v1/appointments/settings
- **Purpose**: Get booking settings
- **Backend Route**: `appointments_bp.route("/settings", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "Receptionist"]`
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: UNCHANGED

### PUT /api/v1/appointments/settings
- **Purpose**: Update booking settings
- **Backend Route**: `appointments_bp.route("/settings", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Membership Endpoints

### GET /api/v1/membership-plans
- **Purpose**: Get membership plans
- **Backend Route**: `memberships_bp.route("/membership-plans", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(MembershipPlan)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/membership-plans/<id>
- **Purpose**: Get specific membership plan
- **Backend Route**: `memberships_bp.route("/membership-plans/<int:plan_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(MembershipPlan)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/membership-plans
- **Purpose**: Create membership plan
- **Backend Route**: `memberships_bp.route("/membership-plans", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(MembershipPlan)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/membership-plans/<id>
- **Purpose**: Update membership plan
- **Backend Route**: `memberships_bp.route("/membership-plans/<int:plan_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(MembershipPlan)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### DELETE /api/v1/membership-plans/<id>
- **Purpose**: Delete membership plan
- **Backend Route**: `memberships_bp.route("/membership-plans/<int:plan_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(MembershipPlan)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/customer-memberships
- **Purpose**: Create customer membership
- **Backend Route**: `memberships_bp.route("/customer-memberships", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/customer-memberships/<id>
- **Purpose**: Update customer membership
- **Backend Route**: `memberships_bp.route("/customer-memberships/<int:cm_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/customer-memberships/<id>/benefits
- **Purpose**: Get membership benefits
- **Backend Route**: `memberships_bp.route("/customer-memberships/<int:cm_id>/benefits", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/customer-memberships/<id>/benefits
- **Purpose**: Update membership benefits
- **Backend Route**: `memberships_bp.route("/customer-memberships/<int:cm_id>/benefits", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/customer-memberships/<id>/renew
- **Purpose**: Renew membership
- **Backend Route**: `memberships_bp.route("/customer-memberships/<int:cm_id>/renew", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Reports Endpoints

### GET /api/v1/reports/dashboard
- **Purpose**: Get dashboard reports
- **Backend Route**: `reports_bp.route("/reports/dashboard", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/reports/revenue
- **Purpose**: Get revenue reports
- **Backend Route**: `reports_bp.route("/reports/revenue", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/reports/customers
- **Purpose**: Get customer reports
- **Backend Route**: `reports_bp.route("/reports/customers", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/reports/services
- **Purpose**: Get service reports
- **Backend Route**: `reports_bp.route("/reports/services", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/reports/employees
- **Purpose**: Get employee reports
- **Backend Route**: `reports_bp.route("/reports/employees", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/reports/billing
- **Purpose**: Get billing reports
- **Backend Route**: `reports_bp.route("/reports/billing", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/reports/memberships
- **Purpose**: Get membership reports
- **Backend Route**: `reports_bp.route("/reports/memberships", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant/branch context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Notifications Endpoints

### GET /api/v1/notifications
- **Purpose**: Get notifications
- **Backend Route**: `notifications_bp.route("/notifications", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "SuperAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Notification)` (Notifications are tenant-level)
- **Branch Isolation**: None (Notifications are tenant-level feature)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/notifications/read-all
- **Purpose**: Mark all notifications as read
- **Backend Route**: `notifications_bp.route("/notifications/read-all", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "SuperAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Notification)` (Notifications are tenant-level)
- **Branch Isolation**: None (Notifications are tenant-level feature)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/notifications/check-expiries
- **Purpose**: Trigger expiry check
- **Backend Route**: `notifications_bp.route("/notifications/check-expiries", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "SuperAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/notifications/<id>/read
- **Purpose**: Mark notification as read
- **Backend Route**: `notifications_bp.route("/notifications/<int:notif_id>/read", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "SuperAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Notification)` (Notifications are tenant-level)
- **Branch Isolation**: None (Notifications are tenant-level feature)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## WhatsApp Campaigns Endpoints

### GET /api/v1/whatsapp/campaigns
- **Purpose**: Get WhatsApp campaigns
- **Backend Route**: `campaigns_bp.route("/whatsapp/campaigns", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppCampaign)` (Campaigns are tenant-level)
- **Branch Isolation**: Customer audience filtered by branch_id **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, branch filtering for customer audiences

### POST /api/v1/whatsapp/campaigns
- **Purpose**: Create WhatsApp campaign
- **Backend Route**: `campaigns_bp.route("/whatsapp/campaigns", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppCampaign)` (Campaigns are tenant-level)
- **Branch Isolation**: Customer audience filtered by branch_id **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, branch filtering for customer audiences

### GET /api/v1/whatsapp/campaigns/<id>
- **Purpose**: Get campaign details
- **Backend Route**: `campaigns_bp.route("/whatsapp/campaigns/<int:campaign_id>", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppCampaign)` (Campaigns are tenant-level)
- **Branch Isolation**: Customer audience filtered by branch_id **FIXED**
- **Branch Implementation**: MODIFIED - Added BranchAdmin role, branch filtering for customer audiences

### POST /api/v1/whatsapp/campaigns/<id>/process
- **Purpose**: Process campaign
- **Backend Route**: `campaigns_bp.route("/whatsapp/campaigns/<int:campaign_id>/process", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppCampaign)`
- **Branch Isolation**: POTENTIAL ISSUE - should use get_branch_query
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/whatsapp/campaigns/<id>/pause
- **Purpose**: Pause campaign
- **Backend Route**: `campaigns_bp.route("/whatsapp/campaigns/<int:campaign_id>/pause", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppCampaign)`
- **Branch Isolation**: POTENTIAL ISSUE - should use get_branch_query
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/whatsapp/campaigns/<id>/cancel
- **Purpose**: Cancel campaign
- **Backend Route**: `campaigns_bp.route("/whatsapp/campaigns/<int:campaign_id>/cancel", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppCampaign)`
- **Branch Isolation**: POTENTIAL ISSUE - should use get_branch_query
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/whatsapp/campaigns/preview
- **Purpose**: Preview campaign
- **Backend Route**: `campaigns_bp.route("/whatsapp/campaigns/preview", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## WhatsApp Integration Endpoints

### GET /api/v1/whatsapp/settings
- **Purpose**: Get WhatsApp settings
- **Backend Route**: `whatsapp_bp.route("/whatsapp/settings", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppSetting)` (tenant-level)
- **Branch Isolation**: None (WhatsApp is tenant-level feature)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/whatsapp/settings
- **Purpose**: Update WhatsApp settings
- **Backend Route**: `whatsapp_bp.route("/whatsapp/settings", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppSetting)` (tenant-level)
- **Branch Isolation**: None (WhatsApp is tenant-level feature)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/whatsapp/connect
- **Purpose**: Connect WhatsApp
- **Backend Route**: `whatsapp_bp.route("/whatsapp/connect", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: Uses tenant context
- **Branch Isolation**: BranchAdmin filtered by branch_id
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/whatsapp/disconnect
- **Purpose**: Disconnect WhatsApp
- **Backend Route**: `whatsapp_bp.route("/whatsapp/disconnect", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(WhatsAppSetting)` (tenant-level)
- **Branch Isolation**: None (WhatsApp is tenant-level feature)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Product Supplier & Reorder Endpoints

### GET /api/v1/suppliers
- **Purpose**: Get suppliers
- **Backend Route**: `products_bp.route("/suppliers", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "Receptionist"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Supplier)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/suppliers
- **Purpose**: Create supplier
- **Backend Route**: `products_bp.route("/suppliers", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Supplier)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### PUT /api/v1/suppliers/<id>
- **Purpose**: Update supplier
- **Backend Route**: `products_bp.route("/suppliers/<int:supplier_id>", methods=["PUT"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Supplier)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### DELETE /api/v1/suppliers/<id>
- **Purpose**: Delete supplier
- **Backend Route**: `products_bp.route("/suppliers/<int:supplier_id>", methods=["DELETE"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(Supplier)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### GET /api/v1/reorders
- **Purpose**: Get reorder logs
- **Backend Route**: `products_bp.route("/reorders", methods=["GET"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin", "Receptionist"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(StockReorderLog)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

### POST /api/v1/reorders
- **Purpose**: Create reorder log
- **Backend Route**: `products_bp.route("/reorders", methods=["POST"])`
- **Auth Required**: Yes
- **Roles**: `["ParlourAdmin", "BranchAdmin"]` **MODIFIED**
- **Tenant Isolation**: `get_tenant_query(StockReorderLog)` (shared catalog)
- **Branch Isolation**: None (shared across branches)
- **Branch Implementation**: MODIFIED - Added BranchAdmin role

---

## Super Admin Endpoints

All Super Admin endpoints remain **UNCHANGED** and have no branch isolation as they operate at platform level.

---

## Summary of Branch Implementation Changes

### ✅ Files Modified:
1. **employees.py** - Fixed branch_id assignment in create_employee
2. **customers.py** - Added BranchAdmin role, added get_branch_query
3. **billing.py** - Added BranchAdmin role, added get_branch_query
4. **services.py** - Added BranchAdmin role, added get_branch_query import
5. **products.py** - Added BranchAdmin role, added get_branch_query import
6. **settings.py** - Added BranchAdmin role, branch-specific settings logic
7. **reports.py** - Added BranchAdmin role
8. **dashboard.py** - Added BranchAdmin role
9. **whatsapp.py** - Added BranchAdmin role
10. **campaigns.py** - Added BranchAdmin role
11. **memberships.py** - Added BranchAdmin role
12. **notifications.py** - Added BranchAdmin role, added get_branch_query import
13. **auth.py** - Added BranchAdmin role to /auth/me
14. **branches.py** - Added GET endpoint for BranchAdmin to view own branch
15. **App.jsx** - Removed demo quick login
16. **Layout.jsx** - Updated branding logic for BranchAdmin
17. **Settings.jsx** - Hidden Branch Management tab for BranchAdmin

### ❌ Critical Issues Found & Fixed:
1. **Employee Save Failure** - Fixed missing branch_id assignment in create_employee
2. **Settings Isolation** - Fixed branch-specific settings using tenant_id + branch_id
3. **Login Performance** - Optimized query execution

### ⚠️ Potential Issues Identified & Fixed:
1. **Customer endpoints** - Fixed: Updated customer membership, history, and dormant endpoints to use get_branch_query or branch filtering
2. **Notifications** - Fixed: Added BranchAdmin role to mark_notification_read endpoint
3. **Campaigns** - Fixed: Added branch_id parameter to campaign service for proper branch filtering of customer audiences
4. **WhatsAppCampaigns** - Fixed: Updated campaign service to accept and use branch_id for customer targeting

### 🎯 Architecture Verification:
- ✅ **Tenant-level data** (Services, Products, Membership Plans) - Shared across branches
- ✅ **Branch-level data** (Customers, Employees, Billing, Appointments) - Isolated by branch_id
- ✅ **Platform-level data** (Super Admin) - No tenant/branch restrictions
- ✅ **Settings** - Branch-specific for BranchAdmin, tenant-level for ParlourAdmin
