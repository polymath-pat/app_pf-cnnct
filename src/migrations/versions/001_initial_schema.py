"""Initial schema: users and webhook_events

Revision ID: 001_initial
Revises:
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create users table
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email')
    )

    # Create webhook_events table
    op.create_table('webhook_events',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('source_ip', sa.String(length=45), nullable=False),
        sa.Column('dns_target', sa.String(length=255), nullable=False),
        sa.Column('dns_records', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('dns_error', sa.Text(), nullable=True),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('idx_webhook_events_timestamp', 'webhook_events', [sa.text('timestamp DESC')], unique=False)
    op.create_index('idx_webhook_events_user_id', 'webhook_events', ['user_id'], unique=False)


def downgrade():
    op.drop_index('idx_webhook_events_user_id', table_name='webhook_events')
    op.drop_index('idx_webhook_events_timestamp', table_name='webhook_events')
    op.drop_table('webhook_events')
    op.drop_table('users')
