"""Add bim_models table

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE bim_model_estado AS ENUM ('uploading', 'processing', 'ready', 'error')"
    )
    op.create_table(
        "bim_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("nome", sa.String(255), nullable=False),
        sa.Column("versao", sa.String(50), nullable=False, server_default="v1"),
        sa.Column("descricao", sa.Text, nullable=True),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("tamanho_bytes", sa.Integer, nullable=False),
        sa.Column("mime_type", sa.String(100), nullable=False),
        sa.Column(
            "estado",
            postgresql.ENUM(
                "uploading", "processing", "ready", "error",
                name="bim_model_estado", create_type=False,
            ),
            nullable=False,
            server_default="ready",
        ),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("bim_models")
    op.execute("DROP TYPE bim_model_estado")
