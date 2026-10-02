import * as fs from "fs";
import * as path from "path";

export const ROOT = path.resolve(__dirname, "../..");
export const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");

/** Loads the root .env into process.env without overriding variables already set in the shell. */
export function loadEnv() {
  if (fs.existsSync(ENV_PATH)) process.loadEnvFile(ENV_PATH);
}

/** Copies .env.example to .env if .env does not exist yet. Returns true when it created the file. */
export function ensureEnvFile() {
  if (fs.existsSync(ENV_PATH)) return false;
  fs.copyFileSync(ENV_EXAMPLE_PATH, ENV_PATH);
  return true;
}

/** Sets keys in the root .env in place, keeping comments and order; unknown keys are appended. */
export function upsertEnv(values: Record<string, string>) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values));
  const updated = lines.map(line => {
    const key = line.match(/^([A-Z0-9_]+)=/)?.[1];
    if (!key || !pending.has(key)) return line;
    const value = pending.get(key);
    pending.delete(key);
    return `${key}=${value}`;
  });
  for (const [key, value] of pending) updated.push(`${key}=${value}`);
  fs.writeFileSync(ENV_PATH, updated.join("\n").replace(/\n*$/, "\n"));
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
}
