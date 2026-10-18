// Takes the screenshots used in README.md and docs/USER-GUIDE.md, signed in as the
// demo admin, and saves them to docs/screenshots/.
//
// Needs both servers running on a freshly seeded database (npm run dev:all after
// `cd backend && php artisan migrate:fresh --seed`), and Playwright:
//   npm install --no-save playwright
//   node scripts/take-screenshots.mjs
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

// The Next.js development badge in the corner isn't part of the app.
const HIDE_DEV_BADGE = "nextjs-portal { display: none !important; }";

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch {
    return await chromium.launch();
  }
}

async function ready(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  if (!/\/(login|forgot-password)/.test(page.url())) {
    await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
  }
  await page.addStyleTag({ content: HIDE_DEV_BADGE });
  await page.waitForTimeout(700);
}

async function shoot(page, name, { fullPage = false } = {}) {
  await ready(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`saved ${OUT}/${name}.png`);
}

async function signIn(page) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill("huma@nexora.example");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

/** Opens the first link matching `selector` on `from`. */
async function openFirst(page, from, selector) {
  await page.goto(`${BASE}${from}`);
  await ready(page);
  const href = await page.locator(selector).first().getAttribute("href");
  await page.goto(`${BASE}${href}`);
}

const browser = await launch();

/* Laptop */
{
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await page.goto(`${BASE}/login`);
  await shoot(page, "login");
  await signIn(page);
  await shoot(page, "dashboard");
  await page.goto(`${BASE}/leads`);
  await shoot(page, "leads");
  await openFirst(page, "/leads", "a[href^='/leads/']:has-text('Ayesha Raza')");
  await shoot(page, "lead-detail");
  // Orbit Studios has the fullest profile in the demo data: history, two contacts, open and won deals, a task.
  await openFirst(page, "/customers", "a[href^='/customers/']:has-text('Orbit Studios')");
  await shoot(page, "customer-profile");
  await page.goto(`${BASE}/pipeline`);
  await shoot(page, "pipeline");
  await page.goto(`${BASE}/tasks`);
  await shoot(page, "tasks");
  await page.goto(`${BASE}/reports`);
  await shoot(page, "reports");
  await page.goto(`${BASE}/team`);
  await shoot(page, "team");
  await page.close();
}

/* Phone */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await signIn(page);
  await shoot(page, "phone-dashboard");
  await page.goto(`${BASE}/pipeline`);
  await shoot(page, "phone-pipeline");
  await ctx.close();
}

await browser.close();
