"use client";
import { useState } from "react";
import { projectApiKeySchema } from "@/lib/project-api/key-validation";
import { createProjectApiKey, listProjectApiKeys, revokeProjectApiKey } from "@/app/(dashboard)/projects/[id]/api-actions";

type Key = { id: string; name: string; access: string; expiresAt: string };
export function ProjectApiPanel({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [keys, setKeys] = useState<Key[]>([]);
  const [name, setName] = useState("External app");
  const [access, setAccess] = useState<"READ" | "WRITE">("READ");
  const [newKey, setNewKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const result = await listProjectApiKeys(projectId);
    if (result.success) setKeys(result.data); else setError(result.error);
  }
  async function run(task: () => Promise<void>) {
    setBusy(true); setError(""); setMessage("");
    try { await task(); } catch { setError("Could not complete the request. Please try again."); } finally { setBusy(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Copied."); } catch { setError("Copy failed. Select and copy the text manually."); }
  }
  const button = "rounded border border-slate-600 px-3 py-2 text-sm disabled:opacity-50";
  return <section className="my-3 rounded-lg border border-slate-700 p-4">
    <button type="button" className={button} aria-expanded={open} onClick={() => {
      if (open) { setOpen(false); setNewKey(""); return; }
      setOpen(true); setEndpoint(`${window.location.origin}/api/v1/projects/${projectId}`);
      void run(load);
    }}>External app API</button>
    {open && <div className="mt-4 space-y-4">
      <p>Connect this project to an external app. Each key acts as your Beacon account, with your current project permissions.</p>
      <label className="block">Project endpoint<input aria-label="Project endpoint" className="mt-1 w-full rounded border p-2 font-mono text-sm" readOnly value={endpoint} /></label>
      <button type="button" className={button} onClick={() => void copy(endpoint)}>Copy endpoint</button>
      <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); void run(async () => {
        setNewKey("");
        const parsed = projectApiKeySchema.safeParse({ projectId, name, access, days: 90 });
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        const result = await createProjectApiKey(parsed.data);
        if (!result.success) { setError(result.error); return; }
        setNewKey(result.data.key); await load();
      }); }}>
        <label>Key name<input className="block rounded border p-2" required maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Access<select className="block rounded border p-2" value={access} onChange={e => setAccess(e.target.value as "READ" | "WRITE")}><option value="READ">Read only</option>{canWrite && <option value="WRITE">Read and write</option>}</select></label>
        <button className={button} disabled={busy}>{busy ? "Working…" : "Create key (90 days)"}</button>
      </form>
      {newKey && <div className="space-y-2 rounded border border-amber-500 p-3"><p>Copy this key now. It is shown only once. Keep it in your external app’s server configuration. Keys can read project notes and saved credentials.</p><input className="w-full rounded border p-2 font-mono text-sm" aria-label="New API key" readOnly value={newKey} /><button type="button" className={button} onClick={() => void copy(newKey)}>Copy key</button></div>}
      <p className="text-sm">Send <code>Authorization: Bearer YOUR_KEY</code>. Read issues with <code>?resource=issues</code>, retrieve a complete issue with <code>?resource=issue&amp;issueId=ISSUE_ID</code>, and get the request schemas with <code>?resource=schema</code>. Send actions as JSON using POST to the same endpoint.</p>
      {keys.length === 0 && !busy && <p>No API keys created.</p>}
      <ul className="space-y-2">{keys.map(key => <li key={key.id} className="flex flex-wrap items-center gap-3"><span>{key.name} · {key.access === "READ" ? "Read only" : "Read and write"} · expires {new Date(key.expiresAt).toLocaleDateString()}</span><button type="button" className={button} disabled={busy} onClick={() => void run(async () => { const result = await revokeProjectApiKey({ projectId, id: key.id }); if (!result.success) { setError(result.error); return; } setNewKey(""); await load(); })}>Revoke</button></li>)}</ul>
      {error && <p role="alert" className="text-red-500">{error}</p>}
      {message && <p role="status">{message}</p>}
    </div>}
  </section>;
}
