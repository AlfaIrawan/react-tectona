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

## Demo lokal Workspace Management

Untuk menguji **login Ilex dan modul Workspace Management asli**, jalankan sandbox lokal dari direktori `react-tectona`. Setiap skenario punya layanan Ilex, Workspace Org, WAC, jaringan, volume PostgreSQL, dan origin browser sendiri.

| Skenario | Akun pegawai | Workspace aktif | Tectona development |
|---|---:|---:|---|
| Enterprise | 4.000 | 12 | [enterprise.localhost:9561](http://enterprise.localhost:9561/workspace-management) |
| SMB | 500 | 3 | [smb.localhost:9562](http://smb.localhost:9562/workspace-management) |
| Startup | 50 | 1 | [startup.localhost:9563](http://startup.localhost:9563/workspace-management) |

Docker Desktop harus berjalan dengan konteks `desktop-linux` dan image lokal yang tercantum di `scripts/workspace-sandbox/sandbox.mjs`. Gunakan Node.js 22.12+ di PATH atau berikan jalur Node melalui `-Node` saat menjalankan skrip. Ulangi langkah ini dengan `smb` dan `startup` untuk menjalankan skenario lainnya.

```powershell
.\scripts\workspace-sandbox\sandbox.ps1 -Action start -Scenario enterprise
$env:TECTONA_WORKSPACE_SCENARIO = 'enterprise'
npm run dev:workspace-sandbox
```

Di terminal lain, jalankan perintah di bawah. Perintah menampilkan email dan menyalin password pegawai yang dipilih ke clipboard Windows. Tempel password ke formulir **Sign in**. Gunakan nomor pegawai (mulai dari 1) atau email yang tampil di direktori. Pegawai pertama adalah admin workspace pertamanya. Kredensial diturunkan dari kunci lokal yang dilindungi Windows DPAPI dan bisa dipakai kembali oleh akun Windows yang menyiapkan sandbox.

```powershell
.\scripts\workspace-sandbox\sandbox.ps1 -Action credential -Scenario enterprise -Employee 1
```

Seed development memakai validasi dan bcrypt dari Ilex serta repository WAC untuk membership yang tercantum dalam fixture. Jalankan `-Action start` lagi untuk melanjutkan seed yang terhenti atau memeriksa hasilnya. Setelah ketiga backend berjalan, `-Action verify` menguji login Admin, Manager, Member, dan Viewer, akses roster yang diizinkan dan ditolak, serta penolakan kredensial dan token lintas sandbox. `-Action stop` menghentikan container sandbox dan menyimpan volume. Endpoint Register publik tetap nonaktif, dan seed tidak membuat akun admin teknis tambahan.

Untuk sandbox Startup atau SMB yang sudah memakai susunan lama, jalankan `-Action consolidate-workspaces` dengan skenario yang sesuai. Skrip memulihkan dump Workspace Org dan WAC ke database verifikasi sebelum mengubah membership. Workspace lama diarsipkan dan membership lama disuspensi. Arsip dump dan manifest tersedia di `%LOCALAPPDATA%\Tectona\WorkspaceSandbox\Backups`. Jumlah akun dan workspace di sini adalah ukuran contoh development.

### Pratinjau fixture tanpa akun

Dari direktori `react-tectona`, jalankan `npm run dev:workspace-demo` dan buka [demo lokal](http://127.0.0.1:5497/). Pilih dataset melalui **Demo scenario**, lalu buka **Overview**, **Workspace Directory**, atau **Workspace Members**.

| Skenario | Perusahaan fiktif | Pengguna | Struktur |
|---|---|---:|---|
| Enterprise | Veylora Transit Group | 4.000 | Kantor pusat dan tiga anak perusahaan (Rail Systems, Freight Networks, Charging Services), 12 workspace |
| SMB | Morrowfern Foodworks | 500 | Lima departemen dengan tiga workspace yaitu Operations, Sales, dan Internal |
| Startup | Lunewisp Studio | 50 | Satu organisasi datar dengan Company Hub untuk seluruh karyawan |

**Reset demo view** kembali ke Overview dan membersihkan pencarian, filter, serta halaman untuk skenario yang sedang dipilih. Muat ulang tab untuk kembali ke Enterprise. Fixture dibuat ulang secara deterministik, jadi tidak ada database yang perlu di-reset. Jumlah pengguna menghitung orang unik. Satu orang bisa tampil di lebih dari satu workspace dengan role yang berbeda.

Pratinjau menggunakan alamat `.test` sebagai data direktori fiktif. Akun yang bisa masuk tersedia melalui sandbox dan memakai domain sintetis `.example.com`.

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
