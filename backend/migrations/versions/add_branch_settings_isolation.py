"""add branch settings isolation

Revision ID: add_branch_settings_isolation
Revises: 
Create Date: 2026-08-12 21:57:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_branch_settings_isolation'
down_revision = 'add_branch_management'
branch_labels = None
depends_on = None

def upgrade():
    # Add branch_id column to tenant_settings table (simple approach)
    op.add_column('tenant_settings', sa.Column('branch_id', sa.Integer(), nullable=True))
    op.create_index('ix_tenant_settings_branch_id', 'tenant_settings', ['branch_id'])
    op.create_foreign_key('fk_tenant_settings_branch_id', 'tenant_settings', 'branches', ['branch_id'], ['id'])

def downgrade():
    # Remove branch_id column from tenant_settings table
    op.drop_constraint('fk_tenant_settings_branch_id', 'tenant_settings', type_='foreignkey')
    op.drop_index('ix_tenant_settings_branch_id', 'tenant_settings')
    op.drop_column('tenant_settings', 'branch_id')
