"""Seed one verified Tectona sandbox service through its development repositories."""

import hashlib
import hmac
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import text

APP_ID = UUID("00000000-0000-0000-0000-000000000014")
ACTOR = "tectona-workspace-sandbox"
EXPECTED = {"enterprise": (4000, 4, 12), "smb": (500, 6, 3), "startup": (50, 1, 1)}
SERVICE = sys.argv[1]
PREFIX = {"identity": "IDENTITY_LITE", "org": "WORKSPACE_ORG", "wac": "WORKSPACE_ACCESS_CONTROL"}[SERVICE]
DATABASE = {"identity": "identity_sandbox", "org": "workspace_org_sandbox", "wac": "wac_sandbox"}[SERVICE]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify_target():
    require(os.environ.get("TECTONA_WORKSPACE_SANDBOX") == "v1", "sandbox marker missing")
    require(os.environ.get(f"{PREFIX}_POSTGRES_HOST") == "db", "unexpected database host")
    require(os.environ.get(f"{PREFIX}_POSTGRES_DB") == DATABASE, "unexpected configured database")
    require(not os.environ.get(f"{PREFIX}_DATABASE_URL"), "unexpected database URL override")
    from db.operations.connection import get_db_session
    with get_db_session() as session:
        row = session.execute(text("SELECT current_database(), current_user")).one()
        require(tuple(row) == (DATABASE, "tectona_sandbox"), "unexpected effective database or role")


def subject(person_id):
    return uuid5(NAMESPACE_URL, "tectona-workspace-sandbox/v1/" + person_id)


def retired_keys(data, before):
    return {w["id"] for w in before["workspaces"]} - {w["id"] for w in data["workspaces"]} if before else set()


def password(master, person_id):
    return "Aa1!" + hmac.new(master, ("account:" + person_id).encode(), hashlib.sha256).hexdigest()


def identity(data, origin, master):
    from db.operations import identity_repo as repo
    from db.operations.migrations import run_migrations
    from pydantic import EmailStr, TypeAdapter
    from services.password_policy import validate_password_strength
    from services.passwords import hash_password

    run_migrations()
    repo.upsert_oidc_client(
        client_id="tectona-spa", app_id=APP_ID, display_name="Tectona Workspace Sandbox",
        client_type_code="public", redirect_uris=[origin + "/login/oauth/callback"],
    )
    validator = TypeAdapter(EmailStr)
    known = {}
    for offset in range(0, len(data["employees"]) + 1, 500):
        known.update({row["email"]: row for row in repo.list_users(limit=500, offset=offset)})
    require(set(known).issubset({person["email"] for person in data["employees"]}), "foreign identity in sandbox")

    def seed_person(person):
        email = validator.validate_python(person["email"])
        uid = subject(person["id"])
        existing = known.get(email)
        if existing:
            require(str(existing["id"]) == str(uid), "unexpected existing identity")
            require(existing["status_code"] == "active", "existing identity inactive")
            return False
        plain = password(master, person["id"])
        validate_password_strength(plain)
        repo.ensure_user(
            user_id=uid, email=email, display_name=person["name"],
            password_hash=hash_password(plain), status_code="active", organizational_unit=person["team"],
        )
        return True

    created = 0
    with ThreadPoolExecutor(max_workers=12 if data["scenario"] == "enterprise" else 3) as pool:
        for count, added in enumerate(pool.map(seed_person, data["employees"]), 1):
            created += added
            if count % 500 == 0:
                print(f"Identity rows checked: {count}", flush=True)

    from db.operations.connection import get_db_session
    with get_db_session() as session:
        rows = session.execute(text("""
            SELECT u.id, u.email, u.display_name, u.organizational_unit, s.code,
                   (c.password_hash LIKE '$2%' AND c.password_login_enabled) AS usable
            FROM identity_users u
            JOIN lookup_user_statuses s ON s.id = u.lookup_user_status_id
            LEFT JOIN identity_credentials c ON c.user_id = u.id
            WHERE u.deleted_at IS NULL
        """)).all()
    expected = {
        (subject(p["id"]), p["email"], p["name"], p["team"], "active", True)
        for p in data["employees"]
    }
    require(set(map(tuple, rows)) == expected, "identity or credential count/fields differ")
    print(f"Verified {len(rows)} active identities with enabled bcrypt credentials ({created} added)", flush=True)


