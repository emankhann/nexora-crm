// End-to-end check that every kind of change is saved to the database (batch 3, part 2).
// Each step uses the UI the way a person would, then checks the API (or reloads the page)
// to prove the change reached MySQL and wasn't only shown on screen.
//
// Needs both servers running on a freshly seeded database, and Playwright:
//   cd backend && php artisan migrate:fresh --seed && php artisan serve
//   npm run dev
//   npm install --no-save playwright
//   node scripts/check-saving.mjs
// Safe to run more than once: everything it creates has a unique name.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const RUN = Date.now().toString(36);
const results = [];

const lead = { name: `E2E Lead ${RUN}`, company: `E2E Co ${RUN}`, email: `e2e-${RUN}@example.com` };
const bulk = { name: `E2E Bulk ${RUN}`, company: `E2E Bulk Co ${RUN}`, email: `e2e-bulk-${RUN}@example.com` };
const dealName = `E2E deal ${RUN}`;
const invite = { name: `E2E Invite ${RUN}`, email: `e2e-invite-${RUN}@example.com` };

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

async function check(name, fn) {
  try {
    await fn();
    results.push([true, name]);
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push([false, name]);
    console.log(`FAIL  ${name}\n      ${String(err?.message ?? err).split("\n")[0]}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

/** The first visible match (pages render phone cards and desktop tables side by side, one hidden). */
const visible = (locator) => locator.filter({ visible: true }).first();

/**
 * A form label matched exactly. Required fields end in " *", so that is optional, and
 * "Company" doesn't also match "Company size".
 */
const label = (text) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`);

async function signIn(page, email) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function ready(page) {
  await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
}

/** Reads GET /api/crm with the page's own session, i.e. what the database now holds. */
async function server(page) {
  return page.evaluate(async (api) => {
    const r = await fetch(`${api}/api/crm`, { credentials: "include", headers: { Accept: "application/json" } });
    return r.json();
  }, API);
}

/** Waits for the API request a click triggers, and fails if the server rejected it. */
async function saved(page, urlPart, action) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(urlPart) && r.request().method() !== "GET", { timeout: 15000 }),
    action(),
  ]);
  assert(res.ok(), `${res.request().method()} ${urlPart} answered ${res.status()}`);
}

async function newLeadViaForm(page, l) {
  await page.goto(`${BASE}/leads`);
  await ready(page);
  await visible(page.getByRole("button", { name: "+ New lead" })).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(label("Full name")).fill(l.name);
  await dialog.getByLabel(label("Company")).fill(l.company);
  await dialog.getByLabel(label("Email")).fill(l.email);
  await saved(page, "/api/leads", () => dialog.getByRole("button", { name: "Save lead" }).click());
}

const browser = await launch();
const pageErrors = [];

