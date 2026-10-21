// One-time setup for running Nexora CRM on your own computer.
//
//   npm run setup     check everything, then install and create the demo database
//   npm run doctor    only check, and report what's missing (installs and changes nothing)
//
// It checks Node.js, PHP, Composer and every PHP extension the project needs, all at once, before
// installing anything. If PHP extensions are missing, it lists them in one message and offers to
// turn them on in php.ini (after backing it up). Then it creates the two .env files if they don't
// exist, installs the PHP and JavaScript packages, creates the database and fills it with demo
// data. With the default settings the database is a single SQLite file
// (backend/database/database.sqlite), so no database server is needed.
//
// Running it again is safe, but it resets the database to the demo data.
// Works on Windows, macOS and Linux. Run it from the project root. Node built-ins only.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";

const ROOT = process.cwd();
const BACKEND = join(ROOT, "backend");
const WINDOWS = process.platform === "win32";
const MAC = process.platform === "darwin";
const CHECK_ONLY = process.argv.includes("--check");

// Colours, unless the user has asked for none (NO_COLOR).
const paint = (code) => (s) => (process.env.NO_COLOR ? s : `\x1b[${code}m${s}\x1b[0m`);
const bold = paint(1);
const green = paint(32);
const red = paint(31);
const ok = (s) => console.log(`  ${green("✓")} ${s}`);