def organization(data, before):
    from db.operations.connection import get_db_session
    from db.operations import workspace_org_repo as repo

    with get_db_session() as session:
        org_rows = session.execute(text("SELECT id, external_org_ref FROM workspace_org_organizations")).all()
        ws_rows = session.execute(text("""
            SELECT w.id, w.external_workspace_ref, s.code FROM workspace_org_workspaces w
            JOIN workspace_org_lookup_workspace_status s ON s.id=w.status_id
        """)).all()
    org_ids = {key: str(uid) for uid, key in org_rows}
    legacy = retired_keys(data, before)
    retired = {key: str(uid) for uid, key, status in ws_rows if key in legacy and status == "archived"}
    ws_ids = {key: str(uid) for uid, key, _ in ws_rows if key not in retired}
    require(set(org_ids).issubset({o["id"] for o in data["organizations"]}), "foreign organization in sandbox")
    require(set(ws_ids).issubset({w["id"] for w in data["workspaces"]}), "foreign workspace in sandbox")

    for org in data["organizations"]:
        if org["id"] not in org_ids:
            record = repo.create_organization(
                payload={
                    "organization_code": org["id"].split(":")[-1], "name": org["name"],
                    "external_org_ref": org["id"],
                    "metadata": {"parent_org_id": org_ids.get(org["parentId"]), "sandbox_kind": org["kind"]},
                },
                actor_id=ACTOR, correlation_id=None, idempotency_key=org["id"],
            )
            org_ids[org["id"]] = str(record["id"])

    people = {person["id"]: person for person in data["employees"]}
    home_by_org = {
        org["id"]: next((w for w in data["workspaces"] if w["organizationId"] == org["id"] and not w["parentId"]), None)
        for org in data["organizations"]
    }
    for workspace in data["workspaces"]:
        meta = {
            "tectona_workspace_classification": "Organization" if home_by_org[workspace["organizationId"]] == workspace else "Department",
            "tectona_owner_identity_ref": str(subject(workspace["ownerId"])),
            "tectona_owner": people[workspace["ownerId"]]["name"],
            "tectona_related_organization_ids": [org_ids[key] for key in workspace["relatedOrganizationIds"]],
            "parent_workspace_id": ws_ids.get(workspace["parentId"]),
        }
        if workspace["id"] not in ws_ids:
            record = repo.create_workspace(
                payload={
                    "workspace_key": workspace["id"].split(":")[-1], "name": workspace["name"],
                    "organization_id": org_ids[workspace["organizationId"]],
                    "external_workspace_ref": workspace["id"], "metadata": meta,
                },
                actor_id=str(subject(workspace["ownerId"])), correlation_id=None, idempotency_key=workspace["id"],
            )
            ws_ids[workspace["id"]] = str(record["id"])
        else:
            record = repo.get_workspace_by_id(ws_ids[workspace["id"]])
            current = record["metadata"] or {}
            if record["name"] != workspace["name"] or any(current.get(key) != value for key, value in meta.items()):
                repo.patch_workspace(
                    workspace_id=UUID(ws_ids[workspace["id"]]),
                    payload={"version": record["version"], "name": workspace["name"], "metadata": {**current, **meta}},
                    actor_id=ACTOR, correlation_id=None,
                )

    with get_db_session() as session:
        for org in data["organizations"]:
            home = home_by_org[org["id"]]
            if home is None:
                continue
            session.execute(text("""
                UPDATE workspace_org_organizations SET default_workspace_id = :home
                WHERE id = :org AND default_workspace_id IS NULL
            """), {"org": org_ids[org["id"]], "home": ws_ids[home["id"]]})
        session.commit()
        rows = session.execute(text("""
            SELECT external_workspace_ref, name, organization_id, metadata, slug
            FROM workspace_org_workspaces
            WHERE status_id = (SELECT id FROM workspace_org_lookup_workspace_status WHERE code='active')
        """)).all()
        orgs = session.execute(text("""
            SELECT external_org_ref, name, metadata, default_workspace_id FROM workspace_org_organizations
        """)).all()
    organizations = {row.external_org_ref: row for row in orgs}
    require(len(orgs) == len(data["organizations"]), "organization count mismatch")
    for org in data["organizations"]:
        row = organizations[org["id"]]
        require(row.name == org["name"] and row.metadata.get("sandbox_kind") == org["kind"], "organization metadata mismatch")
        require(row.metadata.get("parent_org_id") == org_ids.get(org["parentId"]), "organization parent mismatch")
        home = home_by_org[org["id"]]
        require(str(row.default_workspace_id) == ws_ids[home["id"]] if home else row.default_workspace_id is None,
                "organization home mismatch")
    records = {row.external_workspace_ref: row for row in rows}
    require(len(records) == len(data["workspaces"]), "workspace count mismatch")
    for w in data["workspaces"]:
        row = records[w["id"]]
        require(row.name == w["name"] and str(row.organization_id) == org_ids[w["organizationId"]], "workspace org mismatch")
        require(row.metadata.get("parent_workspace_id") == ws_ids.get(w["parentId"]), "workspace parent mismatch")
    print(json.dumps({
        "workspaces": ws_ids,
        "retired": retired,
        "organizations": len(orgs),
        "subsidiaries": sum(row.metadata.get("sandbox_kind") == "Subsidiary" for row in orgs),
    }), flush=True)


