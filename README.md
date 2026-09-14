# Yoton Web

The staff-facing web portal for **Yoton** — a multi-tenant Hospital / Clinic Management System with a built-in Electronic Medical Record (EMR). Reception, doctors, nurses, lab, radiology, pharmacy, billing, and admin all work out of this app. It talks to the [`yoton-api`](../yoton-api) backend and shares its data model with the patient-facing [`yoton-mobile`](../yoton-mobile) app.

Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS v4**, with real-time updates over **SignalR**.

> This repository is an independent Git project. The API and the mobile app live in their own separate repositories and are versioned on their own.

---

## What this app does

Yoton Web is the operational cockpit for a clinic. Every module below is a role-gated "module" — an admin decides which roles can see which parts of the app through a live, per-role permission system.

| Area | Capability |
|---|---|
| **Dashboard** | Live KPI cards (patients, active doctors, appointments), weekly appointment & revenue charts, top-doctors leaderboard — all refreshed in real time via SignalR |
| **Front desk** | Patient registration & entry, check-in, appointment booking, pending follow-up queue |
| **Patient records** | Full patient list, records, payment & insurance management |
| **Doctor workbench** | Encounters, diagnoses (ICD-coded), chronic conditions, allergies, medications, referrals, quick notes, dental extras, and an audit-safe propose/acknowledge/reject workflow for correcting past encounters |
| **Nursing workbench** | Task queue, vitals (with history), triage, injections, dressings, blood sugar, IV fluids, shift scheduling, confidential nurse-only notes |
| **Electronic Medical Record** | Full patient chart / case sheet view |
| **Laboratory** | Test requests, pending queue, sample collection with barcode-labeled printing, result upload |
| **Radiology** | Imaging requests and result/image upload |
| **Pharmacy** | Medicine inventory with low-stock & high-risk alerts, prescriptions, dispense queue, printable labels |
| **Billing** | Invoices, payments, cancellations, visit-sourced chargeable items |
| **Doctor availability** | Scheduling, editable by admins or viewable by staff |
| **Departments & staff** | Department management, user administration |
| **Messages** | Real-time chat — staff↔staff and staff↔patient — with attachments, emoji reactions, reply threads, typing indicators, presence, and unread badges |
| **Compliance & quality** | Clinical incident reports, staff exposure incidents, hand hygiene audits, patient satisfaction surveys, staff FTE / patient data gap-filling |
| **KPI reports** | Browseable regulatory report catalog with date-range filtering and Excel download |
| **Audit log** | Full, filterable trail of every user action across the system, with per-entry version history |
| **Admin** | User management, role management (custom per-role module allow-lists with admin-password-confirmed overrides), configurable lookup lists, ICD code management, company settings & branding |

---

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict)
- **Styling:** Tailwind CSS v4 with a custom light/dark design-token theme (`next-themes`)
- **HTTP:** Axios with interceptors for JWT attachment, silent refresh-on-401, and a global loading bar; a thin `fetch`-based layer inside Next.js Route Handlers acts as a BFF for auth cookies
- **Real-time:** `@microsoft/signalr` — a broadcast hub (`/notify`) for live dashboard/module refresh and an authenticated hub (`/chat-hub`) for private chat
- **Rich text:** Tiptap
- **Charts & calendar:** Recharts, `react-big-calendar`
- **PWA:** installable manifest + a minimal service worker (for installability and backgrounded push-style alerts — the app has no offline mode, since almost everything is live/per-role data)
- **Other:** `date-fns`, `jsbarcode` (sample/lab labels), `xlsx` (bulk config-list import/export), `sonner` (toasts)

---

## Architecture

```
app/(auth)/     — public pages: login, forgot-password, register-company
app/(pages)/    — the authenticated app shell (~30 feature pages), gated by a client-side role/module guard
app/api/        — Next.js Route Handlers acting as a thin BFF (sets/clears httpOnly auth cookies)
proxy.ts        — Next.js middleware gating page navigation on the httpOnly auth cookie
components/     — shared UI: modals, pickers, printouts, rich text editor, sidebar, notification bell, etc.
hooks/          — idle logout, proactive token refresh, SignalR-driven refetching, unread counts, live permission sync
lib/            — Axios instance, SignalR connection managers, auth/logout, formatting & validation helpers
services/       — one file per backend domain (billing, chat, EMR, lab, nursing, pharmacy, radiology, roles, ...)
types/          — matching TypeScript definitions per domain
helpers/        — static config: the full sidebar/module registry, role icons, ID/locale formats
```

### Authentication & sessions

- Short-lived JWT access token stored in `localStorage` for Axios Bearer auth, mirrored into an httpOnly cookie so the Next.js middleware can gate navigation server-side.
- Refresh token lives **only** in an httpOnly, `sameSite=strict` cookie — never reachable from client JS.
- On a 401, the Axios interceptor silently refreshes (deduped across concurrent requests), retries once, and force-logs-out only if the refresh itself fails.
- The access token is also proactively refreshed every 20 minutes in the background, so a long-idle SignalR connection never reconnects with a stale token.
- Company-configurable idle timeout with a "stay signed in?" warning before auto-logout.

### Role-based access model

Every sidebar module is something a role can be granted access to via a server-stored per-role allow-list, synced at login and kept live over SignalR as admins change permissions. `admin` implicitly has every module. `Settings` and nurse-only `Confidential Notes` are hardcoded exceptions to the allow-list system; `Role Management` and `User Registration` are hardcoded admin-only.

---

## Getting started

### Prerequisites

- Node.js 18.18+ (Next.js 16 requirement)
- A running instance of [`yoton-api`](../yoton-api)

### Setup

```bash
npm install
```

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:5205   # base URL of a running yoton-api instance
```

### Run

```bash
npm run dev     # start the dev server (Turbopack) at http://localhost:3000
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
```

Sign in with an account seeded by `yoton-api`, or create a new clinic workspace from `/register-company`.

---

## Related repositories

- **yoton-api** — backend (ASP.NET Core / PostgreSQL)
- **yoton-mobile** — patient-facing mobile app (.NET MAUI)

Each is a separate Git repository with its own README and release cadence.
