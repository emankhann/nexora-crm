// One-time setup for running Nexora CRM on your own computer.
//
//   npm run setup
//
// It checks PHP, Composer and Node.js, creates the two .env files if they don't exist,
// installs the PHP and JavaScript packages, creates the database and fills it with demo
// data. With the default settings the database is a single SQLite file
// (backend/database/database.sqlite), so no database server is needed.
//
// Running it again is safe, but it resets the database to the demo data.
// Works on Windows, macOS and Linux. Run it from the project root.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BACKEND = join(ROOT, "backend");
const WINDOWS = process.platform === "win32";

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function fail(message, hint) {
  console.error(`\n${red("✗")} ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

/** Runs a command. With quiet: true, returns its output instead of printing it. */
function run(cmd, args, { cwd = ROOT, quiet = false } = {}) {
  // On Windows, composer and npm are .bat/.cmd files, which need a shell to run. The shell gets
  // one command string (the arguments here are fixed, simple words), because Node warns about
  // passing an argument list together with shell: true.
  const options = { cwd, stdio: quiet ? "pipe" : "inherit", encoding: "utf8" };
  const r = WINDOWS ? spawnSync([cmd, ...args].join(" "), { ...options, shell: true }) : spawnSync(cmd, args, options);
  if (r.error && r.error.code === "ENOENT") return { ok: false, missing: true, out: "" };
  return { ok: r.status === 0, missing: false, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function step(title, cmd, args, cwd) {
  console.log(`\n${bold("▶ " + title)}`);
  const r = run(cmd, args, { cwd });
  if (!r.ok) fail(`${title} failed.`, "Read the messages above, fix the problem, then run `npm run setup` again.");
}

/** "8.3.12" >= "8.3" */
function atLeast(version, minimum) {
  const a = version.split(".").map(Number);
  const b = minimum.split(".").map(Number);
  for (let i = 0; i < b.length; i++) {
    if ((a[i] ?? 0) !== b[i]) return (a[i] ?? 0) > b[i];
  }
  return true;
}

if (!existsSync(join(BACKEND, "artisan"))) {
  fail("Run this from the project root (the folder with package.json and backend/).");
}

/* 1. Tools */
console.log(bold("Checking tools"));

const node = process.versions.node;
if (!atLeast(node, "20.9")) fail(`Node.js ${node} is too old.`, "Install Node.js 20.9 or newer (the LTS from nodejs.org).");
console.log(`  ${green("✓")} Node.js ${node}`);

const php = run("php", ["--version"], { quiet: true });
if (php.missing || !php.ok) fail("PHP was not found.", "Install PHP 8.3 or newer and make sure `php` works in a new terminal.");
const phpVersion = php.out.match(/PHP (\d+\.\d+\.\d+)/)?.[1] ?? "0";
if (!atLeast(phpVersion, "8.3")) fail(`PHP ${phpVersion} is too old.`, "Nexora's API needs PHP 8.3 or newer.");
console.log(`  ${green("✓")} PHP ${phpVersion}`);

const composer = run("composer", ["--version"], { quiet: true });
if (composer.missing || !composer.ok) fail("Composer was not found.", "Install Composer from getcomposer.org.");
console.log(`  ${green("✓")} ${composer.out.match(/Composer version \S+/)?.[0] ?? "Composer"}`);

/* 2. Settings files */
console.log(`\n${bold("▶ Settings")}`);
const backendEnv = join(BACKEND, ".env");
if (!existsSync(backendEnv)) {
  copyFileSync(join(BACKEND, ".env.example"), backendEnv);
  console.log(`  ${green("✓")} Created backend/.env from backend/.env.example`);
} else {
  console.log(`  ${green("✓")} backend/.env already exists, keeping it`);
}
const frontendEnv = join(ROOT, ".env.local");
if (!existsSync(frontendEnv)) {
  copyFileSync(join(ROOT, ".env.example"), frontendEnv);
  console.log(`  ${green("✓")} Created .env.local from .env.example`);
} else {
  console.log(`  ${green("✓")} .env.local already exists, keeping it`);
}

const env = readFileSync(backendEnv, "utf8");
const setting = (key) => env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
const connection = setting("DB_CONNECTION") || "sqlite";

if (connection === "sqlite") {
  const modules = run("php", ["-m"], { quiet: true }).out.toLowerCase();
  if (!modules.includes("pdo_sqlite")) {
    fail(
      "PHP's SQLite extension (pdo_sqlite) is not turned on.",
      "Open php.ini (`php --ini` shows where it is), remove the ; before `extension=pdo_sqlite` and `extension=sqlite3`, save, and open a new terminal. Or use MySQL: see \"Using MySQL\" in README.md."
    );
  }
  const file = setting("DB_DATABASE") || join(BACKEND, "database", "database.sqlite");
  if (!existsSync(file)) {
    writeFileSync(file, "");
    console.log(`  ${green("✓")} Created the SQLite database file (backend/database/database.sqlite)`);
  }
  console.log(`  ${green("✓")} Database: SQLite file, no server needed`);
} else {
  console.log(`  ${green("✓")} Database: ${connection} (${setting("DB_DATABASE") || "no DB_DATABASE set"} on ${setting("DB_HOST") || "127.0.0.1"})`);
  console.log("    The database must already exist and the DB_ settings in backend/.env must be right.");
}

/* 3. Packages */
step("Installing PHP packages (composer install)", "composer", ["install", "--no-interaction"], BACKEND);
if (!setting("APP_KEY")) step("Creating the app key", "php", ["artisan", "key:generate", "--no-interaction"], BACKEND);
step("Installing JavaScript packages (npm install)", "npm", ["install"], ROOT);

/* 4. Database */
step("Creating the tables and demo data (migrate:fresh --seed)", "php", ["artisan", "migrate:fresh", "--seed", "--no-interaction"], BACKEND);

console.log(`
${green(bold("✓ Nexora CRM is ready."))}

Start it with:
  ${bold("npm run dev:all")}

Then open ${bold("http://localhost:3000")} (use localhost, not 127.0.0.1) and sign in:
  Admin      huma@nexora.example
  Manager    omar@nexora.example
  Sales rep  sana@nexora.example
  Password   demo1234   (or click an account on the sign-in page)
`);
