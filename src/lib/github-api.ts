import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey() {
  const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("Configure GITHUB_TOKEN_ENCRYPTION_KEY before connecting GitHub.");
  return Buffer.from(key, "hex");
}
export function encryptGitHubToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString("base64")).join(".");
}
export function decryptGitHubToken(value: string) {
  const [iv, tag, data] = value.split(".").map(v => Buffer.from(v, "base64"));
  const cipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
}
export async function githubRequest(token: string, path: string, method = "GET", body?: unknown): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error",
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("GitHub token expired or is invalid. Update the connection.");
    if (response.status === 403 || response.status === 429) throw new Error("GitHub denied access or rate limited the request. Check Issues write permission and retry later.");
    if (response.status === 404) throw new Error("GitHub repository or issue is unavailable. Check repository access.");
    throw new Error(`GitHub request failed (${response.status}). Retry sync later.`);
  }
  if (response.status === 204) return null;
  return response.json();
}
