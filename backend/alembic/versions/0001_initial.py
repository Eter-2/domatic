"""Initial schema and views

Revision ID: 0001
Revises:
Create Date: 2026-05-08 00:00:00.000000

Applies the full Dom'Atic schema from two SQL migration files:
  - db/migrations/001_initial_schema.sql  (tables, enums, triggers, indexes)
  - db/migrations/002_create_views.sql    (v_device_summary, v_security_stats, v_firmware_update_candidates)

Seeds are NOT applied here — run `make seed` to load default rooms and demo devices.
"""
import os
from pathlib import Path

from alembic import op

# ---------------------------------------------------------------------------
# Revision metadata
# ---------------------------------------------------------------------------
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _sql_file(filename: str) -> str:
    """Resolve path to a SQL file relative to the project root."""
    # When running via `alembic upgrade`, cwd is typically the project root.
    # Fallback: walk up from this file's location.
    candidates = [
        Path(os.getcwd()) / "db" / "migrations" / filename,
        Path(__file__).parents[4] / "db" / "migrations" / filename,
    ]
    for path in candidates:
        if path.exists():
            return path.read_text(encoding="utf-8")
    raise FileNotFoundError(
        f"Migration SQL file '{filename}' not found. "
        "Run alembic from the project root directory."
    )


# ---------------------------------------------------------------------------
# Upgrade: apply schema + views
# ---------------------------------------------------------------------------
def upgrade() -> None:
    # 001 — tables, enums, triggers, indexes (partitioned device_states included)
    op.execute(_sql_file("001_initial_schema.sql"))

    # 002 — views: v_device_summary, v_security_stats, v_firmware_update_candidates
    op.execute(_sql_file("002_create_views.sql"))


# ---------------------------------------------------------------------------
# Downgrade: drop everything in reverse dependency order
# ---------------------------------------------------------------------------
def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS v_firmware_update_candidates")
    op.execute("DROP VIEW IF EXISTS v_security_stats")
    op.execute("DROP VIEW IF EXISTS v_device_summary")

    op.execute("DROP TABLE IF EXISTS firmware_updates CASCADE")
    op.execute("DROP TABLE IF EXISTS mqtt_messages CASCADE")
    op.execute("DROP TABLE IF EXISTS automations CASCADE")
    op.execute("DROP TABLE IF EXISTS security_events CASCADE")
    op.execute("DROP TABLE IF EXISTS device_states CASCADE")
    op.execute("DROP TABLE IF EXISTS devices CASCADE")
    op.execute("DROP TABLE IF EXISTS rooms CASCADE")
    op.execute("DROP TABLE IF EXISTS users CASCADE")

    op.execute("DROP FUNCTION IF EXISTS trigger_set_updated_at() CASCADE")

    op.execute("DROP TYPE IF EXISTS automation_trigger_type")
    op.execute("DROP TYPE IF EXISTS firmware_update_status")
    op.execute("DROP TYPE IF EXISTS security_severity")
    op.execute("DROP TYPE IF EXISTS firmware_type")
    op.execute("DROP TYPE IF EXISTS chip_type")
    op.execute("DROP TYPE IF EXISTS protocol_type")

    op.execute('DROP EXTENSION IF EXISTS "pg_trgm"')
    op.execute('DROP EXTENSION IF EXISTS "pgcrypto"')