function fail(message, hint) {
  console.error(`\n${red("✗")} ${message}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

/** Quotes an argument for the Windows shell when it needs it (the PHP probe, paths with spaces). */
const quote = (a) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

/** Runs a command. With quiet: true, returns its output instead of printing it. */
function run(cmd, args, { cwd = ROOT, quiet = false } = {}) {
  // On Windows, composer and npm (and php, with some installers) are .bat/.cmd files, which need a
  // shell to run. The shell gets one command string, because Node warns about passing an argument
  // list together with shell: true.
  const options = { cwd, stdio: quiet ? "pipe" : "inherit", encoding: "utf8" };
  const r = WINDOWS ? spawnSync([cmd, ...args].map(quote).join(" "), { ...options, shell: true }) : spawnSync(cmd, args, options);
  if (r.error && r.error.code === "ENOENT") return { ok: false, missing: true, out: "", stdout: "" };
  // "is not recognized" is how the Windows shell says a command doesn't exist.
  const missing = WINDOWS && r.status !== 0 && /is not recognized as an internal or external command/i.test(r.stderr ?? "");
  return { ok: r.status === 0, missing, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, stdout: r.stdout ?? "" };
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

/** True if a program can be found on PATH. */
function onPath(name) {
  const r = WINDOWS ? spawnSync("where", [name], { stdio: "ignore" }) : spawnSync("sh", ["-c", `command -v ${name}`], { stdio: "ignore" });
  return r.status === 0;
}

/** Everything about the PHP on PATH, from one `php -r` call. Null if PHP doesn't run. */
function probePhp() {
  const code =
    "echo json_encode(['version'=>PHP_VERSION,'binary'=>PHP_BINARY,'ini'=>php_ini_loaded_file(),'extDir'=>ini_get('extension_dir'),'exts'=>array_map('strtolower',get_loaded_extensions())]);";
  const r = run("php", ["-r", code], { quiet: true });
  if (r.missing) return null;
  // Startup warnings (an extension that can't load) can come before the JSON.
  const json = r.stdout.match(/\{.*\}\s*$/s)?.[0];
  if (!json) return { broken: r.out.trim().split(/\r?\n/).slice(0, 3).join(" ") };
  return JSON.parse(json);
}

/** "ext-zend-opcache" and "Zend OPcache" both become "zend-opcache". */
const extKey = (name) => name.toLowerCase().replace(/^ext-/, "").replace(/[\s_]+/g, "-");

/**
 * Extensions composer.lock needs that this PHP lacks. Asks `composer check-platform-reqs`; when
 * Composer can't answer (it refuses to run at all without openssl, which is common on a bare PHP),
 * reads the ext-* requirements from composer.lock directly.
 */
function lockRequirements(loaded) {
  const lockFile = join(BACKEND, "composer.lock");
  if (!existsSync(lockFile)) return { missing: [], other: [] };
  const missing = [];
  const other = [];
  let entries = null;
  if (composerOk) {
    const r = run("composer", ["check-platform-reqs", "--lock", "--format=json", "--no-interaction"], { cwd: BACKEND, quiet: true });
    try {
      entries = JSON.parse(r.stdout.slice(r.stdout.indexOf("[")));
    } catch {
      // Older Composer without --format: read the text table ("ext-fileinfo  n/a  … missing").
      for (const line of r.out.split(/\r?\n/)) {
        const m = line.match(/^(ext-[\w-]+)\s.*\bmissing\b/);
        if (m) missing.push(extKey(m[1]));
      }
      if (missing.length) return { missing, other };
    }
  }
  if (!entries) {
    const lock = JSON.parse(readFileSync(lockFile, "utf8"));
    const packages = [...(lock.packages ?? []), ...(lock["packages-dev"] ?? [])];
    // Polyfill packages provide some extensions (symfony/polyfill-mbstring provides ext-mbstring).
    const provided = new Set(packages.flatMap((p) => [...Object.keys(p.provide ?? {}), ...Object.keys(p.replace ?? {})]).filter((n) => n.startsWith("ext-")).map(extKey));
    const required = new Set([...packages.flatMap((p) => Object.keys(p.require ?? {})), ...Object.keys(lock.platform ?? {})].filter((n) => n.startsWith("ext-")).map(extKey));
    const have = new Set(loaded.map(extKey));
    return { missing: [...required].filter((e) => !have.has(e) && !provided.has(e)).map((e) => e.replace(/-/g, "_")), other };
  }
  for (const e of entries) {
    if (e.status === "missing" && e.name.startsWith("ext-")) missing.push(extKey(e.name).replace(/-/g, "_"));
    else if (e.status !== "success" && e.status !== "missing" && e.name !== "php") other.push(`${e.name} ${e.version}: ${e.failed_requirement?.source ?? ""} needs ${e.failed_requirement?.constraint ?? "another version"}`.trim());
  }
  return { missing, other };
}

/** A setting from backend/.env, or from backend/.env.example when .env doesn't exist yet. */
function backendSetting(key) {
  const file = existsSync(join(BACKEND, ".env")) ? join(BACKEND, ".env") : join(BACKEND, ".env.example");
  const env = existsSync(file) ? readFileSync(file, "utf8") : "";
  return env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim().replace(/^"|"$/g, "") ?? "";
}

/** Asks a question in the terminal. Resolves to the answer, or null when there's no one to answer. */
function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    let answered = false;
    rl.on("line", (line) => {
      answered = true;
      if (!process.stdin.isTTY) process.stdout.write("\n"); // a typed answer ends its own line

      rl.close();
      resolve(line.trim());
    });
    rl.on("close", () => {
      if (!answered) {
        process.stdout.write("\n");
        resolve(null);
      }
    });
    process.stdout.write(question);
  });
}

const timestamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/**
 * Turns extensions on in php.ini text: removes the ; from ";extension=<name>", or adds the line at
 * the end of the extensions section. On Windows it can also set extension_dir = "ext".
 */
function enableInIni(text, names, setExtDir) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  let out = text;
  const lastExtensionLine = () => [...out.matchAll(/^;?[ \t]*extension[ \t]*=.*$/gm)].at(-1);
  for (const name of names) {
    const active = new RegExp(`^[ \\t]*extension[ \\t]*=[ \\t]*"?(php_)?${name}(\\.dll|\\.so)?"?[ \\t]*(;.*)?$`, "m");
    if (active.test(out)) continue; // already on in php.ini; if it still doesn't load, the .dll is missing
    const commented = new RegExp(`^;[ \\t]*extension[ \\t]*=[ \\t]*"?(php_)?${name}(\\.dll|\\.so)?"?[ \\t]*(;.*)?$`, "m");
    if (commented.test(out)) {
      out = out.replace(commented, `extension=${name}`);
      continue;
    }
    const last = lastExtensionLine();
    if (last) {
      const at = last.index + last[0].length;
      out = `${out.slice(0, at)}${eol}extension=${name}${out.slice(at)}`;
    } else {
      out = `${out.replace(/\s*$/, "")}${eol}extension=${name}${eol}`;
    }
  }
  if (setExtDir) {
    if (/^;[ \t]*extension_dir[ \t]*=[ \t]*"ext"[ \t]*$/m.test(out)) out = out.replace(/^;[ \t]*extension_dir[ \t]*=[ \t]*"ext"[ \t]*$/m, 'extension_dir = "ext"');
    else if (/^[ \t]*extension_dir[ \t]*=.*$/m.test(out)) out = out.replace(/^[ \t]*extension_dir[ \t]*=.*$/m, 'extension_dir = "ext"');
    else out = `extension_dir = "ext"${eol}${out}`;
  }
  return out;
}

/* ----------------------------------------------------------------------------------------------- */

if (!existsSync(join(BACKEND, "artisan"))) {
  fail("Run this from the project root (the folder with package.json and backend/).");
}

console.log(bold(CHECK_ONLY ? "Checking what Nexora needs (nothing will be installed or changed)" : "Checking tools"));

/** Problems that stop setup, each with how to fix it. Collected so they're all reported at once. */
const problems = [];

const node = process.versions.node;
if (atLeast(node, "20.9")) ok(`Node.js ${node}`);
else problems.push([`Node.js ${node} is too old.`, "Install Node.js 20.9 or newer (the LTS from nodejs.org), then close and reopen the terminal."]);

const installPhp = WINDOWS
  ? [
      "Install PHP 8.3 or newer. The easiest way on Windows is Laravel Herd (herd.laravel.com, free), which installs PHP and Composer with everything this project needs. Or see \"Installing PHP on Windows\" in README.md.",
      "If you just installed PHP, close and reopen the terminal (and VS Code) so it's found.",
    ]
  : [MAC ? "Install PHP 8.3 or newer and Composer: brew install php composer" : "Install PHP 8.3 or newer and Composer with your distribution's packages (for example php-cli, php-sqlite3, php-mbstring, php-xml, php-curl, php-zip and composer)."];

const php = probePhp();
if (!php) problems.push(["PHP was not found.", ...installPhp]);
else if (php.broken) problems.push([`PHP is installed but doesn't run properly: ${php.broken}`, ...installPhp]);
else if (!atLeast(php.version, "8.3")) problems.push([`PHP ${php.version} is too old. Nexora's API needs PHP 8.3 or newer.`, ...installPhp]);
else ok(`PHP ${php.version} (${php.binary})`);

const composer = run("composer", ["--version"], { quiet: true });
const composerOk = !composer.missing && composer.ok;
if (composerOk) ok(composer.out.match(/Composer version \S+/)?.[0] ?? "Composer");
else
  problems.push([
    "Composer was not found.",
    WINDOWS
      ? "Install Composer with Composer-Setup.exe from getcomposer.org (it finds your PHP), then close and reopen the terminal and VS Code."
      : MAC
        ? "Install it with: brew install composer"
        : "Install it with your distribution's package (composer), or from getcomposer.org.",
  ]);

/* PHP extensions: the minimum below, plus anything composer.lock needs. */
const connection = backendSetting("DB_CONNECTION") || "sqlite";
let missingExts = [];
let iniPlan = null;

if (php && !php.broken && atLeast(php.version, "8.3")) {
  const has = (e) => php.exts.includes(e);
  const needed = ["openssl", "mbstring", "fileinfo", "curl"];
  // Composer unpacks packages with the zip extension, or with unzip or 7z if one is installed.
  if (!has("zip") && !onPath("unzip") && !onPath("7z")) needed.push("zip");
  if (connection === "sqlite") needed.push("pdo_sqlite", "sqlite3");
  if (connection === "mysql") needed.push("pdo_mysql");
  const fromLock = lockRequirements(php.exts);
  missingExts = [...new Set([...needed.filter((e) => !has(e)), ...fromLock.missing])];
  for (const o of fromLock.other) problems.push([`A PHP requirement isn't met: ${o}`, "Install a PHP version or extension that provides it (see \"Troubleshooting\" in README.md)."]);

  if (missingExts.length === 0) ok(`PHP extensions (${connection === "mysql" ? "MySQL" : "SQLite"} database): everything needed is on`);
  else {
    const binDir = dirname(php.binary);
    const ini = php.ini || null;
    const devIni = join(binDir, "php.ini-development");
    const target = ini ?? join(binDir, "php.ini");
    // On Windows, extensions are .dll files in extension_dir. If that folder is wrong (php.ini-development
    // leaves extension_dir commented out), they can't load even when turned on.
    let setExtDir = false;
    if (WINDOWS) {
      const extDir = php.extDir ? (isAbsolute(php.extDir) ? php.extDir : join(binDir, php.extDir)) : "";
      setExtDir = !existsSync(join(extDir, "php_openssl.dll")) && existsSync(join(binDir, "ext", "php_openssl.dll"));
    }
    iniPlan = { ini, target, devIni: !ini && existsSync(devIni) ? devIni : null, setExtDir, binDir };
  }
}

/* ---------------------------------------- Report ---------------------------------------- */

function printManualSteps() {
  const { ini, target, devIni, setExtDir } = iniPlan;
  console.log(`\n  Or by hand:`);
  if (!ini) {
    console.log(devIni ? `    1. Copy ${devIni} to ${target}` : `    1. Create an empty file ${target}`);
    console.log(`    2. Open ${target}, then make sure these lines are there without a ; in front of them:`);
  } else {
    console.log(`    Open ${target}, remove the ; at the start of these lines (add any that aren't there), save, and open a new terminal:`);
  }
  if (setExtDir) console.log(`      extension_dir = "ext"`);
  for (const e of missingExts) console.log(`      extension=${e}`);
  if (!ini) console.log(`    3. Save, and open a new terminal.`);
}

if (problems.length > 0 || missingExts.length > 0) {
  console.log("");
  for (const [title, ...lines] of problems) {
    console.log(`${red("✗")} ${title}`);
    for (const l of lines) console.log(`  ${l}`);
    console.log("");
  }
  if (missingExts.length > 0) {
    console.log(`${red("✗")} PHP needs a few extensions turned on before Nexora can install.\n`);
    console.log(`  Missing: ${missingExts.join(", ")}`);
    console.log(`  php.ini in use: ${iniPlan.ini ?? `none${iniPlan.devIni ? ` (only php.ini-development exists in ${iniPlan.binDir})` : ""}`}`);
    if (iniPlan.setExtDir) console.log(`  extension_dir doesn't point to PHP's ext folder, so extensions can't load yet.`);
    printManualSteps();
    console.log(`\n  Don't use "composer update" or "--ignore-platform-reqs" to get past this: turning the extensions on is the fix.`);
  }

  if (CHECK_ONLY) {
    const count = problems.length + (missingExts.length ? 1 : 0);
    const next = missingExts.length ? `Fix them, or run ${bold("npm run setup")} to have the PHP extensions turned on for you.` : `Fix ${count === 1 ? "it" : "them"}, then run ${bold("npm run doctor")} again.`;
    if (missingExts.length) console.log("");
    console.log(`${count} problem${count === 1 ? "" : "s"} found. Nothing was changed. ${next}`);
    process.exit(1);
  }

  if (missingExts.length > 0) {
    const backupNote = iniPlan.ini ? `back up ${iniPlan.ini} and ` : iniPlan.devIni ? `create ${iniPlan.target} from php.ini-development and ` : `create ${iniPlan.target} and `;
    const answer = await ask(`\n  Fix it automatically? Setup will ${backupNote}turn these on. [Y/n] `);
    if (answer === null) fail("No answer (setup isn't running in a terminal), so nothing was changed.", "Follow the steps above by hand, then run `npm run setup` again.");
    if (!/^(y|yes)?$/i.test(answer)) {
      console.log("\nNothing was changed. Follow the steps above by hand, then run `npm run setup` again.");
      process.exit(1);
    }

    /* The auto-fix */
    const { ini, target, devIni, setExtDir } = iniPlan;
    try {
      let text;
      if (ini) {
        const backup = existsSync(`${ini}.bak`) ? `${ini}.bak.${timestamp()}` : `${ini}.bak`;
        copyFileSync(ini, backup);
        ok(`Backed up php.ini to ${backup}`);
        text = readFileSync(ini, "utf8");
      } else {
        text = devIni ? readFileSync(devIni, "utf8") : "";
      }
      writeFileSync(target, enableInIni(text, missingExts, setExtDir));
      ok(`${ini ? "Updated" : "Created"} ${target}`);
    } catch (err) {
      const denied = err && (err.code === "EACCES" || err.code === "EPERM");
      console.log(`\n${red("✗")} Setup couldn't write ${target}${denied ? " (no permission to change it)" : `: ${err.message}`}.`);
      if (denied) console.log(`  Close this terminal, open a new one as Administrator (right-click → Run as administrator), and run npm run setup again.`);
      printManualSteps();
      process.exit(1);
    }

    // Check that PHP really loads them now.
    const after = probePhp();
    const still = after && !after.broken ? missingExts.filter((e) => !after.exts.includes(e)) : missingExts;
    const now = missingExts.filter((e) => !still.includes(e));
    if (now.length) ok(`Now on: ${now.join(", ")}`);
    if (still.length) {
      const extDir = after?.extDir ? (isAbsolute(after.extDir) ? after.extDir : join(iniPlan.binDir, after.extDir)) : join(iniPlan.binDir, "ext");
      console.log(`\n${red("✗")} Still not loading: ${still.join(", ")}`);
      for (const e of still) {
        const dll = join(extDir, `php_${e}.dll`);
        if (WINDOWS && !existsSync(dll)) console.log(`  ${e}: ${dll} doesn't exist. This PHP doesn't include it; install PHP from windows.php.net or with Laravel Herd (see "Installing PHP on Windows" in README.md).`);
        else console.log(`  ${e}: turned on in ${target} but PHP can't load it. Run php -m to see PHP's warning about it.`);
      }
      process.exit(1);
    }
  }

  if (problems.length > 0) fail("Fix the problems above, then run `npm run setup` again.");
}

if (CHECK_ONLY) {
  console.log(`\n${green(bold("✓ Everything Nexora needs is in place."))} Run ${bold("npm run setup")} to install it.`);
  process.exit(0);
}

/* 2. Settings files */
console.log(`\n${bold("▶ Settings")}`);
const backendEnv = join(BACKEND, ".env");
if (!existsSync(backendEnv)) {
  copyFileSync(join(BACKEND, ".env.example"), backendEnv);
  ok("Created backend/.env from backend/.env.example");
} else {
  ok("backend/.env already exists, keeping it");
}
const frontendEnv = join(ROOT, ".env.local");
if (!existsSync(frontendEnv)) {
  copyFileSync(join(ROOT, ".env.example"), frontendEnv);
  ok("Created .env.local from .env.example");
} else {
  ok(".env.local already exists, keeping it");
}

if (connection === "sqlite") {
  const file = backendSetting("DB_DATABASE") || join(BACKEND, "database", "database.sqlite");
  if (!existsSync(file)) {
    writeFileSync(file, "");
    ok("Created the SQLite database file (backend/database/database.sqlite)");
  }
  ok("Database: SQLite file, no server needed");
} else {
  ok(`Database: ${connection} (${backendSetting("DB_DATABASE") || "no DB_DATABASE set"} on ${backendSetting("DB_HOST") || "127.0.0.1"})`);
  console.log("    The database must already exist and the DB_ settings in backend/.env must be right.");
}

/* 3. Packages */
step("Installing PHP packages (composer install)", "composer", ["install", "--no-interaction"], BACKEND);
if (!backendSetting("APP_KEY")) step("Creating the app key", "php", ["artisan", "key:generate", "--no-interaction"], BACKEND);
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
