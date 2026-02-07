"""SQLAlchemy models for CNNCT webhook storage."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import create_engine, Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

Base = declarative_base()


class User(Base):
    """User model for future multi-user support."""
    __tablename__ = 'users'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    webhook_events = relationship("WebhookEvent", back_populates="user")


class WebhookEvent(Base):
    """Stores incoming webhook events with DNS lookup results."""
    __tablename__ = 'webhook_events'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    event_type = Column(String(100), nullable=False)
    source_ip = Column(String(45), nullable=False)
    dns_target = Column(String(255), nullable=False)
    dns_records = Column(JSONB, default=list)
    dns_error = Column(Text, nullable=True)
    payload = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="webhook_events")

    __table_args__ = (
        Index('idx_webhook_events_timestamp', timestamp.desc()),
        Index('idx_webhook_events_user_id', user_id),
    )


def get_engine(database_url: str):
    """Create a SQLAlchemy engine with connection pooling."""
    return create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10
    )


def get_session_factory(engine):
    """Create a session factory bound to the engine."""
    return sessionmaker(bind=engine)
