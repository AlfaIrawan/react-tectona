import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.resolve(
  __dirname,
  '../../../Service Registry Management/python-workspace-access-control-service-fastapi/db/operations/participation_scope_repo.py'
)

const py = `"""Participation scope catalog — controlled lookup per app (rename/reorder only)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text

from db.operations.connection import get_db_session

DEFAULT_PARTICIPATION_SCOPES: list[tuple[str, str, int]] = [
    ("all", "All", 10),
    ("project_only", "Project only", 20),
    ("program_only", "Program only", 30),
    ("portfolio_only", "Portfolio only", 40),
    ("read_only_workspace", "Read-only workspace", 50),
]

DEFAULT_PARTICIPATION_SCOPE_CODE = "project_only"


def _actor(actor_id: str | None) -> str:
    return (actor_id or "system").strip() or "system"


def _row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row[0]),
        "scope_code": row[1],
        "display_name": row[2],
        "sort_order": int(row[3]),
        "is_system": bool(row[4]),
    }


def list_participation_scopes(app_id: UUID) -> list[dict[str, Any]]:
    with get_db_session() as session:
        rows = session.execute(
            text(
                """
                SELECT p.id, p.scope_code, p.display_name, p.sort_order, p.is_system
                FROM wac_participation_scopes p
                INNER JOIN wac_apps a ON a.id = p.app_id
                WHERE p.app_id = :app_id
                  AND p.deleted_at IS NULL
                  AND a.is_active = TRUE
                ORDER BY p.sort_order ASC, p.display_name ASC
                """
            ),
            {"app_id": app_id},
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def resolve_participation_scope_id(app_id: UUID, scope_code: str) -> UUID:
    code = scope_code.strip()
    if not code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="participation_scope_code is required")
    with get_db_session() as session:
        row = session.execute(
            text(
                """
                SELECT p.id FROM wac_participation_scopes p
                INNER JOIN wac_apps a ON a.id = p.app_id
                WHERE p.app_id = :app_id AND p.scope_code = :code
                  AND p.deleted_at IS NULL AND a.is_active = TRUE
                """
            ),
            {"app_id": app_id, "code": code},
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"unknown participation scope: {code}")
    return row[0]


def default_participation_scope_id(app_id: UUID) -> UUID:
    return resolve_participation_scope_id(app_id, DEFAULT_PARTICIPATION_SCOPE_CODE)


def update_participation_scope(
    app_id: UUID,
    scope_id: UUID,
    *,
    display_name: str | None = None,
    sort_order: int | None = None,
    actor_id: str | None = None,
    updated_from: str = "api",
) -> dict[str, Any]:
    if display_name is None and sort_order is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="nothing to update")

    actor = _actor(actor_id)
    sets: list[str] = [
        "updated_by = :actor",
        "updated_date = CURRENT_TIMESTAMP",
        "updated_from = :updated_from",
    ]
    params: dict[str, Any] = {
        "actor": actor,
        "updated_from": updated_from,
        "scope_id": scope_id,
        "app_id": app_id,
    }

    if display_name is not None:
        label = display_name.strip()
        if not label:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="display_name is required")
        dup = None
        with get_db_session() as session:
            dup = session.execute(
                text(
                    """
                    SELECT id FROM wac_participation_scopes
                    WHERE app_id = :app_id AND deleted_at IS NULL AND id <> :scope_id
                      AND lower(display_name) = lower(:label)
                    """
                ),
                {"app_id": app_id, "scope_id": scope_id, "label": label},
            ).fetchone()
        if dup:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Participation scope label already exists")
        sets.append("display_name = :label")
        params["label"] = label

    if sort_order is not None:
        sets.append("sort_order = :sort_order")
        params["sort_order"] = int(sort_order)

    with get_db_session() as session:
        row = session.execute(
            text(
                f"""
                UPDATE wac_participation_scopes
                SET {", ".join(sets)}
                WHERE id = :scope_id AND app_id = :app_id AND deleted_at IS NULL
                RETURNING id, scope_code, display_name, sort_order, is_system
                """
            ),
            params,
        ).fetchone()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Participation scope not found")
        session.commit()
    return _row_to_dict(row)


def ensure_default_participation_scopes(app_id: UUID) -> None:
    with get_db_session() as session:
        for scope_code, display_name, sort_order in DEFAULT_PARTICIPATION_SCOPES:
            session.execute(
                text(
                    """
                    INSERT INTO wac_participation_scopes (
                        app_id, scope_code, display_name, sort_order, is_system,
                        created_by, created_from
                    )
                    VALUES (:app_id, :code, :label, :sort_order, TRUE, 'system', 'bootstrap')
                    ON CONFLICT (app_id, scope_code) DO NOTHING
                    """
                ),
                {
                    "app_id": app_id,
                    "code": scope_code,
                    "label": display_name,
                    "sort_order": sort_order,
                },
            )
        session.commit()
`

fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, py, { encoding: 'utf8' })
console.log('Wrote', target, fs.readFileSync(target).length)
