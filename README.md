# Nexora CRM

A sales CRM for managing leads, customers, deals and follow-up tasks, with role-based access for Admins, Managers and Sales reps.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. You'll be sent to the sign-in page.

### Demo accounts

All demo accounts use the password `demo1234`. On the sign-in page, click a demo account to fill in its details.

| Role      | Email                 | What they can do                                           |
| --------- | --------------------- | ---------------------------------------------------------- |
| Admin     | huma@nexora.example   | Everything, including Team and roles, Audit log and delete |
| Manager   | omar@nexora.example   | Sees the whole team's records, can reassign and export     |
| Sales rep | sana@nexora.example   | Sees and edits only their own leads, deals and tasks       |

## What's in the app

- **Sign in and roles.** Sign-in shows validation, a loading state and a lockout after 5 wrong attempts. There is a forgot-password page and sign-out. `proxy.ts` sends signed-out users to `/login` and keeps non-admins out of admin pages, which show a 403 page.
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

## How data works right now (frontend-first)

The app runs entirely in the browser for now:

- `lib/crm-store.ts` holds all records. It starts from the sample data in `lib/mock-data.ts` and saves changes to `localStorage`, so they survive a refresh. Every change goes through one function (`createLead`, `moveDeal`, `addFollowUp` and so on). When the database and API are added, each of those functions becomes one API call and the screens stay the same.
- `lib/session.ts` keeps the signed-in user in a cookie, and `proxy.ts` reads that cookie to protect routes. This stands in for real authentication. The backend will replace it with hashed passwords and a signed, httpOnly session cookie.
- `lib/permissions.ts` is the single permission table, matching the Team and roles page.
- To start over, an admin can open the account menu at the bottom of the sidebar and choose **Reset demo data**.

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
  session.ts        sign in/out
  permissions.ts    who can do what
  users.ts          demo accounts
  notifications.ts  reminders for the bell
  utils.ts, ui.ts, csv.ts, use-now.ts
proxy.ts            route protection
types/index.ts      shared types
```
