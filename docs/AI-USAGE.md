# AI usage summary

## Tools I used

| Tool | What I used it for |
|---|---|
| **Claude** (Anthropic), in the Claude app | Understanding what a CRM needs, planning the architecture and database, designing the screens, and writing the code as patch files with step-by-step instructions. It also helped me write these docs. |
| **Claude Code** (Anthropic), the VS Code extension | Applying each patch to my project, running the tests and the browser check scripts, finding and fixing what failed, and committing to GitHub. |

I didn't use any other AI tools.

## How I worked

I used AI like a fast team member: it did a lot of the writing, but I gave the direction, made the decisions, and checked the results before anything was kept.

1. **Understanding the problem first.** Before building, I went through the brief point by point with Claude: what a CRM is, why businesses use one, which modules a professional CRM needs, and how sales, marketing, support and management each use it. I turned that into [CRM-CONCEPTS.md](CRM-CONCEPTS.md), which also maps every requirement in the brief to where it is in the app.

2. **Choosing the stack.** I chose **Next.js (React) + Laravel + MySQL**:
   - I already knew **React/Next.js** and **MySQL**, so I could understand and judge the frontend and the database.
   - **Laravel** was new to me. I chose it because it has what a business app needs built in (login, roles and permissions, validation, migrations, seed data, emails, scheduled jobs and tests), so the time went into CRM features instead of rebuilding those basics.
   - Laravel and React are both widely used in Pakistan, so this is a stack I'd actually work with.

   More detail is in [ARCHITECTURE.md](ARCHITECTURE.md#why-this-stack).

3. **Interface first, with sample data.** We built every screen with sample data first, so I could click through the workflows and change the design cheaply before any backend existed. Decisions I made at this stage:
   - **The green-and-black theme.** I had Claude mock up just the dashboard in it first, decided I liked it, and then had it applied to the whole app, with all the colours named in one file (`globals.css`) so they're easy to change.
   - **Responsive before the backend.** I wanted the app to work on phones before connecting it to the database, so the layout wouldn't need reworking later. I checked it myself in the browser's device mode at phone and tablet sizes.

4. **Backend, then connecting the two.** Next came the Laravel API, the database, migrations and demo data. Then the frontend was switched from sample data to the real API in small steps: sign-in and loading, then saving, then a security review.

5. **Small batches, each one tested.** Every change was one batch. Claude wrote a patch and a checklist; Claude Code applied it on a new branch, ran the backend tests, lint, the production build and the browser scripts, fixed anything that failed, and merged only when everything passed. I read every report, clicked through the changes myself as each role, and decided what to do next. For example, after the main features were done, I chose to fix the owner-name bug below before writing the documentation, because it affected data correctness.

## How errors were found and fixed

Most bugs were caught by the tests and by testing as different roles. Some examples:

| Problem | How it was found | Fix |
|---|---|---|
| Two people with the same short name ("Sana M.") were treated as one person, so a lead could be assigned to the wrong one | A React "duplicate key" warning during testing | Records now point to owners by **user id**, not by name; a backend test and a browser script reproduce the case |
| A few wrong sign-ins could block "Forgot password", because all the forms shared one rate-limit counter | The end-to-end check scripts failed after adding password reset ("Too many attempts") | A separate, named rate limit per form, plus a test that proves they're separate |
| Editing a converted lead reset its status | Security and logic review of the API | The edit form keeps Converted, and the API allows leaving status out for converted leads |
| An exported CSV could run a formula in Excel if a lead's name started with `=` | Security review | Cells starting with `=` or `@` (or `+`/`-` followed by anything but a number) are neutralised on export |
| A sales rep could, by sending ids directly, attach a deal to another rep's customer (adding to its lifetime value), link a task to someone else's deal, or merge their lead into another rep's customer | Security review | The API checks permission on every linked record, and adding to an existing customer needs edit rights on it |
| On phones, a long owner name made some pages scroll sideways | The responsive check script | Filters and dropdowns can shrink, and long names are cut short |
| Test flakiness: an expired-session test, and a reminder count that also read old log lines | Intermittent script failures | Wait for requests to finish before clearing cookies; only count log lines written during the run |
| PHP packages needed PHP 8.4, but the project said 8.3, so a reviewer on PHP 8.3 couldn't install it | Testing the setup on a fresh copy of the project | Composer is pinned to PHP 8.3, so it picks package versions that work on 8.3 and newer |

Problems I noticed myself:

- **The task list on phones.** The "·" separators between task details sometimes ended up alone at the end of a line. I asked for each separator to stay with the item after it, and it was fixed.
- **Customer contacts.** A long email address cut the contact's name short on the customer page. The email now goes on its own line under the name.

## How I checked the AI's work

- Nothing was merged unless the **47 backend tests**, **lint**, the **production build** and the **five browser scripts** all passed.
- I signed in as each role (Admin, Manager and Sales rep) and checked that each one sees and can do the right things.
- I tested the layout myself on phone and tablet sizes in the browser.
- Because Laravel was new to me, I went through the architecture and database with Claude, asking it to explain each part (the API structure, policies, migrations and how the frontend talks to the backend) until I could explain it back myself.

## What I learned

I learned that a CRM is really about making sure every lead and customer has an owner, a history and a next step, and that the reports only work if that data is kept up to date. Technically, I learned how Laravel handles security for me (cookie sessions, CSRF tokens, rate limits and permission checks on every request) and why the server must check permissions even when the interface hides a button. AI helped most with speed and with catching security issues I wouldn't have thought of. It needed the most checking on details: some bugs only appeared when the app was tested in a real browser, as different people.
