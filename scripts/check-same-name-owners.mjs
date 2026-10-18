// End-to-end check that records point to owners by user id, not by short name.
//
// It invites a second person whose short name is also "Sana M." (the seeded Sana Mirza
// is the first), then checks that the two are told apart everywhere: pickers, filters,
// assigning a lead, and who can see it. Before owners were ids, both people were the
// same "Sana M." to the app: React warned about duplicate keys and an assignment
// could land on the wrong person.
//
// Needs both servers running on a seeded database, and Playwright:
//   cd backend && php artisan migrate:fresh --seed && php artisan serve
//   npm run dev
//   npm install --no-save playwright
//   node scripts/check-same-name-owners.mjs
// Run it from the project root: it reads the invite link from backend/storage/logs/laravel.log.
// Safe to run more than once: each run invites a new person and creates a new lead.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const LOG = join(process.cwd(), "backend", "storage", "logs", "laravel.log");
const RUN = Date.now().toString(36);
// "Sana <run> Mughal" → short name "Sana M.", the same as the seeded Sana Mirza.
const twin = { name: `Sana ${RUN} Mughal`, email: `e2e-sana-${RUN}@example.com`, password: `Twin${RUN}9` };
const leadName = `E2E Owner Lead ${RUN}`;
const results = [];

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

async function emailLink(email, kind) {
  for (let i = 0; i < 20; i++) {
    const lines = readFileSync(LOG, "utf8").split(/\r?\n/).filter((l) => l.includes(`Email link for ${email} (${kind}): `));
    if (lines.length) return lines.at(-1).split(`(${kind}): `)[1].trim();
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no "${kind}" email for ${email} in ${LOG}`);
}

const field = (scope, label) => scope.getByLabel(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\*?$`));
const visible = (locator) => locator.filter({ visible: true }).first();

async function signIn(page, email, password = "demo1234") {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
}

async function openPage(page, path) {
  await page.goto(`${BASE}${path}`);
  await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
}

