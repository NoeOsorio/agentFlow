import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

interface Config {
  apiUrl: string;
  apiKey?: string;
}

const CONFIG_DIR = path.join(os.homedir(), ".agentflow");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export function loadConfig(): Config {
  const defaults: Config = { apiUrl: "http://localhost:8000" };
  if (!fs.existsSync(CONFIG_FILE)) return defaults;
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveConfig(config: Partial<Config>): void {
  const current = loadConfig();
  const merged = { ...current, ...config };
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2) + "\n");
}

async function request(
  method: string,
  urlPath: string,
  body?: unknown,
): Promise<unknown> {
  const config = loadConfig();
  const url = `${config.apiUrl}${urlPath}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${urlPath} failed (${res.status}): ${text}`);
  }

  if (res.status === 204) {
    return null;
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

export const client = {
  get: (path: string) => request("GET", path),
  post: (path: string, body?: unknown) => request("POST", path, body),
  delete: (path: string) => request("DELETE", path),
};
