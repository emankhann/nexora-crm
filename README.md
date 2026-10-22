# Nexora CRM

A sales CRM for managing leads, customers, deals and follow-up tasks, with role-based access for Admins, Managers and Sales reps.

**Frontend:** Next.js 16, React 19, TypeScript, Tailwind CSS 4 · **API:** Laravel 13 (PHP 8.3) with Sanctum · **Database:** MySQL or SQLite

![Dashboard](docs/screenshots/dashboard.png)

| Leads | Pipeline | Customer profile |
|---|---|---|
| ![Leads](docs/screenshots/leads.png) | ![Pipeline](docs/screenshots/pipeline.png) | ![Customer profile](docs/screenshots/customer-profile.png) |

| Tasks | Reports | On a phone |
|---|---|---|
| ![Tasks](docs/screenshots/tasks.png) | ![Reports](docs/screenshots/reports.png) | ![Phone](docs/screenshots/phone-dashboard.png) |

## Documentation

| | |
|---|---|
| [User guide](docs/USER-GUIDE.md) | How to use every module, what each role can do, and a five-minute tour |
| [Architecture](docs/ARCHITECTURE.md) | How the app is built, why this stack, how the modules interact, security, and how it would scale |
| [Database](docs/DATABASE.md) | Diagram of every table and relationship, design decisions, and the demo data |
| [CRM concepts](docs/CRM-CONCEPTS.md) | What a CRM is for, how each department benefits, and where every requirement of the brief lives |
| [AI usage](docs/AI-USAGE.md) | Which AI tools were used and how |

## Getting started

About 15 minutes the first time, most of it waiting for downloads. **You don't need to install a database:** Nexora keeps its data in one file that setup creates for you.

### Step 1: Install the tools (once per computer)

