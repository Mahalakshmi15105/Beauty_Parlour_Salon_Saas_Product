"""add branch logo

Revision ID: add_branch_logo
Revises: add_branch_settings_isolation
Create Date: 2026-08-12 22:05:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_branch_logo'
down_revision = 'add_branch_settings_isolation'
branch_labels = None
depends_on = None

def upgrade():
    # Add logo_url column to branches table
    op.add_column('branches', sa.Column('logo_url', sa.String(255), nullable=True))

def downgrade():
    # Remove logo_url column from branches table
    op.drop_column('branches', 'logo_url')
