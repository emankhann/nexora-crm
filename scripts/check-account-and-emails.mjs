// End-to-end check for invites, password reset, changing your password, deleting a customer
// and task reminder emails. Emails go to backend/storage/logs/laravel.log (MAIL_MAILER=log);
// this script reads the links from there, the same way a person testing locally would.
//
// Needs both servers running on a seeded database, and Playwright:
//   cd backend && php artisan migrate:fresh --seed && php artisan serve
//   npm run dev
//   npm install --no-save playwright
//   node scripts/check-account-and-emails.mjs
// Safe to run more than once: the people and records it creates have unique names.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:8000";
const BACKEND = join(process.cwd(), "backend");
const LOG = join(BACKEND, "storage", "logs", "laravel.log");
const RUN = Date.now().toString(36);
const invitee = { name: `E2E Joiner ${RUN}`, email: `e2e-join-${RUN}@example.com` };
const passwords = { first: `Welcome${RUN}1`, reset: `Reset${RUN}2`, changed: `Changed${RUN}3` };
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

/** The newest "Email link for <email> (<kind>): <url>" line in the Laravel log. */
async function emailLink(email, kind) {
  for (let i = 0; i < 20; i++) {
    const lines = readFileSync(LOG, "utf8").split(/\r?\n/).filter((l) => l.includes(`Email link for ${email} (${kind}): `));
    if (lines.length) return lines.at(-1).split(`(${kind}): `)[1].trim();
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no "${kind}" email for ${email} in ${LOG}`);
}

/** A form field by its label, ignoring the " *" on required fields. */
const field = (scope, label) => scope.getByLabel(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\*?$`));
const visible = (locator) => locator.filter({ visible: true }).first();

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
}

/** Calls the API with the page's session and CSRF token. */
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

const browser = await launch();
const pageErrors = [];

const admin = await (await browser.newContext()).newPage();
admin.on("pageerror", (e) => pageErrors.push(e.message));
await signIn(admin, "huma@nexora.example", "demo1234");

