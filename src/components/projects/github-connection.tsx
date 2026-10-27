"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { connectGitHubAction, disconnectGitHubAction, retryGitHubSyncAction } from "@/app/(dashboard)/projects/[id]/github-actions";
import { githubConnectionSchema } from "@/lib/github-validation";

type Props = { projectId: string; connection: { owner: string; repo: string; enabled: boolean } | null; pending: number; errors: { key: string; message: string }[] };
export function GitHubConnectionPanel({ projectId, connection, pending, errors }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  function run(action: () => ReturnType<typeof connectGitHubAction>) {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        setFailed(!result.success);
        setMessage(result.success ? result.data.message : result.error);
        router.refresh();
      } catch { setFailed(true); setMessage("Request failed. Please retry."); }
    });
  }
  return <section style={{ margin: "12px 24px", padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
    <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>GitHub Issues · {connection ? `${connection.owner}/${connection.repo}${connection.enabled ? "" : " (paused)"}` : "Connect repository"}{pending > 0 && connection?.enabled ? ` · ${pending} pending` : ""}</button>
    {expanded && <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
      <p>Beacon issues sync to GitHub. Closed issues close there; reopened issues reopen. Assigned people appear as comments. GitHub edits do not sync back.</p>
      <form onSubmit={event => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const parsed = githubConnectionSchema.safeParse({ projectId, owner: data.get("owner"), repo: data.get("repo"), token: data.get("token") });
        if (!parsed.success) { setFailed(true); setMessage(parsed.error.issues[0].message); return; }
        run(async () => { const result = await connectGitHubAction(parsed.data); if (result.success) form.reset(); return result; });
      }} style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <label>Owner <input name="owner" required defaultValue={connection?.owner} readOnly={!!connection} /></label>
        <label>Repository <input name="repo" required defaultValue={connection?.repo} readOnly={!!connection} /></label>
        <label>GitHub token <input name="token" type="password" required autoComplete="off" placeholder="Fine-grained access token" /></label>
        <button disabled={busy} type="submit">{busy ? "Working…" : connection ? "Update token / resume" : "Connect GitHub"}</button>
      </form>
      <p>Use a fine-grained token for this repository with Issues: Read and write. Tokens are encrypted on the server. Connecting enables automatic sync for newly raised issues. Sync pending also publishes existing project issues.</p>
      {connection?.enabled && <div style={{ display: "flex", gap: 16 }}>
        <button disabled={busy || pending === 0} onClick={() => run(() => retryGitHubSyncAction({ projectId }))}>Sync pending ({pending})</button>
        <button disabled={busy} onClick={() => run(() => disconnectGitHubAction({ projectId }))}>Pause sync</button>
      </div>}
      {errors.map(error => <p key={error.key} role="alert">{error.key}: {error.message}</p>)}
    </div>}
    {message && <p role={failed ? "alert" : "status"} style={{ marginTop: 12 }}>{message}</p>}
  </section>;
}