def membership(data, workspaces, retired, before):
    from db.operations.connection import get_db_session
    from db.operations import wac_repo as repo
    from db.operations import operational_team_repo as teams

    people = {person["id"]: person for person in data["employees"]}
    team_codes = {team["display_name"]: team["team_code"] for team in teams.list_operational_teams(APP_ID)}
    for label in sorted({person["team"] for person in people.values()}):
        if label not in team_codes:
            team_codes[label] = teams.create_operational_team(APP_ID, label, actor_id=ACTOR)["team_code"]

    expected = {}
    for entry in data["memberships"]:
        workspace = UUID(workspaces[entry["workspaceId"]])
        uid = str(subject(entry["employeeId"]))
        expected[(workspace, uid)] = (entry["role"], team_codes[people[entry["employeeId"]]["team"]])

    def read_members():
        return {
            (UUID(workspace), str(row["subject_id"])): row
            for workspace in workspaces.values()
            for row in repo.list_workspace_members(app_id=APP_ID, workspace_id=UUID(workspace))
            if row["membership_status"] == "active"
        }

    existing = read_members()
    require(all(key in expected and expected[key][0] == row["role_code"] for key, row in existing.items()), "foreign membership or role mismatch")
    changed = 0
    for (workspace, uid), (role, team) in expected.items():
        row = existing.get((workspace, uid))
        if not row:
            repo.ensure_membership(
                app_id=APP_ID, workspace_id=workspace, subject_id=uid, role_code=role,
                participation_scope_code="all", operational_team_code=team, actor_id=ACTOR,
            )
        elif row["participation_scope_code"] != "all" or row["operational_team_code"] != team:
            repo.patch_membership(
                app_id=APP_ID, membership_id=UUID(str(row["id"])),
                payload={"version": row["version"], "participation_scope_code": "all", "operational_team_code": team},
                actor_id=ACTOR,
            )
            changed += 1
    verified = read_members()
    require(
        {key: (row["role_code"], row["operational_team_code"]) for key, row in verified.items()} == expected
        and all(row["participation_scope_code"] == "all" for row in verified.values()),
        "active memberships do not match fixture",
    )
    with get_db_session() as session:
        all_rows = session.execute(text("""
            SELECT m.workspace_id, m.subject_id, s.code FROM wac_memberships m
            JOIN wac_lookup_membership_status s ON s.id=m.wac_lookup_membership_status_id
            WHERE m.deleted_at IS NULL
        """)).all()
    inactive = {(str(workspace), str(uid)) for workspace, uid, status in all_rows if status == "suspended"}
    permitted_inactive = set()
    if retired:
        require(set(retired) == retired_keys(data, before), "unexpected retired workspaces")
        permitted_inactive = {
            (retired[entry["workspaceId"]], str(subject(entry["employeeId"])))
            for entry in before["memberships"] if entry["workspaceId"] in retired
        }
    require(inactive == permitted_inactive and len(all_rows) == len(expected) + len(inactive),
            "unexpected membership outside sandbox fixture")
    print(f"Verified {len(expected)} active WAC memberships for {len(data['employees'])} identities "
          f"({len(expected) - len(existing)} added, {changed} updated)", flush=True)


def consolidation_plan(data, before, archive=False):
    from db.operations.connection import get_db_session
    from db.operations import workspace_org_repo as repo

    retired = retired_keys(data, before)
    require(retired, "scenario has no consolidation plan")
    expected = {w["id"] for w in data["workspaces"]}
    with get_db_session() as session:
        rows = session.execute(text("""
            SELECT w.id, w.external_workspace_ref, w.version, w.metadata, s.code
            FROM workspace_org_workspaces w JOIN workspace_org_lookup_workspace_status s ON s.id=w.status_id
        """)).all()
    by_key = {row.external_workspace_ref: row for row in rows}
    require(set(by_key) == retired | expected and len(rows) == len(before["workspaces"]), "unexpected workspace set")
    require(all(by_key[key].code == "active" for key in expected), "a retained workspace is not active")
    for key in sorted(retired):
        row = by_key[key]
        require(row.code in {"active", "archived"}, "unexpected retired workspace state")
        if archive and row.code == "active":
            repo.patch_workspace(
                workspace_id=row.id,
                payload={
                    "version": row.version, "status_code": "archived",
                    "metadata": {**row.metadata, "tectona_lifecycle_stage": "Archived"},
                },
                actor_id=ACTOR, correlation_id=None,
            )
    if archive:
        # Departments whose dedicated workspace was retired remain in the organization tree.
        with get_db_session() as session:
            for key in retired:
                session.execute(text("""
                    UPDATE workspace_org_organizations SET default_workspace_id=NULL
                    WHERE default_workspace_id=:retired
                """), {"retired": by_key[key].id})
            session.commit()
    print(json.dumps({
        "workspaces": {key: str(by_key[key].id) for key in expected},
        "retired": {key: str(by_key[key].id) for key in retired},
    }), flush=True)


