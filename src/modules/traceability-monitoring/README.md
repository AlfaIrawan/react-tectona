# Traceability & Monitoring (Tectona)

Frontend module for cross-entity **User Activity & Audit**, **Entity Lineage** (React Flow graph), and read-only **Platform Health** in `react-tectona`.

## Scope

- Reads from `python-tectona-activity-lineage-service-fastapi` (proxy `/api/tectona-activity`, default port `8435`).
- Workspace-scoped: every request requires `workspace_id`, resolved from `useTenantContextOptional()`.

## Relationship to existing modules — agregator, not duplicate

- **Enterprise Governance Model (EGM)** already has `traceability/audit`, `traceability/history`, `traceability/usage` pages. Those are the SoR for **governance/policy** audit (template changes, compliance rule edits). This module's **User Activity & Audit** page is a separate, cross-entity **business/PM activity** feed (idea, project, work item, document, workspace invite, …) and links out to the EGM audit page rather than duplicating it (see "EGM governance audit" button on the Activity page).
- **Document Knowledge Management** keeps its own per-document activity/version history panel for detail work; this module aggregates *across* entities instead of replacing that panel.
- **Collaboration-context / presence** is realtime online/AFK status, not a historical activity store — unrelated to this module.
- **Platform Health** here is a thin read-only status summary for a subset of Tectona-relevant services (identity-lite, project, work-management, document-knowledge, collaboration-context, agent-runtime) with a deep-link to **Salix** (Central Log Management). It intentionally does **not** become a log explorer or metrics dashboard — that stays in Salix/Acerra per the Federated Capability Charter.

## Structure

```text
src/modules/traceability-monitoring/
├── paths.ts
├── components/
│   ├── TraceabilityMonitoringLayout.tsx   # breadcrumb + page header + 3-tab sub-nav + <Outlet/>
│   ├── ActivityFiltersBar.tsx
│   ├── ActivityTimelineTable.tsx
│   ├── ActivityDetailDrawer.tsx
│   ├── LineageGraphCanvas.tsx             # full-bleed React Flow canvas (Background/Controls/MiniMap + toolbar overlay)
│   ├── LineageNode.tsx                    # custom node renderer, styled per entity_type
│   ├── LineageDetailDrawer.tsx            # overlay drawer on node click, deep-links to the SoR page
│   └── PlatformHealthCards.tsx
├── pages/
│   ├── UserActivityAuditPage.tsx
│   ├── EntityLineagePage.tsx
│   └── PlatformHealthPage.tsx
├── hooks/
│   ├── useActivitiesQuery.ts
│   └── useLineageGraphQuery.ts
└── lib/
    ├── activityMappers.ts
    └── lineageLayout.ts                   # client-side layered (BFS-distance) layout — no dagre dependency
```

## Entity Lineage canvas

`EntityLineagePage` always renders one full-bleed `LineageGraphCanvas` (never a small inset card): the graph fills the available height below the module's tab bar, with `<Background/>`, `<Controls/>`, and `<MiniMap/>` from `reactflow`, plus a floating toolbar (root type/ID, depth, fit view, reset) and a floating detail drawer — both overlaid on the canvas, not pushing it out of view. Root entity is carried in the URL (`?rootType=&rootId=`) so "Show in lineage" from the Activity page can deep-link directly into a graph.

Node/edge counts are capped server-side (`TECTONA_ACTIVITY_LINEAGE_MAX_NODES`, default 150) and the canvas shows a "graph truncated" banner when the cap is hit — never silently drops data without saying so.

## Env vars

- `VITE_TECTONA_ACTIVITY_API_URL` — override the `/api/tectona-activity` base (defaults to same-origin proxy).
- `VITE_SALIX_BASE_URL` — optional; when set, Platform Health shows an "Open in Salix" deep-link.