async function apiCall(page, method, path, body) {
  return page.evaluate(
    async ({ api, method, path, body }) => {
      const raw = document.cookie.split("; ").find((c) => c.startsWith("XSRF-TOKEN="));
      const xsrf = raw ? decodeURIComponent(raw.slice("XSRF-TOKEN=".length)) : "";
      const r = await fetch(`${api}/api${path}`, {
        method,
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-XSRF-TOKEN": xsrf, "X-Requested-With": "XMLHttpRequest" },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, json: await r.json().catch(() => null) };
    },
    { api: API, method, path, body }
  );
}

/** Collects React's "two children with the same key" warnings and page crashes. */
function watch(page, bucket) {
  page.on("console", (m) => {
    if (m.type() === "error" && /same key/i.test(m.text())) bucket.push(`${page.url()}: ${m.text().slice(0, 160)}`);
  });
  page.on("pageerror", (e) => bucket.push(`${page.url()}: ${e.message}`));
}

const browser = await launch();
const problems = [];

const admin = await (await browser.newContext()).newPage();
watch(admin, problems);
await signIn(admin, "huma@nexora.example");

let twinId = null;
let sanaId = null;
let leadId = null;

await check(`Invite a second "Sana M." (${twin.name}) and they join`, async () => {
  const res = await apiCall(admin, "POST", "/team/invite", { name: twin.name, email: twin.email, role: "sales_rep" });
  assert(res.status === 201 || res.status === 200, `invite returned ${res.status}: ${JSON.stringify(res.json)}`);
  const page = await (await browser.newContext()).newPage();
  await page.goto(await emailLink(twin.email, "Invite"));
  await field(page, "Password").fill(twin.password);
  await field(page, "Confirm new password").fill(twin.password);
  await page.getByRole("button", { name: "Join Nexora" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.context().close();

  const crm = await apiCall(admin, "GET", "/crm");
  const members = crm.json?.members ?? [];
  twinId = members.find((m) => m.email === twin.email)?.id ?? null;
  sanaId = members.find((m) => m.email === "sana@nexora.example")?.id ?? null;
  assert(twinId && sanaId, "could not find both people in /api/crm members");
  const shorts = members.filter((m) => m.id === twinId || m.id === sanaId).map((m) => m.short);
  assert(shorts[0] === shorts[1], `expected the same short name, got ${shorts.join(" and ")}`);
});

await check("Owner filters list both people, told apart by email", async () => {
  await openPage(admin, "/leads");
  const texts = await admin.locator("main select option").allTextContents();
  const sanas = texts.filter((t) => t.startsWith("Sana M."));
  assert(sanas.some((t) => t.includes("sana@nexora.example")), `options: ${sanas.join(" | ")}`);
  assert(sanas.some((t) => t.includes(twin.email)), `options: ${sanas.join(" | ")}`);
});

await check("A new lead assigned to the second Sana is saved under their id", async () => {
  const res = await apiCall(admin, "POST", "/leads", {
    name: leadName,
    email: `e2e-owner-${RUN}@example.com`,
    company: "Owner Check Ltd",
    source: "website",
    status: "new",
    owner_id: null,
  });
  assert(res.status === 201, `creating the lead returned ${res.status}`);
  leadId = res.json?.data?.id;

  await openPage(admin, `/leads/${leadId}`);
  await admin.getByRole("button", { name: "Change owner" }).click();
  const dialog = admin.getByRole("dialog");
  await dialog.getByRole("radio", { name: new RegExp(twin.name) }).click();
  const saved = admin.waitForResponse((r) => r.url().includes("/api/leads/bulk") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: /^Assign to Sana/ }).click();
  assert((await saved).ok(), "assign request failed");
  await dialog.waitFor({ state: "hidden", timeout: 10000 });

  const crm = await apiCall(admin, "GET", "/crm");
  const lead = (crm.json?.leads ?? []).find((l) => l.id === leadId);
  assert(lead?.ownerId === twinId, `lead owner is ${lead?.ownerId}, expected ${twinId} (Sana Mirza is ${sanaId})`);
});

await check("The second Sana sees the lead; Sana Mirza does not", async () => {
  const twinPage = await (await browser.newContext()).newPage();
  watch(twinPage, problems);
  await signIn(twinPage, twin.email, twin.password);
  await openPage(twinPage, "/leads");
  await visible(twinPage.getByText(leadName)).waitFor({ timeout: 10000 });
  assert((await twinPage.getByText("Hira Baig").count()) === 0, "the second Sana can see Sana Mirza's lead Hira Baig");
  await twinPage.context().close();

  const sana = await (await browser.newContext()).newPage();
  watch(sana, problems);
  await signIn(sana, "sana@nexora.example");
  await openPage(sana, "/leads");
  await visible(sana.getByText("Hira Baig")).waitFor({ timeout: 10000 });
  assert((await sana.getByText(leadName).count()) === 0, "Sana Mirza can see the lead assigned to the other Sana");
  await sana.context().close();
});

await check("A task assigned to the second Sana keeps its assignee when edited", async () => {
  const due = new Date(Date.now() + 2 * 864e5).toISOString();
  const res = await apiCall(admin, "POST", "/tasks", {
    title: `E2E twin task ${RUN}`,
    type: "call",
    priority: "medium",
    due_at: due,
    reminder: "none",
    remind_by_email: false,
    assigned_to: twinId,
    lead_id: leadId,
  });
  assert(res.status === 201, `creating the task returned ${res.status}: ${JSON.stringify(res.json?.errors ?? res.json)}`);
  const taskId = res.json?.data?.id;
  await openPage(admin, `/tasks?open=${taskId}`);
  await admin.getByRole("button", { name: "Edit" }).first().click();
  const form = admin.getByRole("dialog").filter({ hasText: "Edit task" });
  const selected = await form.getByLabel(/^Assign to/).inputValue();
  assert(selected === String(twinId), `the form picked owner ${selected}, expected ${twinId}`);
  const saved = admin.waitForResponse((r) => r.url().includes(`/api/tasks/${taskId}`) && r.request().method() === "PUT");
  await form.getByRole("button", { name: "Save task" }).click();
  assert((await saved).ok(), "saving the task failed");
  const crm = await apiCall(admin, "GET", "/crm");
  const task = (crm.json?.tasks ?? []).find((t) => t.id === taskId);
  assert(task?.assignedTo === twinId, `task is now assigned to ${task?.assignedTo}, expected ${twinId}`);
});

await check("No duplicate-key warnings or crashes on any page", async () => {
  for (const path of ["/dashboard", "/leads", "/customers", "/pipeline", "/tasks", "/reports", "/team"]) {
    await openPage(admin, path);
    await admin.waitForTimeout(300);
  }
  assert(problems.length === 0, problems.slice(0, 3).join(" || "));
});

await browser.close();

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
