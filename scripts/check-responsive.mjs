// Opens every page of the app at phone, tablet and laptop sizes, saves a full-page
// screenshot of each, and reports anything that makes the whole page scroll sideways.
//
// Needs the API (cd backend && php artisan serve) and the dev server (npm run dev)
// running, and Playwright:
//   npm install --no-save playwright
//   node scripts/check-responsive.mjs
// Screenshots go to responsive-screenshots/ (not committed).
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "responsive-screenshots";
const SIZES = [
  { name: "phone", width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "tablet", width: 768, height: 1024, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: "laptop", width: 1280, height: 800 },
];
// Pages to check. "first:" entries open the first matching link on that page.
const PAGES = [
  ["dashboard", "/dashboard"],
  ["leads", "/leads"],
  ["lead-detail", "first:/leads|a[href^='/leads/']"],
  ["customers", "/customers"],
  ["customer-profile", "first:/customers|a[href^='/customers/']"],
  ["pipeline", "/pipeline"],
  ["tasks", "/tasks"],
  ["reports", "/reports"],
  ["team", "/team"],
  ["audit-log", "/audit-log"],
];

mkdirSync(OUT, { recursive: true });

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome" }); // your installed Chrome
  } catch {
    return await chromium.launch(); // Playwright's own Chromium, if installed
  }
}

/** Elements that stick out past the right edge and are not inside a sideways-scrolling box. */
async function overflowReport(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const pageScrolls = document.documentElement.scrollWidth > vw + 1;
    const inScroller = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") return true;
      }
      return false;
    };
    const describe = (el) => {
      const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 4).join(".") : "";
      const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> "${text}" (right edge ${Math.round(el.getBoundingClientRect().right)}px)`;
    };
    const offenders = [];
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.right <= vw + 1) continue;
      if (getComputedStyle(el).position === "fixed" || inScroller(el)) continue;
      // Report the outermost offender only.
      if (offenders.some((o) => o.contains(el))) continue;
      offenders.push(el);
    }
    return { pageScrolls, viewport: vw, scrollWidth: document.documentElement.scrollWidth, offenders: offenders.slice(0, 5).map(describe) };
  });
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  // App pages load their data from the API and stay hidden until it arrives.
  if (!/\/(login|forgot-password)/.test(page.url())) {
    await page.locator("main h1").first().waitFor({ state: "visible", timeout: 15000 });
  }
  await page.waitForTimeout(600);
}

/** Signs in through the form as the admin demo user, like a person would. */
async function signIn(page) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill("huma@nexora.example");
  await page.locator("#password").fill("demo1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

const browser = await launch();
const problems = [];
let shots = 0;

for (const size of SIZES) {
  const { name: sizeName, ...viewport } = size;
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.hasTouch ?? false,
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
  });
  const page = await ctx.newPage();

  const check = async (label) => {
    await settle(page);
    const report = await overflowReport(page);
    await page.screenshot({ path: `${OUT}/${sizeName}-${label}.png`, fullPage: true });
    shots++;
    const ok = !report.pageScrolls && report.offenders.length === 0;
    console.log(`${ok ? "OK  " : "FAIL"} ${sizeName.padEnd(6)} ${label}`);
    if (!ok) problems.push({ size: sizeName, page: label, ...report });
  };

  // Signed out: sign-in page
  await page.goto(`${BASE}/login`);
  await check("login");

  await signIn(page);

  for (const [label, target] of PAGES) {
    if (target.startsWith("first:")) {
      const [from, selector] = target.slice(6).split("|");
      await page.goto(`${BASE}${from}`);
      await settle(page);
      const href = await page.locator(selector).first().getAttribute("href").catch(() => null);
      if (!href) { console.log(`SKIP ${sizeName.padEnd(6)} ${label} (no link found on ${from})`); continue; }
      await page.goto(`${BASE}${href}`);
    } else {
      await page.goto(`${BASE}${target}`);
    }
    await check(label);
  }

  // A dialog: + New lead
  await page.goto(`${BASE}/leads`);
  await settle(page);
  const newLead = page.getByRole("button", { name: "+ New lead" }).first();
  if (await newLead.isVisible().catch(() => false)) {
    await newLead.click();
    await check("dialog-new-lead");
  }

  // Phone and tablet: the slide-out menu
  if (viewport.width < 1024) {
    await page.goto(`${BASE}/dashboard`);
    await settle(page);
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible().catch(() => false)) {
      await menu.click();
      await check("menu-open");
    }
  }

  await ctx.close();
}

await browser.close();

console.log(`\nSaved ${shots} screenshots to ${OUT}/`);
if (problems.length === 0) {
  console.log("No page scrolls sideways at any size.");
} else {
  console.log(`\n${problems.length} page(s) scroll sideways or have content past the right edge:`);
  for (const p of problems) {
    console.log(`\n- ${p.size} / ${p.page}: page is ${p.scrollWidth}px wide in a ${p.viewport}px screen`);
    for (const o of p.offenders) console.log(`    ${o}`);
  }
  process.exitCode = 1;
}
