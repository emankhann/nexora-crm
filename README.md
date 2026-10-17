# Nexora CRM

A sales CRM for managing leads, customers, deals and follow-up tasks, with role-based access for Admins, Managers and Sales reps.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4.

## Run it locally

The app has two parts: the Next.js frontend (this folder) and the Laravel API in `backend/`. Both need to run.

**1. API and database** (needs PHP 8.3, Composer and MySQL):

```bash
cd backend
composer install
cp .env.example .env        # then set DB_DATABASE, DB_USERNAME, DB_PASSWORD
php artisan key:generate
php artisan migrate:fresh --seed
php artisan serve           # http://localhost:8000
```

**2. Frontend** (in a second terminal, from the project root):

```bash
npm install
cp .env.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open **http://localhost:3000** (use `localhost`, not `127.0.0.1`, so the browser shares the sign-in cookies with the API). You'll be sent to the sign-in page.

### Demo accounts

All demo accounts use the password `demo1234`. On the sign-in page, click a demo account to fill in its details.

| Role      | Email                 | What they can do                                           |
| --------- | --------------------- | ---------------------------------------------------------- |
| Admin     | huma@nexora.example   | Everything, including Team and roles, Audit log and delete |
| Manager   | omar@nexora.example   | Sees the whole team's records, can reassign and export     |
| Sales rep | sana@nexora.example   | Sees and edits only their own leads, deals and tasks       |

## What's in the app

- **Sign in and roles.** Sign-in checks the user in the database, shows validation, a loading state and a 15-minute lockout after 5 wrong attempts. There is a forgot-password page and sign-out. `proxy.ts` sends signed-out users to `/login` and keeps non-admins out of admin pages, which show a 403 page.
- **Dashboard.** Live stats, a revenue chart, the lead funnel, hot leads, your tasks due today, a "Needs attention" list and recent activity.
- **Leads.** Create, edit and delete leads, with validation and duplicate-email checks. Assign an owner, change status in bulk, search, filter and page through results. Import and export CSV.
- **Lead scoring.** New leads get an explainable score built from source, status, company size, job title and contact details.
- **Lead detail.** Log a call, email or meeting (with an optional follow-up task), add notes, convert the lead to a customer (optionally creating a deal), and see linked deals and tasks.
- **Customers.** Create and edit customers. Each has a profile page with communication history, contacts, deals, open tasks and the lead they came from.
- **Pipeline.** Six stages including Won and Lost. Cards show the close date, probability and overdue status. Move deals by drag-and-drop or with the card menu. A deal panel lets you edit the deal or mark it won or lost (lost needs a reason).
- **Tasks.** Each task has an assignee, due date and time, priority, type and reminder. Tasks can be snoozed, completed and undone. A follow-up history logs each attempt and reschedules the task.
- **Reminders.** The bell shows overdue tasks, tasks whose reminder time has come, records assigned to you, and deals past their close date.
- **Search.** Press Ctrl K (⌘K on a Mac) to search leads, customers, deals and tasks, or to run quick actions.
- **Reports.** Pipeline summary by stage, lead conversion by source, and team performance. Filter by period and owner, and export to CSV.
- **Audit log.** Every create, edit, reassignment, stage move and deletion is recorded.
- **Responsive.** On phones the sidebar becomes a drawer and tables turn into cards. Pages have empty, loading and error states.

## How data works

- **Sign-in** uses Laravel Sanctum: the API sets an httpOnly session cookie that JavaScript can't read, and requests that change data carry a CSRF token. `lib/api.ts` handles both. `lib/session.ts` signs in and out and keeps the signed-in user for the UI.
- **Route protection.** `proxy.ts` redirects early using a small hint cookie (just the role) set after sign-in. The real check happens in the API on every request; if it answers 401, the app clears the session and goes to `/login`.
- **Data.** After sign-in, `lib/crm-store.ts` loads everything the user may see in one request (`GET /api/crm`), filtered on the server by role. `lib/api-mappers.ts` converts the API's JSON into the records the screens use.
- **Permissions.** `lib/permissions.ts` decides what the UI shows. The API enforces the same rules (`backend/app/Policies` and the Gates in `AppServiceProvider`).
- **Saving changes.** In progress: every change goes through one store function (`createLead`, `moveDeal`, `addFollowUp` and so on), and each is being switched to its API request. Until that is finished, changes made in the UI are not saved to the database and are gone after a refresh.

## Project structure

```
app/
  (auth)/login, forgot-password   sign-in pages
  (app)/…                         signed-in pages (dashboard, leads, customers, pipeline, tasks, reports, team, audit-log)
  (app)/forbidden                 403 page
components/
  layout/    AppShell, Sidebar, NotificationsBell, CommandSearch, PageHeader
  ui/        Modal (dialog and slide-over), Field, Toast, ConfirmDialog, States, Badge, Avatar
  leads/ customers/ pipeline/ tasks/ reports/ dashboard/ activity/ audit/
lib/
  crm-store.ts      data and actions
  session.ts        sign in/out, signed-in user
  permissions.ts    who can do what
  api.ts            API requests (Sanctum cookies, CSRF, errors)
  api-mappers.ts    API JSON → screen records
  users.ts          team directory and demo accounts
  notifications.ts  reminders for the bell
  utils.ts, ui.ts, csv.ts, use-now.ts
proxy.ts            route protection
backend/            Laravel API and MySQL database
types/index.ts      shared types
```