/* ------------------------------- Admin ------------------------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await signIn(page, "huma@nexora.example");

  await check("New lead is saved (still there after a reload, with a server-worked-out score)", async () => {
    await newLeadViaForm(page, lead);
    await page.reload();
    await ready(page);
    await visible(page.getByText(lead.name)).waitFor({ timeout: 10000 });
    const data = await server(page);
    const row = data.leads.find((l) => l.email === lead.email);
    assert(row, "lead not in the database");
    assert(row.score > 0, "lead has no score");
  });

  await check("Editing a lead is saved", async () => {
    await visible(page.getByRole("link", { name: new RegExp(lead.name) })).click();
    await page.waitForURL(/\/leads\/\d+/);
    await ready(page);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(label("Job title")).fill("Founder");
    await saved(page, "/api/leads/", () => dialog.getByRole("button", { name: "Save changes" }).click());
    const row = (await server(page)).leads.find((l) => l.email === lead.email);
    assert(row?.jobTitle === "Founder", `job title is "${row?.jobTitle}"`);
  });

  await check("Logging a call and adding a note are saved to the history", async () => {
    await page.getByRole("button", { name: "Log call" }).click();
    const dialog = page.getByRole("dialog");
    // Listen for the follow-up task before saving: it's sent right after the call, and
    // can finish before a listener added afterwards would start.
    const followUpTask = page.waitForResponse((r) => r.url().includes("/api/tasks") && r.request().method() === "POST", { timeout: 15000 });
    await saved(page, "/api/activities", () => dialog.getByRole("button", { name: /^Save call/ }).click());
    assert((await followUpTask).ok(), "the follow-up task wasn't saved");
    // The app reloads its data before closing the dialog; the page behind it can't be used until then.
    await dialog.waitFor({ state: "hidden", timeout: 15000 });
    await page.locator("#note").fill(`E2E note ${RUN}`);
    await saved(page, "/api/activities", () => page.getByRole("button", { name: "Save note" }).click());
    await page.reload();
    await ready(page);
    await visible(page.getByText(`E2E note ${RUN}`)).waitFor({ timeout: 10000 });
    await visible(page.getByText(/Call logged/)).waitFor({ timeout: 10000 });
  });

  await check("Logging a call moves a New lead to Contacted", async () => {
    // The lead was created as New; the call logged above should have moved it on.
    const row = (await server(page)).leads.find((l) => l.email === lead.email);
    assert(row?.status === "contacted", `status is "${row?.status}"`);
    await visible(page.getByText("Status changed from New to Contacted")).waitFor({ timeout: 10000 });
    await page.getByText("Next step: qualify.").waitFor({ timeout: 10000 });
  });

  await check("Creating and completing a task is saved", async () => {
    const data = await server(page);
    const leadId = data.leads.find((l) => l.email === lead.email).id;
    const before = data.tasks.filter((t) => t.leadId === leadId && !t.done).length;
    assert(before >= 1, "the follow-up task from the logged call is missing");
    await page.getByRole("button", { name: "+ Add task" }).click();
    await saved(page, "/api/tasks", () => page.getByRole("dialog").getByRole("button", { name: "Create task" }).click());
    let open = (await server(page)).tasks.filter((t) => t.leadId === leadId && !t.done);
    assert(open.length === before + 1, `expected ${before + 1} open tasks, found ${open.length}`);
    // click(), not check(): a completed task leaves the list, and the new task and the
    // follow-up have the same title, so check() would go on to tick the other one too.
    await saved(page, "/toggle", () => visible(page.getByRole("checkbox", { name: `Complete task: ${open[0].title}`, exact: true })).click());
    open = (await server(page)).tasks.filter((t) => t.leadId === leadId && !t.done);
    assert(open.length === before, `completing didn't save: ${open.length} open tasks`);
  });

  await check("Convert is disabled until the lead is qualified", async () => {
    const convert = page.getByRole("button", { name: "Convert to customer" });
    assert(await convert.isDisabled(), "Convert is enabled while the lead is only Contacted");
    await saved(page, "/api/leads/bulk", () => page.getByRole("button", { name: "Mark as qualified" }).click());
    await page.getByText("Ready to convert.").waitFor({ timeout: 10000 });
    assert(await convert.isEnabled(), "Convert is still disabled after Mark as qualified");
    const row = (await server(page)).leads.find((l) => l.email === lead.email);
    assert(row?.status === "qualified", `status is "${row?.status}"`);
  });

  await check("Converting a lead creates the customer and deal in the database", async () => {
    await page.getByRole("button", { name: "Convert to customer" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(label("Deal name")).fill(dealName);
    await dialog.getByLabel(label("Value (USD)")).fill("5000");
    await saved(page, "/convert", () => dialog.getByRole("button", { name: "Convert to customer" }).click());
    const data = await server(page);
    assert(data.leads.find((l) => l.email === lead.email)?.status === "converted", "lead isn't converted");
    assert(data.customers.some((c) => c.name === lead.company), "customer wasn't created");
    assert(data.deals.some((d) => d.title === dealName), "deal wasn't created");
  });

  await check("Editing a converted lead keeps it converted", async () => {
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(label("Job title")).fill("CEO");
    await saved(page, "/api/leads/", () => dialog.getByRole("button", { name: "Save changes" }).click());
    const row = (await server(page)).leads.find((l) => l.email === lead.email);
    assert(row.status === "converted" && row.jobTitle === "CEO", `status ${row.status}, title ${row.jobTitle}`);
  });

  await check("Marking a deal won on the pipeline is saved and adds to the customer's lifetime value", async () => {
    await page.goto(`${BASE}/pipeline`);
    await ready(page);
    await visible(page.getByRole("button", { name: `Actions for ${dealName}` })).click();
    await saved(page, "/move", () => page.getByRole("menuitem", { name: "Mark as won" }).click());
    const data = await server(page);
    assert(data.deals.find((d) => d.title === dealName)?.stage === "won", "deal isn't won");
    const customer = data.customers.find((c) => c.name === lead.company);
    assert(Number(customer.lifetimeValue) === 5000, `lifetime value is ${customer.lifetimeValue}`);
  });

  await check("Bulk assign is saved and emails the new owner", async () => {
    await newLeadViaForm(page, bulk);
    await page.goto(`${BASE}/leads`);
    await ready(page);
    await visible(page.getByRole("checkbox", { name: `Select ${bulk.name}` })).check();
    await page.getByRole("button", { name: "Assign owner" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Omar Tariq/ }).click(); // owner choices are a radio group
    assert(await dialog.getByRole("checkbox", { name: "Email the new owner" }).isChecked(), "Email the new owner isn't ticked by default");
    const request = page.waitForRequest((r) => r.url().includes("/api/leads/bulk") && r.method() === "POST");
    await saved(page, "/api/leads/bulk", () => dialog.getByRole("button", { name: /Assign to Omar/ }).click());
    const body = (await request).postDataJSON();
    assert(body.action === "assign" && body.notify === true, `the API was sent ${JSON.stringify(body)}`);
    await visible(page.getByText(/assigned to Omar T\. · we’ve emailed them/)).waitFor({ timeout: 10000 });
    // When the dialog closes the app also clears the selection, so wait for that before selecting again.
    await dialog.waitFor({ state: "hidden", timeout: 15000 });
    const row = (await server(page)).leads.find((l) => l.email === bulk.email);
    assert(row?.ownerName === "Omar T.", `owner is ${row?.ownerName}`);
  });

  await check("Bulk delete is saved", async () => {
    await visible(page.getByRole("checkbox", { name: `Select ${bulk.name}` })).check();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    // Confirmations are role="alertdialog".
    await saved(page, "/api/leads/bulk", () => page.getByRole("alertdialog").getByRole("button", { name: "Delete 1 lead" }).click());
    assert(!(await server(page)).leads.some((l) => l.email === bulk.email), "lead is still in the database");
  });

  await check("Inviting and cancelling a team member is saved", async () => {
    await page.goto(`${BASE}/team`);
    await ready(page);
    await page.getByRole("button", { name: "+ Invite member" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(label("Full name")).fill(invite.name);
    await dialog.getByLabel(label("Work email")).fill(invite.email);
    await saved(page, "/api/team/invite", () => dialog.getByRole("button", { name: "Send invite" }).click());
    // With email not set up (how these scripts run), the dialog shows the join link: close it.
    const done = dialog.getByRole("button", { name: "Done" });
    if (await done.waitFor({ timeout: 5000 }).then(() => true, () => false)) await done.click();
    await dialog.waitFor({ state: "hidden", timeout: 15000 });
    let member = (await server(page)).members.find((m) => m.email === invite.email);
    assert(member?.status === "pending", "invite not saved");
    // The member's row: the innermost visible element that holds both their email and a Cancel button.
    const cancel = page.getByRole("button", { name: "Cancel", exact: true });
    const row = page.locator("div").filter({ hasText: invite.email, visible: true }).filter({ has: cancel }).last();
    await row.getByRole("button", { name: "Cancel", exact: true }).click();
    await saved(page, "/api/team/", () => page.getByRole("alertdialog").getByRole("button", { name: "Cancel invite" }).click());
    member = (await server(page)).members.find((m) => m.email === invite.email);
    assert(!member, "invite is still there");
  });

  await check("Marking reminders as read is saved", async () => {
    await page.goto(`${BASE}/dashboard`);
    await ready(page);
    await visible(page.getByRole("button", { name: /^Notifications/ })).click();
    const markAll = page.getByRole("button", { name: "Mark all as read" });
    if (await markAll.isEnabled()) await saved(page, "/api/notifications/read", () => markAll.click());
    await page.reload();
    await ready(page);
    const label = await visible(page.getByRole("button", { name: /^Notifications/ })).getAttribute("aria-label");
    assert(!/unread/.test(label ?? ""), `bell still says "${label}"`);
  });

  await ctx.close();
}

/* ----------------------------- Sales rep ----------------------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await signIn(page, "sana@nexora.example");

  await check("Server validation errors show under the right field", async () => {
    // Ayesha Raza is Huma's lead, so Sana can't see it and only the server knows the email is taken.
    await page.goto(`${BASE}/leads`);
    await ready(page);
    await visible(page.getByRole("button", { name: "+ New lead" })).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(label("Full name")).fill("Duplicate Test");
    await dialog.getByLabel(label("Company")).fill("Duplicate Co");
    await dialog.getByLabel(label("Email")).fill("ayesha@cedarlogistics.example");
    await dialog.getByRole("button", { name: "Save lead" }).click();
    await dialog.getByText(/already been taken|already exists/i).waitFor({ timeout: 10000 });
    assert(await dialog.isVisible(), "the form should stay open");
  });

  await check("A sales rep's new task is saved and assigned to them", async () => {
    await page.goto(`${BASE}/tasks`);
    await ready(page);
    await visible(page.getByRole("button", { name: /New task/ })).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(label("What needs doing?")).fill(`E2E rep task ${RUN}`);
    await saved(page, "/api/tasks", () => dialog.getByRole("button", { name: "Create task" }).click());
    const task = (await server(page)).tasks.find((t) => t.title === `E2E rep task ${RUN}`);
    assert(task?.ownerName === "Sana M.", `task owner is ${task?.ownerName}`);
  });

  await ctx.close();
}

await browser.close();

await check("No JavaScript errors on any page", async () => {
  assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
});

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
