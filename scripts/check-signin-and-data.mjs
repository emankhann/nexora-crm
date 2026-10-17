// End-to-end check for real sign-in and data loading (batch 3, part 1).
//
// Needs: the API running (cd backend && php artisan serve) on a freshly seeded database
// (php artisan migrate:fresh --seed), the frontend running (npm run dev), and Playwright:
//   npm install --no-save playwright
//   node scripts/check-signin-and-data.mjs
// Prints PASS/FAIL per check and exits with code 1 if anything failed.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASSWORD = "demo1234";
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

async function signIn(page, email, password = PASSWORD) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

// Phones get card layouts and desktops get tables, so a name can appear twice on a page
// with one copy hidden. Text checks therefore wait for a visible match.
async function waitForData(page) {
  // The page content is hidden until GET /api/crm has loaded.
  await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
}

const browser = await launch();

/* ---------------- Signed out ---------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await check("Signed-out visit to /leads goes to /login and remembers the page", async () => {
    await page.goto(`${BASE}/leads`);
    await page.waitForURL(/\/login/);
    assert(page.url().includes("next=%2Fleads"), `expected ?next=/leads in ${page.url()}`);
  });

  await check("Wrong password shows the server's error and stays on /login", async () => {
    await signIn(page, "huma@nexora.example", "wrong-password");
    await page.getByRole("alert").filter({ hasText: /incorrect|attempts/i }).waitFor({ timeout: 10000 });
    assert(page.url().includes("/login"), "should still be on /login");
  });

  await check("Pending invite (kamran@nexora.example) cannot sign in", async () => {
    await signIn(page, "kamran@nexora.example");
    await page.getByRole("alert").waitFor({ timeout: 10000 });
    assert(page.url().includes("/login"), "should still be on /login");
  });

  await ctx.close();
}

/* ---------------- Admin ---------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await check("Admin signs in and lands on the dashboard with database data", async () => {
    await signIn(page, "huma@nexora.example");
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await waitForData(page);
    await page.getByText("Hot leads").filter({ visible: true }).first().waitFor();
    await page.getByText("Ayesha Raza").filter({ visible: true }).first().waitFor({ timeout: 10000 });
  });

  await check("Sign-in used a real Laravel session cookie (httpOnly)", async () => {
    const cookies = await ctx.cookies();
    const session = cookies.find((c) => /[-_]session$/.test(c.name) && c.name !== "nexora_session");
    assert(session, `no Laravel session cookie; cookies: ${cookies.map((c) => c.name).join(", ")}`);
    assert(session.httpOnly, "Laravel session cookie should be httpOnly");
    assert(!cookies.some((c) => c.name === "nexora_user"), "old demo cookie nexora_user should not be set");
  });

  await check("Revenue chart has history from the database (several months with revenue)", async () => {
    const bars = await page.locator("[title*=': $']").evaluateAll((els) => els.map((e) => e.getAttribute("title")));
    const withRevenue = bars.filter((t) => !/: \$0$/.test(t ?? ""));
    assert(withRevenue.length >= 6, `only ${withRevenue.length} months with revenue: ${bars.join(" | ")}`);
  });

  for (const [path, text] of [
    ["/leads", "Bilal Siddiqui"],
    ["/customers", "Meridian Textiles"],
    ["/pipeline", "Fleet tracking portal"],
    ["/tasks", "Send proposal to Cedar Logistics"],
    ["/reports", "Reports"],
    ["/team", "Kamran"],
    ["/audit-log", "Signed in"],
  ]) {
    await check(`Admin can open ${path} and sees "${text}"`, async () => {
      await page.goto(`${BASE}${path}`);
      await waitForData(page);
      await page.getByText(text).filter({ visible: true }).first().waitFor({ timeout: 10000 });
    });
  }

  await check("Lead detail page loads from the database", async () => {
    await page.goto(`${BASE}/leads`);
    await waitForData(page);
    await page.getByRole("link", { name: /Ayesha Raza/ }).first().click();
    await page.waitForURL(/\/leads\/\d+/);
    await page.getByRole("heading", { name: "Ayesha Raza" }).waitFor({ timeout: 10000 });
  });

  await check("Signed-in visit to /login goes to /dashboard", async () => {
    await page.goto(`${BASE}/login`);
    await page.waitForURL(/\/dashboard/);
  });

  await check("Expired session: API cookie gone → app sends you to /login", async () => {
    const hint = (await ctx.cookies()).filter((c) => c.name === "nexora_session");
    await ctx.clearCookies();
    await ctx.addCookies(hint); // the browser still "thinks" it's signed in
    await page.goto(`${BASE}/pipeline`);
    await page.waitForURL(/\/login/, { timeout: 15000 });
  });

  await ctx.close();
}

/* ---------------- Sign out ---------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await check("Sign out ends the session on the server too", async () => {
    await signIn(page, "omar@nexora.example");
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await waitForData(page);
    await page.getByRole("button", { name: /Omar Tariq/ }).first().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await page.waitForURL(/\/login/);
    const status = await page.evaluate(async (api) => {
      const r = await fetch(`${api}/api/me`, { credentials: "include", headers: { Accept: "application/json" } });
      return r.status;
    }, process.env.API_URL ?? "http://localhost:8000");
    assert(status === 401, `GET /api/me after sign-out returned ${status}, expected 401`);
  });

  await ctx.close();
}

/* ---------------- Sales rep ---------------- */
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await check("Sales rep sees only their own leads", async () => {
    await signIn(page, "sana@nexora.example");
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
    await page.goto(`${BASE}/leads`);
    await waitForData(page);
    await page.getByText("Hira Baig").filter({ visible: true }).first().waitFor({ timeout: 10000 });
    assert((await page.getByText("Ayesha Raza").count()) === 0, "Ayesha Raza (Huma's lead) should not be visible");
    assert((await page.getByText("Bilal Siddiqui").count()) === 0, "Bilal Siddiqui (Omar's lead) should not be visible");
  });

  await check("Sales rep is kept out of /team and /audit-log", async () => {
    await page.goto(`${BASE}/team`);
    await page.waitForURL(/\/forbidden/);
    await page.goto(`${BASE}/audit-log`);
    await page.waitForURL(/\/forbidden/);
  });

  await ctx.close();
}

await browser.close();

const failed = results.filter(([ok]) => !ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
