from app import create_app
from app.models.employee import Employee
from app.models.branch import Branch
from app.models.global_models import Tenant

app = create_app()
with app.app_context():
    print("=== AUDITING EXISTING EMPLOYEES WITH branch_id IS NULL ===")
    employees = Employee.query.filter_by(branch_id=None, is_deleted=False).all()
    print(f"Total employees with branch_id = NULL: {len(employees)}")
    for emp in employees:
        tenant = Tenant.query.get(emp.tenant_id)
        branches = Branch.query.filter_by(tenant_id=emp.tenant_id, is_deleted=False).all()
        t_name = tenant.name if tenant else "Unknown"
        b_count = len(branches)
        last_name = emp.last_name or ""
        print(f"Employee ID: {emp.id:<4} | Name: {emp.first_name} {last_name:<15} | Tenant ID: {emp.tenant_id} ({t_name}) | Total Branches for Tenant: {b_count}")
