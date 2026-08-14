# Tectona Project Management Platform

> Codename: Tectona

Enterprise-grade Project Management workspace with a consistent enterprise UI/UX foundation, scoped specifically for planning and delivery management.

## Overview

Tectona is a frontend workspace for managing project execution across initiatives, teams, and milestones.

Current capability scope in this repository:
- Workspace: Workspace lifecycle, governance, and portfolio visibility
- Projects: Project workspace, scope, ownership, and status
- Roadmap: Milestones, dependencies, and release waves
- Task & Work Management: Task execution, hierarchy, workflow, dependencies, workload, and delivery activity
- Planning & Scheduling: Timeline control, sprint planning, calendar coordination, capacity management, deadline/SLA monitoring, and baseline vs actual tracking
- Workflow & Automation Engine: Workflow design, approval orchestration, state transitions, conditional logic, event-driven automation, API/webhook actions, and runtime execution monitoring
- Team chat (App Shell): Direct and group messaging via shared **collaboration-context-service** in the communication panel — not a separate enterprise navigation module
- Resource Management: Resource allocation, skill-based staffing, availability and capacity tracking, workload balancing, utilization analytics, and staffing risk monitoring across projects and workspaces
- Execution Portfolio & Delivery Governance: PMO delivery governance for execution oversight, portfolio/program coordination, initiative alignment, OKR/KPI delivery mapping, delivery outcome tracking, operational risk and issue management, stage gate control, compliance telemetry, and audit traceability
- Reporting & Analytics: Executive dashboards, operational reporting, custom analytics, project health scoring, agile burndown and velocity reporting, resource utilization insights, SLA compliance analytics, trend analysis, and exportable dashboard sharing
- Document & Knowledge Management: Project-linked document repository, template library, meeting notes, version lineage, reusable delivery content, artifact linkage, and execution-aware knowledge access
- Integration & API Platform: API catalog, webhook management, external system connectivity, event-driven integration, runtime monitoring, security controls, and payload mapping for project-centric enterprise workflows
- Security & Access Control: Central RBAC governance, fine-grained permission management, scoped access reviews, identity and SSO integration, sensitive-access masking policy, compliance monitoring, and audit-ready security traceability for workspace, project, task, document, and integration contexts
- AI Project Intelligence: AI-assisted task generation from requirements and meetings, predictive delay and risk detection, resource recommendations, next best actions, conversational project assistance, explainability, confidence visibility, and governed approval of AI-generated execution actions
- AI Idea & Prioritization Intelligence: AI-assisted idea intake classification, business impact prediction, multi-factor scoring, feasibility assessment, strategic alignment mapping, execution path recommendation, portfolio placement guidance, explainable prioritization, and approval-oriented decision support for incoming ideas and demand items
- Platform Settings & Administration: Central administration for organizations, users, teams, workflows, templates, fields, policies, environments, and platform-wide preferences

Out of scope:
- AI lifecycle operations (models, runs, training, deployment)
- Any non-Project Management domain capability modules

## Tech Stack

- React 19 + TypeScript + Vite
- TailwindCSS + shadcn/ui
- Zustand + TanStack Query
- React Router

## Getting Started

Prerequisites:
- Node.js 20.19+ or 22.12+
- npm

Install:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Autentikasi vs membership workspace

Tectona memisahkan dua lapisan:

| Lapisan | Layanan | Fungsi |
|---------|---------|--------|
| **Login (AuthN)** | identity-lite | Email + password → JWT |
| **Akses workspace** | workspace-access-control (WAC) | Membership per `workspace_id` |

### Gate masuk aplikasi & onboarding P0

Setelah login, user **non-admin** tanpa membership aktif diarahkan ke **wizard onboarding** (`/onboarding`), bukan dead-end `/no-workspace-access`.

| Route | Fungsi |
|-------|--------|
| `/register` | Daftar akun (identity-lite) |
| `/login/oauth/callback` | Callback OAuth PKCE setelah Microsoft SSO |
| `/onboarding` | Wizard: buat workspace personal atau ajukan join by slug |
| `/onboarding/status` | Status join pending / ditolak |
| `/t/:slug` | Deep link tenant → set context → shell |

Urutan guard: `ProtectedRoute` → `OnboardingGate` → `AppAccessGate` → `AppLayout`.

Workspace **personal** (`tenant_mode=personal`) menyembunyikan modul **Workspace** di launcher.

| Lingkungan | Gate membership |
|------------|-----------------|
| **Development** (`npm run dev`) | **Aktif** (production-like) |
| Override onboarding | `VITE_TECTONA_ONBOARDING_ENABLED=false` |
| Override membership | `VITE_TECTONA_REQUIRE_WORKSPACE_MEMBERSHIP=false` |

Platform admin (`root`, `administrator`) bypass onboarding dan membership gate.

### Alur dev manual (P0)

1. Pastikan layanan berjalan: identity-lite `:8430`, WAC `:8421`, workspace-org `:8424`
2. Jalankan migrasi onboarding di ketiga layanan (lihat prompt backend P0)
3. `npm run dev` → buka `http://localhost:9411/register`
4. Daftar → onboarding → buat workspace personal → shell `/projects`
5. Join flow: slug workspace org → `/onboarding/status` → admin approve di WAC