await check("An admin's invite emails a join link", async () => {
  await admin.goto(`${BASE}/team`);
  await admin.locator("main h1").first().waitFor();
  await admin.getByRole("button", { name: "+ Invite member" }).click();
  const dialog = admin.getByRole("dialog");
  await field(dialog, "Full name").fill(invitee.name);
  await field(dialog, "Work email").fill(invitee.email);
  await dialog.getByRole("button", { name: "Send invite" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  const link = await emailLink(invitee.email, "Invite");
  assert(link.startsWith(`${BASE}/accept-invite?`), `unexpected link ${link}`);
});

const joiner = await (await browser.newContext()).newPage();
joiner.on("pageerror", (e) => pageErrors.push(e.message));

await check("The invited person joins from the link and lands on the dashboard", async () => {
  await joiner.goto(await emailLink(invitee.email, "Invite"));
  await joiner.getByRole("heading", { name: /Welcome, E2E/ }).waitFor({ timeout: 15000 });
  await field(joiner, "Password").fill(passwords.first);
  await field(joiner, "Confirm new password").fill(passwords.first);
  await joiner.getByRole("button", { name: "Join Nexora" }).click();
  await joiner.waitForURL(/\/dashboard/, { timeout: 15000 });
  await visible(joiner.getByText(invitee.name)).waitFor({ timeout: 15000 });
});

await check("An invite link can't be used twice", async () => {
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto(await emailLink(invitee.email, "Invite"));
  await fresh.getByRole("heading", { name: "This invite link doesn’t work" }).waitFor({ timeout: 15000 });
  await fresh.context().close();
});

await check("Forgot password emails a link that sets a new password", async () => {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${BASE}/forgot-password`);
  await page.locator("#reset-email").fill(invitee.email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor({ timeout: 15000 });
  await page.goto(await emailLink(invitee.email, "Password reset"));
  await field(page, "New password").fill(passwords.reset);
  await field(page, "Confirm new password").fill(passwords.reset);
  await page.getByRole("button", { name: "Save new password" }).click();
  await page.getByRole("heading", { name: "Password changed" }).waitFor({ timeout: 15000 });
  await signIn(page, invitee.email, passwords.reset);
  await page.context().close();
});

await check("Resetting the password signed the person out everywhere", async () => {
  const me = await apiCall(joiner, "GET", "/me");
  assert(me.status === 401, `the old session still works (GET /api/me → ${me.status})`);
});

await check("Changing your own password needs the current one, then the new one works", async () => {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, invitee.email, passwords.reset);
  await visible(page.getByRole("button", { name: new RegExp(invitee.name) })).click();
  await page.getByRole("menuitem", { name: "Change password" }).click();
  const dialog = page.getByRole("dialog");
  await field(dialog, "Current password").fill("not-my-password1");
  await field(dialog, "New password").fill(passwords.changed);
  await field(dialog, "Confirm new password").fill(passwords.changed);
  await dialog.getByRole("button", { name: "Change password" }).click();
  await dialog.getByText("That isn’t your current password.").waitFor({ timeout: 10000 });
  await field(dialog, "Current password").fill(passwords.reset);
  await dialog.getByRole("button", { name: "Change password" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.context().close();
  const again = await (await browser.newContext()).newPage();
  await signIn(again, invitee.email, passwords.changed);
  await again.context().close();
});

await check("An admin can delete a customer; its deals stay but are unlinked", async () => {
  const created = await apiCall(admin, "POST", "/customers", {
    name: `E2E Customer ${RUN}`, industry: "Retail", contact: { name: "E2E Contact", email: `e2e-cust-${RUN}@example.com` },
  });
  assert(created.status === 201, `creating the customer returned ${created.status}`);
  const id = created.json.data.id;
  const deal = await apiCall(admin, "POST", "/deals", {
    title: `E2E Deal ${RUN}`, company: `E2E Customer ${RUN}`, value: 1000, stage: "proposal",
    expected_close_date: new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10), customer_id: id,
  });
  assert(deal.status === 201, `creating the deal returned ${deal.status}`);
  await admin.goto(`${BASE}/customers/${id}`);
  await admin.getByRole("button", { name: "Delete this customer" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Delete customer" }).click();
  await admin.waitForURL(/\/customers$/, { timeout: 15000 });
  const data = (await apiCall(admin, "GET", "/crm")).json;
  assert(!data.customers.some((c) => c.id === id), "customer still there");
  const kept = data.deals.find((d) => d.id === deal.json.data.id);
  assert(kept && kept.customerId === null, "the deal should stay, without a customer");
});

await check("A task whose reminder time has come sends one reminder email", async () => {
  const me = (await apiCall(admin, "GET", "/me")).json.data;
  const task = await apiCall(admin, "POST", "/tasks", {
    title: `E2E reminder ${RUN}`, type: "call", priority: "high", reminder: "1h", remind_by_email: true,
    due_at: new Date(Date.now() + 30 * 60e3).toISOString(), assigned_to: me.id,
  });
  assert(task.status === 201, `creating the task returned ${task.status}`);
  const line = `Email link for ${me.email} (Task reminder): ${BASE}/tasks?open=${task.json.data.id}`;
  const count = () => readFileSync(LOG, "utf8").split(line).length - 1;
  execFileSync("php", ["artisan", "nexora:send-task-reminders"], { cwd: BACKEND, stdio: "pipe" });
  assert(count() === 1, `expected one reminder email for the task, found ${count()}`);
  execFileSync("php", ["artisan", "nexora:send-task-reminders"], { cwd: BACKEND, stdio: "pipe" });
  assert(count() === 1, "the reminder was sent twice");
});

await browser.close();

await check("No JavaScript errors on any page", async () => {
  assert(pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
});

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
