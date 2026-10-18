# AI usage summary

> ✏️ **DRAFT. Rewrite this in your own words before submitting, and delete this box.** Every ✏️ marks something only you can answer. The reviewers will ask about this page, so it must describe what *you* actually did and decided. Search the file for ✏️ to check none are left.

## Tools I used

| Tool | What I used it for |
|---|---|
| **Claude** (Anthropic), in the Claude app | Researching how CRMs work, planning the architecture and database, designing the screens, and writing the code as patch files with step-by-step instructions. Also these docs. |
| **Claude Code** (Anthropic), the VS Code extension | Applying each patch to my project, running the tests and the end-to-end scripts, finding and fixing what failed, and committing to GitHub. |
| ✏️ Any others? (ChatGPT, Copilot, Cursor…) | ✏️ What for? Delete this row if none. |

## How I worked

I treated the AI as a fast team member whose work I had to direct and check, not as something that builds the app for me.

1. **Understanding the problem first.** ✏️ How you researched what a CRM is and what the brief needed (for example: asked Claude to explain CRM modules and how sales, marketing, support and management use them; compared with CRMs you know). The result is [CRM-CONCEPTS.md](CRM-CONCEPTS.md).
2. **Choosing the stack.** ✏️ Why Next.js + Laravel + MySQL, in your words (see "Why this stack" in [ARCHITECTURE.md](ARCHITECTURE.md#why-this-stack)). Mention anything you already knew and anything new to you.
3. **Interface first, with sample data.** We built every screen with in-memory data so I could click through the workflows and change the design cheaply before any backend existed. ✏️ Design decisions you made, for example the green-and-black theme (I had Claude mock up the dashboard in it first, liked it, then applied it to the whole app with the colours named in one file) and making it responsive before starting the backend.
4. **Backend, then connecting the two.** The Laravel API, database, migrations and seed data came next, then the frontend was switched from sample data to the API in small steps: sign-in and loading, then saving, then a security review.
5. **Small batches, each one tested.** Every change was one batch: Claude wrote a patch and a checklist; Claude Code applied it on a new branch, ran the backend tests, lint, build and the browser scripts, fixed failures, and merged only when everything passed. I read each report and decided what came next. ✏️ Say what you checked yourself (for example, clicking through as each role after each batch).

## How errors were found and fixed

Most bugs were caught by tests or by testing as different roles, not by me spotting them in the code. Some examples I can explain:

| Problem | How it was found | Fix |
|---|---|---|
| Two people with the same short name ("Sana M.") were treated as one person, so a lead could be assigned to the wrong one | A React "duplicate key" warning during testing | Records now point to owners by **user id**; a backend test and a browser script reproduce the case |
| A few wrong sign-ins could block "Forgot password", because all the forms shared one rate-limit counter | The end-to-end check scripts failed after adding password reset ("Too many attempts") | A separate, named rate limit per form, plus a test that proves they're separate |
| Editing a converted lead reset its status | Security and logic review of the API | The edit form keeps Converted, and the API allows leaving status out for converted leads |
| An exported CSV could run a formula in Excel if a lead's name started with `=` | Security review | Cells starting with `=` or `@` (or `+`/`-` followed by anything but a number) are neutralised on export |
| A sales rep could, by sending ids directly, attach a deal to another rep's customer (adding to its lifetime value), link a task to someone else's deal, or merge their lead into another rep's customer | Security review | The API checks permission on every linked record, and adding to an existing customer needs edit rights on it |
| On phones, a long owner name made some pages scroll sideways | The responsive check script | Filters and dropdowns can shrink, and long names are cut short |
| Test flakiness: an expired-session test and a reminder count that also read old log lines | Intermittent script failures | Wait for requests to finish before clearing cookies; only count log lines written during the run |

✏️ Add one or two problems *you* noticed yourself (something that looked wrong, felt confusing, or that you asked to change), and how it was resolved.

## How I checked the AI's work

- Nothing was merged without the **29 backend tests**, **lint**, the **production build** and the **five browser scripts** passing.
- Every role was tried by hand: Admin, Manager and Sales rep see and can do different things.
- ✏️ How you made sure you understand the code: for example, reading the main files (`lib/crm-store.ts`, the controllers, policies and migrations), and asking Claude to explain anything unclear until you could explain it back.

## What I learned

✏️ Two or three honest sentences. For example: what you learned about CRMs, about Laravel or Next.js, about security (CSRF, httpOnly cookies, rate limits), and where AI helped most and where it needed the most checking.