User tanpa membership (mis. akun baru) → `/onboarding`. User BA (Puspa, Ferli, …) **bisa login** setelah seed WAC.

Saat **WAC** startup (`WORKSPACE_ACCESS_CONTROL_SEED_DEV_MEMBERSHIPS=true`), layanan:

1. Mengambil semua workspace **active** dari workspace-org
2. Menambahkan membership untuk user di `db/seeds/tectona_dev_memberships.json` (idempotent)

**Restart WAC** setelah pull agar membership ter-seed ke workspace yang sudah ada.

User tanpa membership (mis. akun baru) → `/onboarding`. User BA (Puspa, Ferli, …) **bisa login** setelah seed WAC.

### Configurable auth providers (password + social SSO)

Frontend and backend are toggled independently:

| Layer | Env | Values |
|-------|-----|--------|
| **Frontend (buttons)** | `VITE_AUTH_PROVIDERS` | Comma-separated: `password`, `microsoft`, `google`, `meta` — order = button order |
| **Backend (federation)** | `IDENTITY_LITE_FEDERATION_*_ENABLED` + credentials | Per provider in identity-lite `.env` |

**Examples (frontend `.env.development`):**

```env
# Password only (default dev)
VITE_AUTH_PROVIDERS=password

# Google only + password
VITE_AUTH_PROVIDERS=password,google

# All social providers
VITE_AUTH_PROVIDERS=password,microsoft,google,meta
```

Social buttons are **hidden** when not listed in `VITE_AUTH_PROVIDERS`. Backend returns `503` if a button is shown but federation credentials are missing.

| Provider | Frontend id | Backend env prefix | Redirect URI (identity-lite) |
|----------|-------------|-------------------|------------------------------|
| Google | `google` | `IDENTITY_LITE_FEDERATION_GOOGLE_*` | `http://localhost:8430/oauth2/federation/google/callback` |
| Microsoft | `microsoft` | `IDENTITY_LITE_FEDERATION_MICROSOFT_*` | `http://localhost:8430/oauth2/federation/microsoft/callback` |
| Meta | `meta` | `IDENTITY_LITE_FEDERATION_META_*` | `http://localhost:8430/oauth2/federation/meta/callback` |

Flow: social button → `/oauth2/authorize?idp=<provider>` + PKCE → IdP login → identity-lite callback → SPA `/login/oauth/callback` → onboarding/shell.

Use **local** identity-lite (`python run.py`) with latest code — Docker image may lag behind federation features.

### Seed directory dev (workspace-org)

Jika database workspace-org **kosong**, bootstrap membuat org Adira + 3 workspace sample. Jika sudah ada workspace (seperti environment Anda), seed directory dilewati — WAC tetap seed membership ke workspace yang ada.

### Invite member

1. **Karyawan sudah ada** di direktori identity → invite hanya menambah baris membership WAC.
2. **Email belum ada** → ketik email valid di drawer Invite; sistem **provision** user (`status: invited`) → membership → **activate** agar bisa login.

User dengan status `invited` **tidak bisa login** sampai diaktifkan (setelah invite selesai).

### Dev vs produksi

- **Dev (production-like):** gate membership **aktif**; seed WAC + identity dev; restart WAC untuk apply membership ke workspace existing.
- **Iterasi cepat:** set `VITE_TECTONA_REQUIRE_WORKSPACE_MEMBERSHIP=false` jika perlu login tanpa membership.
- **Produksi:** user baru lewat invite/JIT; jangan andalkan seed dev.

Jalankan migrasi identity `003_add_invited_user_status.sql` sebelum invite-by-email.

## Dokumentasi terkait

- [Tectona — Onboarding & tenant provisioning](../../docs/standards/Tectona-Onboarding-and-Tenant-Provisioning.md) — register/SSO, wizard post-login, personal vs org workspace, slug tenant, join request, org KYC, Microsoft/Google SSO (fase P0–P3)
- [Tectona — onboarding P0 — frontend binding](../../docs/prompts/Tectona-Onboarding-Frontend-Binding.md) — implementasi UI wizard, OnboardingGate, TenantContext
- [Tectona — onboarding P0 — shared backend extensions](../../docs/prompts/Tectona-Onboarding-P0-Shared-Backend-Extensions.md) — perluasan identity-lite, workspace-org, WAC
- [Tectona — Workspace Ownership identity mode](../../docs/standards/Tectona-Workspace-Ownership-Identity-Mode.md) — Identity-Lite vs Enterprise IAM di wizard; bukan Hybrid; pemisahan AuthN/AuthZ di Platform Settings
- [Tectona — Frontend ↔ Microservice mapping §2.4](../../docs/mappings/Tectona-Frontend-Microservice-Mapping.md#24-new-workspace-wizard--ownership-identity-mode-workspacemanagementpage)

## Notes

- This repository intentionally keeps a consistent platform visual language while enforcing Tectona Project Management domain boundaries.
- If new modules are added, keep them aligned with Project Management capabilities only and avoid duplicating enterprise SoR for API gateway ownership in Laurus, service topology ownership in Tilia, orchestration ownership in Vitis, AI lifecycle ownership in Sequoia, AI observability ownership in Acerra, or enterprise repositories owned by Cedrus and Salvia.
