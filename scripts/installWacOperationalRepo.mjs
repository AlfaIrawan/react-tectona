import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.resolve(
  __dirname,
  '../../../Service Registry Management/python-workspace-access-control-service-fastapi/db/operations/operational_team_repo.py'
)

const py = `"""Operational team catalog — app-scoped CRUD."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import text

from db.operations.connection import get_db_session

DEFAULT_OPERATIONAL_TEAMS: list[tuple[str, str, int]] = [
    ("pmo_office", "PMO Office", 10),
    ("program_delivery", "Program Delivery", 20),
    ("product_delivery", "Product Delivery", 30),
    ("governance", "Governance", 40),
    ("operations", "Operations", 50),
    ("architecture", "Architecture", 60),
    ("engineering", "Engineering", 70),
]


def _actor(actor_id: str | None) -> str:
    return (actor_id or "system").strip() or "system"


def team_code_from_display_name(display_name: str) -> str:
    slug = display_name.strip().lower().replace(" ", "_")
    return re.sub(r"[^a-z0-9_]", "", slug)


def _row_to_dict(row: Any) -> dict[str, Any]:
    return {
        "id": str(row[0]),
        "team_code": row[1],
        "display_name": row[2],
        "sort_order": int(row[3]),
    }


def list_operational_teams(app_id: UUID) -> list[dict[str, Any]]:
    with get_db_session() as session:
        rows = session.execute(
            text(
                """
                SELECT t.id, t.team_code, t.display_name, t.sort_order
                FROM wac_operational_teams t
                INNER JOIN wac_apps a ON a.id = t.app_id
                WHERE t.app_id = :app_id
                  AND t.deleted_at IS NULL
                  AND a.is_active = TRUE
                ORDER BY t.sort_order ASC, t.display_name ASC
                """
            ),
            {"app_id": app_id},
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def count_active_operational_teams(app_id: UUID) -> int:
    with get_db_session() as session:
        n = session.execute(
            text(
                """
                SELECT COUNT(*)::int
                FROM wac_operational_teams t
                INNER JOIN wac_apps a ON a.id = t.app_id
                WHERE t.app_id = :app_id AND t.deleted_at IS NULL AND a.is_active = TRUE
                """
            ),
            {"app_id": app_id},
        ).scalar_one()
    return int(n)


def create_operational_team(
    app_id: UUID,
    display_name: str,
    *,
    actor_id: str | None = None,
    created_from: str = "api",
) -> dict[str, Any]:
    label = display_name.strip()
    if not label:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="display_name is required")
    team_code = team_code_from_display_name(label)
    if not team_code:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Invalid team name")

    actor = _actor(actor_id)
    with get_db_session() as session:
        app_row = session.execute(
            text("SELECT id FROM wac_apps WHERE id = :app_id AND is_active = TRUE"),
            {"app_id": app_id},
        ).fetchone()
        if not app_row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="App not found")

        dup = session.execute(
            text(
                """
                SELECT id FROM wac_operational_teams
                WHERE app_id = :app_id AND deleted_at IS NULL
                  AND (team_code = :code OR lower(display_name) = lower(:label))
                """
            ),
            {"app_id": app_id, "code": team_code, "label": label},
        ).fetchone()
        if dup:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Operational team already exists")

        max_sort = session.execute(
            text(
                """
                SELECT COALESCE(MAX(sort_order), 0)
                FROM wac_operational_teams
                WHERE app_id = :app_id AND deleted_at IS NULL
                """
            ),
            {"app_id": app_id},
        ).scalar_one()
        sort_order = int(max_sort) + 10

        row = session.execute(
            text(
                """
                INSERT INTO wac_operational_teams (
                    app_id, team_code, display_name, sort_order,
                    created_by, created_from, updated_by, updated_from
                )
                VALUES (
                    :app_id, :code, :label, :sort_order,
                    :actor, :created_from, :actor, :created_from
                )
                RETURNING id, team_code, display_name, sort_order
                """
            ),
            {
                "app_id": app_id,
                "code": team_code,
                "label": label,
                "sort_order": sort_order,
                "actor": actor,
                "created_from": created_from,
            },
        ).fetchone()
        session.commit()
    return _row_to_dict(row)


def update_operational_team(
    app_id: UUID,
    team_id: UUID,
    display_name: str,
    *,
    actor_id: str | None = None,
    updated_from: str = "api",
) -> dict[str, Any]:
    label = display_name.strip()
    if not label:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="display_name is required")

    actor = _actor(actor_id)
    with get_db_session() as session:
        existing = session.execute(
            text(
                """
                SELECT t.id, t.team_code
                FROM wac_operational_teams t
                INNER JOIN wac_apps a ON a.id = t.app_id
                WHERE t.id = :team_id AND t.app_id = :app_id
                  AND t.deleted_at IS NULL AND a.is_active = TRUE
                """
            ),
            {"team_id": team_id, "app_id": app_id},
        ).fetchone()
        if not existing:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operational team not found")

        dup = session.execute(
            text(
                """
                SELECT id FROM wac_operational_teams
                WHERE app_id = :app_id AND deleted_at IS NULL AND id <> :team_id
                  AND lower(display_name) = lower(:label)
                """
            ),
            {"app_id": app_id, "team_id": team_id, "label": label},
        ).fetchone()
        if dup:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Operational team name already exists")

        row = session.execute(
            text(
                """
                UPDATE wac_operational_teams
                SET display_name = :label,
                    updated_by = :actor,
                    updated_date = CURRENT_TIMESTAMP,
                    updated_from = :updated_from
                WHERE id = :team_id AND app_id = :app_id AND deleted_at IS NULL
                RETURNING id, team_code, display_name, sort_order
                """
            ),
            {
                "label": label,
                "actor": actor,
                "updated_from": updated_from,
                "team_id": team_id,
                "app_id": app_id,
            },
        ).fetchone()
        session.commit()
    return _row_to_dict(row)


def delete_operational_team(
    app_id: UUID,
    team_id: UUID,
    *,
    actor_id: str | None = None,
    updated_from: str = "api",
) -> None:
    if count_active_operational_teams(app_id) <= 1:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="At least one operational team must remain",
        )

    actor = _actor(actor_id)
    with get_db_session() as session:
        result = session.execute(
            text(
                """
                UPDATE wac_operational_teams
                SET deleted_at = NOW(),
                    updated_by = :actor,
                    updated_date = CURRENT_TIMESTAMP,
                    updated_from = :updated_from
                WHERE id = :team_id AND app_id = :app_id AND deleted_at IS NULL
                """
            ),
            {
                "actor": actor,
                "updated_from": updated_from,
                "team_id": team_id,
                "app_id": app_id,
            },
        )
        if result.rowcount == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Operational team not found")
        session.commit()


def ensure_default_operational_teams(app_id: UUID) -> None:
    """Idempotent seed of default operational teams per app."""
    with get_db_session() as session:
        for team_code, display_name, sort_order in DEFAULT_OPERATIONAL_TEAMS:
            session.execute(
                text(
                    """
                    INSERT INTO wac_operational_teams (
                        app_id, team_code, display_name, sort_order,
                        created_by, created_from
                    )
                    VALUES (:app_id, :code, :label, :sort_order, 'system', 'bootstrap')
                    ON CONFLICT (app_id, team_code) DO NOTHING
                    """
                ),
                {
                    "app_id": app_id,
                    "code": team_code,
                    "label": display_name,
                    "sort_order": sort_order,
                },
            )
        session.commit()
`

fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, py, { encoding: 'utf8' })
const b = fs.readFileSync(target)
console.log('bytes', b.length, 'utf16', b[1] === 0)