| You need | How to check | How to install |
|---|---|---|
| **Node.js** 20.9 or newer | `node -v` | Download the **LTS** installer from [nodejs.org](https://nodejs.org) and run it. |
| **PHP** 8.3 or newer | `php -v` | **Windows, easiest:** install [Laravel Herd](https://herd.laravel.com) (free). It installs PHP **and** Composer with everything this project needs. Other options: [Installing PHP on Windows](#installing-php-on-windows). **macOS:** `brew install php composer`. |
| **Composer** | `composer --version` | Comes with Laravel Herd. Otherwise run **Composer-Setup.exe** from [getcomposer.org](https://getcomposer.org). |

**After installing, close and reopen your terminal and VS Code**, then run the three checks in the table. Each should print a version number. If one says *"not recognized"*, that tool isn't installed yet or the terminal was opened before installing it.

### Step 2: Open the project

1. Unzip `nexora-crm.zip` (or `git clone https://github.com/emankhann/nexora-crm.git`).
2. In VS Code: **File → Open Folder** and choose the **`nexora-crm`** folder (the one that contains `package.json` and `backend`).
3. Open a terminal in VS Code: **Terminal → New Terminal** (or **Ctrl + `**).
4. VS Code may suggest installing **SQLite Viewer**. Click **Install**: it lets you look at the data later.

### Step 3: Set it up (once)

In the terminal, run:

```
npm run setup
```

It checks your tools, installs everything, and creates the database with demo data. It takes 3 to 7 minutes. **You need an internet connection**: setup downloads the PHP and JavaScript packages the project uses.

- If it says **"PHP needs a few extensions turned on"**, press **Y**. It fixes PHP's settings for you and carries on.
- It's done when it says **"✓ Nexora CRM is ready."**
- If it stops with an error, read the message: it says exactly what to do. After fixing it, run `npm run setup` again. See also [Troubleshooting](#troubleshooting).

### Step 4: Start Nexora

```
npm run dev:all
```

Wait until the lines starting with `web` say **Ready** (about 10 seconds), then open **http://localhost:3000** in your browser. Use `localhost`, not `127.0.0.1`.

**Windows:** the first time, Windows Defender Firewall may ask whether Node.js may use the network. Either answer works: Nexora runs on your own computer (`localhost`), and allowing it only lets other devices on your network open it too. If you allow it, choose **Private networks** only.

Sign in by clicking a demo account on the sign-in page (password **`demo1234`**):

| Role | Email | What they can do |
|---|---|---|
| Admin | huma@nexora.example | Everything, including Team and roles, the Audit log and deleting records |
| Manager | omar@nexora.example | Sees the whole team's records, can reassign and export |
| Sales rep | sana@nexora.example | Sees and edits only their own leads, deals and tasks |

New to the app? Follow the [five-minute tour](docs/USER-GUIDE.md#13-a-five-minute-tour).

### Step 5: Stop it, and start it again later

- **To stop:** press **Ctrl + C** in the terminal. On Windows it asks *"Terminate batch job (Y/N)?"*: press **Y**.
- **Next time:** only `npm run dev:all`. Setup is only needed once.
- **To reset the demo data:** run `npm run setup` again. It deletes everything you added and puts the demo data back.

### Looking at the data

The whole database is one file: **`backend/database/database.sqlite`**. It's a binary file, so it looks like gibberish in a normal text tab.

1. In VS Code, install **SQLite Viewer** (Extensions, **Ctrl + Shift + X**, search "SQLite Viewer"), if you didn't in Step 2.
2. Right-click `backend/database/database.sqlite` → **Open With…** → **SQLite Viewer**.
3. Pick a table on the left (`leads`, `customers`, `deals`, `tasks`, `users`…) to see its rows. After you change something in the app, close and reopen the file to see the update.

What each table holds: [docs/DATABASE.md](docs/DATABASE.md).

### Emails

By default, emails (invites, password resets, task reminders, new-task emails, the daily overdue summary, lead assignments) are **not sent**. They're written to `backend/storage/logs/laravel.log`, so no mail account is needed. Open that file and look for the last line with `Email link for`, then copy the link into your browser. To send real emails, see [Sending real emails](#sending-real-emails).

## More options

### Using MySQL

**Optional.** You only need this if you prefer MySQL to the default SQLite file. Reviewers can skip it. Do these steps **instead of Step 3** of Getting started.

**You need:** MySQL Server running on your computer (installed with MySQL Workbench, XAMPP or similar), and its username and password (often `root`).

**A. Create an empty database.** In MySQL Workbench, connect to your local server, open a new query tab, run this, then refresh the schema list:

```sql
CREATE DATABASE nexora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**B. Create the settings file before running setup.**

1. In VS Code, in the `backend` folder, copy `.env.example` and name the copy exactly `.env` (right-click → Copy, right-click `backend` → Paste, then rename).
2. Open `backend/.env` and replace the database lines with:
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=nexora
   DB_USERNAME=root
   DB_PASSWORD="your MySQL password"
   ```
   If your MySQL user has no password, write `DB_PASSWORD=`. Make sure the old `DB_CONNECTION=sqlite` line is gone.
3. Save the file.

**C. Run setup:** `npm run setup`

- It says "backend/.env already exists, keeping it" and "Database: mysql (nexora …)".
- If it says PHP needs a few extensions turned on, with `pdo_mysql` under "Missing", press **Y**.
- It creates every table and the demo data in your `nexora` database, then says "✓ Nexora CRM is ready."

Then continue with Step 4 (`npm run dev:all`). To see the data, refresh the `nexora` schema in MySQL Workbench.

| If you see | Fix |
|---|---|
| `Unknown database 'nexora'` | Step A wasn't done, or the name differs from `DB_DATABASE` |
| `Access denied for user 'root'` | Wrong `DB_PASSWORD` in `backend/.env` |
| `No connection could be made` / `Connection refused` | MySQL isn't running: start it from Windows Services or XAMPP |
| `could not find driver` | `pdo_mysql` is off: run `npm run setup` again and press **Y** |

**Note:** `npm run setup` resets the database to the demo data each time. After the first time, start Nexora with only `npm run dev:all`.

### Running the parts separately

`npm run dev:all` runs these three for you. To run them in three separate terminals instead, each starting in the project root:

```bash
# Terminal 1: the API on http://localhost:8000
cd backend
php artisan serve

# Terminal 2: sends task reminder emails when they're due
cd backend
php artisan schedule:work

# Terminal 3: the app on http://localhost:3000
npm run dev
```

### Emails when running locally

Each email written to `backend/storage/logs/laravel.log` also gets one readable line with its link, for example:

```
Email link for ali@nexora.example (Invite): http://localhost:3000/accept-invite?token=…&email=…
```

- **Invite someone:** Team and roles → *+ Invite member*, then open the link from the log in a private window. They choose a password and are signed in.
- **Forgot password:** on the sign-in page, then open the reset link from the log. Links work once, for 60 minutes.
- **Task reminders:** tasks with email reminders on send an email when the reminder time comes, while the scheduler runs. To send due reminders right away, from the backend folder, run `php artisan nexora:send-task-reminders`.
- **New tasks:** creating a task for someone else (or giving them an existing one) with *Email the assignee* ticked emails them a link to the task. Nobody is emailed about tasks they assign to themselves.
- **Overdue summary:** at 9:00 every morning (in `LOCAL_TIMEZONE` from `backend/.env`), each person with overdue tasks that have email reminders on gets one email listing them. It goes out at most once a day. To send it right away, for a test or a demo, from the backend folder, run `php artisan nexora:send-overdue-summaries`.
- **Leads assigned:** assigning leads to someone else with *Email the new owner* ticked emails them one message listing the leads.

### Sending real emails

The emails are real Laravel notifications; only the delivery is a setting. To have invites, password resets, task reminders, new-task emails, the daily overdue summary and lead assignments arrive in a real inbox, sent from a Gmail account:

1. Turn on **2-Step Verification** on your Google account, then create an **app password** at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (name it "Nexora"). Use it, not your normal Gmail password.
2. Open `backend/.env` and replace the `MAIL_` lines with this block, using your address and app password:
   ```
   MAIL_MAILER=smtp
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_SCHEME=null
   MAIL_USERNAME=you@gmail.com
   MAIL_PASSWORD="your 16-character app password"
   MAIL_FROM_ADDRESS="you@gmail.com"
   MAIL_FROM_NAME="Nexora CRM"
   ```
3. In `.env.local`, set `NEXT_PUBLIC_EMAILS_IN_LOG=false`.
4. From the backend folder, run `php artisan config:clear`, then restart `npm run dev:all` from the project root.
5. Test it: from the backend folder, run `php artisan nexora:send-test-email you@gmail.com`.

Invites, password resets, task reminders, new-task emails, the daily overdue summary and lead assignments now arrive in real inboxes, sent from your Gmail. Your password stays in `backend/.env`, which Git never commits.

For production, use the same settings with a mail service such as Resend, Brevo or Mailgun (see "Before going live").

- The links in the emails point to `http://localhost:3000`, so open them on the computer running the app.
- **Demo accounts never get real emails.** Addresses on reserved test domains (`.example`, `.test`, `.invalid`, `.localhost`, and `example.com/.net/.org`), like `huma@nexora.example`, can't receive email, so Nexora doesn't send to them (they would only come back as bounces). Their "Email link for …" line is still written to `backend/storage/logs/laravel.log`, so you can open the link from there. In an email to several people, only the reserved addresses are dropped.
- **Switch back to `MAIL_MAILER=log` (and `NEXT_PUBLIC_EMAILS_IN_LOG=true`) before running the check scripts.** They were written for the log mailer and read the links from the log.

## Installing PHP on Windows

You need Node.js and PHP 8.3 or newer with Composer. If Node.js isn't installed, get the LTS version from [nodejs.org](https://nodejs.org).

**Option A, easiest (recommended): Laravel Herd.**

1. Download [Laravel Herd](https://herd.laravel.com) (free), install it, and open it once. It installs PHP 8.3+ and Composer with all the extensions this project needs, and adds them to PATH.
2. Close and reopen your terminal (and VS Code), then check:
   ```
   php -v
   composer --version
   ```
3. Run `npm run setup` in the project folder.

**Option B: PHP by hand.**

1. Download PHP 8.3 or newer from [windows.php.net/download](https://windows.php.net/download): the **VS16 x64 Non Thread Safe** zip. Unzip it to `C:\php`.
2. Add `C:\php` to PATH: Start → "Edit the system environment variables" → **Environment Variables** → **Path** → **New** → `C:\php`.
3. Install Composer with **Composer-Setup.exe** from [getcomposer.org](https://getcomposer.org).
4. Close and reopen the terminal and VS Code, then run `npm run setup`. It finds anything PHP still needs and offers to turn it on for you.

For the record, these are the `php.ini` lines setup turns on:

```
extension_dir = "ext"
extension=curl
extension=fileinfo
extension=mbstring
extension=openssl
extension=pdo_sqlite
extension=sqlite3
extension=zip
```

and `extension=pdo_mysql` when you use MySQL.

**XAMPP:** only if its PHP is 8.3 or newer (check with `php -v`). Many XAMPP versions ship PHP 8.2, which is too old for this project.

## What's in the app

- **Dashboard:** live stats, 12-month revenue chart, lead funnel, hot leads, deals closing soon, team results, your tasks due today, *Needs attention* and recent activity.
- **Leads:** create, edit, search, filter, assign, bulk actions, CSV import and export, and an explainable lead score. Log calls, emails and meetings with a follow-up task, and convert a lead into a customer and a deal in one step.
- **Customers:** company profiles with contacts, the full communication history (including from when they were a lead), deals, open tasks, health and lifetime value.
- **Pipeline:** six stages from New to Won and Lost, drag and drop, probability by stage, close dates, lost reasons.
- **Tasks and follow-ups:** assignee, due time, priority, reminders in the app and by email, a follow-up history with outcomes, snooze, complete and undo.
- **Reports:** pipeline summary, lead conversion by source, and team performance, filtered by period and owner, with CSV export.
- **Users and security:** Admin, Manager and Sales rep roles enforced by the API; invites by email; password reset and change; sign-in lockout; audit log of every change.
- **Everywhere:** Ctrl K search, a reminders bell, and layouts that work on phones, tablets and laptops.

More in the [user guide](docs/USER-GUIDE.md).

## Tests

**Backend** (47 tests, on an in-memory SQLite database, nothing to set up):

```bash
cd backend
php artisan test
cd ..
```

**End to end.** Five scripts drive a real browser through the running app. First start the app on freshly seeded data:

```bash
cd backend
php artisan migrate:fresh --seed
cd ..
npm run dev:all
```

Then, in a second terminal in the project root, install Playwright once and run each script from the table below, for example:

```bash
npm install --no-save playwright
node scripts/check-signin-and-data.mjs
```

| Script | Checks |
|---|---|
| `node scripts/check-signin-and-data.mjs` | Sign-in, lockout, what each role can open, data loaded from the database, sign-out, expired sessions (19 checks) |
| `node scripts/check-saving.mjs` | Creating, editing, moving, converting and deleting records through the UI, and taking a lead through its stages (16) |
| `node scripts/check-account-and-emails.mjs` | Invites, password reset, change password, customer delete, reminder, new-task and overdue-summary emails (11) |
| `node scripts/check-same-name-owners.mjs` | Two people with the same short name are kept apart (6) |
| `node scripts/check-responsive.mjs` | Every page and dialog at phone, tablet and laptop sizes, with screenshots (38) |

`npm run lint` and `npm run build` (which type-checks everything) should also pass. `node scripts/take-screenshots.mjs` refreshes the screenshots in `docs/screenshots`.

## Project structure

```
app/                  pages (Next.js App Router)
  (auth)/             sign in, forgot and reset password, accept invite
  (app)/              the signed-in app: dashboard, leads, customers, pipeline, tasks, reports, team, audit-log
components/           screens and dialogs per module, plus shared ui/ and layout/
lib/                  crm-store (data and actions), api client, mappers, session, permissions, notifications
types/                shared TypeScript types
proxy.ts              route protection
backend/              Laravel API
  app/                controllers, requests, resources, policies, services, models, enums, notifications
  database/           migrations, seeders
  routes/             api.php, console.php (scheduler)
  tests/Feature/      API tests
docs/                 documentation, screenshots and SQL copies of the schema and demo data
scripts/              setup, dev, end-to-end checks and screenshots
```

## Troubleshooting

`npm run doctor` checks everything setup needs and lists what's missing, without changing anything.

| You see | Fix |
|---|---|
| `PHP was not found` / `'php' is not recognized` | Install PHP (see [Installing on Windows](#installing-php-on-windows)), then close and reopen the terminal and VS Code. |
| `Composer was not found` | Install Composer with Composer-Setup.exe from getcomposer.org, then reopen the terminal. |
| `PHP needs a few extensions turned on` | Answer **Y** and setup turns them on, or follow the lines it prints. |
| `requires ext-fileinfo … missing from your system` | The same: run `npm run setup` again and answer **Y**, or turn on `extension=fileinfo` in php.ini. |
| `The zip extension and unzip/7z commands are both missing` | The same, for `extension=zip`. |
| `running scripts is disabled on this system` (PowerShell, when running `npm`) | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or use Command Prompt. |
| `Port 8000 is already in use` / `Port 3000 is already in use` | Something already runs there, often Nexora in another terminal. Close it, or stop it there with `Ctrl+C`. |
| `Setup couldn't write …php.ini (no permission to change it)` | Open the terminal as Administrator and run `npm run setup` again, or make the change by hand as it shows. |
| `Couldn't load your data` / `Can't reach the Nexora server at http://localhost:8000` | The API isn't running. Start Nexora with `npm run dev:all` (not just `npm run dev`), and check the lines starting with `api` for an error. Open the app at `http://localhost:3000`, not `127.0.0.1`. Then click **Try again**. |
| Setup failed halfway | Fix the reported problem and run `npm run setup` again. It's safe to repeat (it resets the demo data). |

Don't use `composer update` or `--ignore-platform-reqs` to get past a missing extension: that installs different package versions or hides the problem until the app runs. The fix is turning the extension on.

## Before going live

The settings above are for running on your own computer. On a real server:

- **Backend `.env`:** `APP_ENV=production`, `APP_DEBUG=false` (otherwise error pages show internal details), a real `APP_URL`, and MySQL.
- **HTTPS everywhere**, plus `SESSION_SECURE_COOKIE=true` so the session cookie is only sent over HTTPS.
- **Domains:** set `FRONTEND_URL`, `SANCTUM_STATEFUL_DOMAINS` and `SESSION_DOMAIN` to the real ones. The app and the API must share a parent domain, for example `app.example.com` and `api.example.com` with `SESSION_DOMAIN=.example.com`.
- **Frontend:** set `NEXT_PUBLIC_API_URL` to the API's address, keep `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false`, and run `npm run build`, then `npm start`.
- **No demo data.** `php artisan db:seed` refuses to create the demo accounts in production, because their password is public. Create the first admin by hand.
- **Email:** set `MAIL_MAILER` and the `MAIL_*` settings for a real mail service (for example Resend, Brevo or Mailgun), and run the scheduler with a cron entry for `php artisan schedule:run` every minute.
