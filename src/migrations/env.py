import logging
from logging.config import fileConfig

from flask import current_app

from alembic import context

from models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name:
    fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# Target metadata for 'autogenerate' support
target_metadata = Base.metadata


def get_engine():
    try:
        # Flask-Migrate stores the engine in app extensions
        return current_app.extensions['migrate'].db
    except (TypeError, AttributeError, KeyError):
        return None


def get_engine_url():
    try:
        engine = get_engine()
        if engine:
            return engine.url.render_as_string(hide_password=False).replace('%', '%%')
    except AttributeError:
        pass
    return None


def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""

    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')

    connectable = get_engine()

    if connectable is None:
        import os
        from sqlalchemy import create_engine
        database_url = os.environ.get("DATABASE_URL", "")
        if database_url:
            connectable = create_engine(database_url)
        else:
            raise RuntimeError("No database connection available")

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            process_revision_directives=process_revision_directives,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