def consolidate_members(data, before, workspaces, retired):
    from db.operations import wac_repo as repo
    from db.operations import operational_team_repo as teams

    require(set(retired) == retired_keys(data, before), "unexpected consolidation scope")
    ids = {**workspaces, **retired}
    old = {(ids[entry["workspaceId"]], str(subject(entry["employeeId"]))): entry["role"] for entry in before["memberships"]}
    desired = {(workspaces[entry["workspaceId"]], str(subject(entry["employeeId"]))): entry["role"] for entry in data["memberships"]}
    current = {
        (workspace, str(row["subject_id"])): row
        for workspace in ids.values()
        for row in repo.list_workspace_members(app_id=APP_ID, workspace_id=UUID(workspace))
    }
    retired_members = {key for key in old if key[0] in retired.values()}
    require(set(old).issubset(current) and set(current).issubset(set(old) | set(desired)),
            "unexpected existing membership set")
    require(all(
        (row["membership_status"] in {"active", "suspended"} and row["role_code"] == old[key])
        if key in retired_members else
        (row["membership_status"] == "active" and row["role_code"] in {old.get(key), desired.get(key)})
        for key, row in current.items()
    ), "unexpected existing role or membership status")
    employee_teams = {str(subject(person["id"])): person["team"] for person in data["employees"]}
    team_codes = {team["display_name"]: team["team_code"] for team in teams.list_operational_teams(APP_ID)}
    require(set(employee_teams.values()).issubset(team_codes), "missing existing operational teams")
    added = updated = suspended = 0
    for key, role in desired.items():
        workspace, uid = key
        row = current.get(key)
        if row is None:
            repo.ensure_membership(
                app_id=APP_ID, workspace_id=UUID(workspace), subject_id=uid, role_code=role,
                participation_scope_code="all", operational_team_code=team_codes[employee_teams[uid]], actor_id=ACTOR,
            )
            added += 1
        elif row["role_code"] != role:
            repo.patch_membership(
                app_id=APP_ID, membership_id=UUID(str(row["id"])),
                payload={"version": row["version"], "role_code": role}, actor_id=ACTOR,
            )
            updated += 1
    for key in sorted(retired_members):
        row = current[key]
        if row["membership_status"] == "active":
            repo.patch_membership(
                app_id=APP_ID, membership_id=UUID(str(row["id"])),
                payload={"version": row["version"], "status_code": "suspended"}, actor_id=ACTOR,
            )
            suspended += 1
    print(f"Verified consolidation membership phase ({added} added, {updated} updated, {suspended} suspended)", flush=True)


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        data = payload["dataset"]
        scenario = data["scenario"]
        require((len(data["employees"]), len(data["organizations"]), len(data["workspaces"])) == EXPECTED[scenario], "unexpected fixture totals")
        require(os.environ.get("TECTONA_WORKSPACE_SCENARIO") == scenario, "wrong sandbox scenario")
        require(re.fullmatch(r"http://(?:enterprise|smb|startup)\.localhost:956[123]", payload["origin"]), "unexpected frontend origin")
        verify_target()
        phase = payload.get("phase")
        before = payload.get("before")
        if SERVICE == "org" and phase in {"consolidation-plan", "consolidation-archive"}:
            consolidation_plan(data, before, archive=phase == "consolidation-archive")
        elif SERVICE == "wac" and phase == "consolidation-members":
            consolidate_members(data, before, payload["workspaces"], payload["retired"])
        elif SERVICE == "identity":
            identity(data, payload["origin"], bytes.fromhex(payload["master"]))
        elif SERVICE == "org":
            organization(data, before)
        else:
            membership(data, payload["workspaces"], payload.get("retired", {}), before)
    except Exception as exc:
        # Database driver errors may contain SQL parameters. Keep them out of operator logs.
        detail = str(exc) if type(exc) is ValueError else type(exc).__name__
        sys.exit(f"Sandbox {SERVICE} seed failed: {detail}")
