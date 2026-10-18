// Starts everything Nexora CRM needs while developing, in one terminal:
//
//   npm run dev:all
//
//   api        Laravel API          http://localhost:8000   (php artisan serve)
//   reminders  task reminder emails, checked every minute    (php artisan schedule:work)
//   web        Next.js app          http://localhost:3000   (next dev)
//
// Each line of output is labelled with the part it came from. Ctrl+C stops all three,
// and if one of them stops on its own (for example because its port is taken), the
// others are stopped too. Run `npm run setup` once before the first start.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

const ROOT = process.cwd();
const BACKEND = join(ROOT, "backend");
const WINDOWS = process.platform === "win32";

const PARTS = [
  { name: "api", color: 36, cmd: "php", args: ["artisan", "serve", "--port=8000"], cwd: BACKEND, port: 8000 },
  { name: "reminders", color: 35, cmd: "php", args: ["artisan", "schedule:work"], cwd: BACKEND },
  { name: "web", color: 32, cmd: "npm", args: ["run", "dev"], cwd: ROOT, port: 3000 },
];

if (!existsSync(join(BACKEND, "vendor")) || !existsSync(join(ROOT, "node_modules")) || !existsSync(join(BACKEND, ".env"))) {
  console.error("Nexora isn't set up yet. Run `npm run setup` first.");
  process.exit(1);
}

/** True if the port can be opened on this address (all addresses when host is undefined). */
function canListen(port, host) {
  return new Promise((resolve) => {
    const server = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

/**
 * True if nothing is listening on this port yet. Both checks are needed: `php artisan serve`
 * listens only on 127.0.0.1, and on Windows opening the port on all addresses still succeeds then.
 */
async function portFree(port) {
  return (await canListen(port)) && (await canListen(port, "127.0.0.1"));
}

for (const part of PARTS) {
  if (part.port && !(await portFree(part.port))) {
    console.error(`Port ${part.port} is already in use, so the ${part.name} can't start.`);
    console.error("Is Nexora already running in another terminal? Stop it there (Ctrl+C), or close whatever uses the port.");
    process.exit(1);
  }
}

const width = Math.max(...PARTS.map((p) => p.name.length));
const children = [];
let stopping = false;

function label(part) {
  return `\x1b[${part.color}m${part.name.padEnd(width)} │\x1b[0m `;
}

function pipe(stream, part, target) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) target.write(label(part) + line + "\n");
  });
  stream.on("end", () => {
    if (buffer) target.write(label(part) + buffer + "\n");
  });
}

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // On Windows the child is a shell; stop it and everything it started.
    if (WINDOWS) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500);
}

for (const part of PARTS) {
  // Keep colours in the labelled output, unless the user has asked for none (NO_COLOR).
  const options = { cwd: part.cwd, env: process.env.NO_COLOR ? process.env : { ...process.env, FORCE_COLOR: "1" } };
  // Windows needs a shell for npm.cmd; give it one command string (Node warns about args + shell).
  const child = WINDOWS ? spawn([part.cmd, ...part.args].join(" "), { ...options, shell: true }) : spawn(part.cmd, part.args, options);
  children.push(child);
  pipe(child.stdout, part, process.stdout);
  pipe(child.stderr, part, process.stderr);
  child.on("error", (err) => {
    process.stderr.write(label(part) + `could not start: ${err.message}\n`);
    stopAll(1);
  });
  child.on("exit", (code) => {
    if (stopping) return;
    process.stderr.write(label(part) + `stopped (exit code ${code ?? "?"}). Stopping the others.\n`);
    stopAll(code || 1);
  });
}

console.log(`\nNexora CRM is starting. Open \x1b[1mhttp://localhost:3000\x1b[0m when "web" says it's ready. Ctrl+C stops everything.\n`);

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
