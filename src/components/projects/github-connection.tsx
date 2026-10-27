"use client";

import { useId, useState, useTransition } from "react";
import { ArrowUpRight, Check, ChevronDown, CircleAlert, GitBranch, LoaderCircle, LockKeyhole, Pause, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { connectGitHubAction, disconnectGitHubAction, retryGitHubSyncAction } from "@/app/(dashboard)/projects/[id]/github-actions";
import { githubConnectionSchema } from "@/lib/github-validation";
import styles from "./github-connection.module.css";

type Props = { projectId: string; connection: { owner: string; repo: string; enabled: boolean } | null; pending: number; errors: { key: string; message: string }[] };

export function GitHubConnectionPanel({ projectId, connection, pending, errors }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, startTransition] = useTransition();
  const panelId = useId();
  const router = useRouter();

  function run(action: () => ReturnType<typeof connectGitHubAction>) {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await action();
        setFailed(!result.success);
        setMessage(result.success ? result.data.message : result.error);
        router.refresh();
      } catch {
        setFailed(true);
        setMessage("Request failed. Please retry.");
      }
    });
  }

  return (
    <section className={styles.panel} aria-label="GitHub integration" aria-busy={busy}>
      <button className={styles.toggle} type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={panelId}>
        <span className={styles.mark}><GitBranch size={21} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className={styles.heading}>
          <span className={styles.title}>GitHub Issues</span>
          <span className={styles.subtitle}>{connection ? `${connection.owner}/${connection.repo}` : "Keep your repository in the loop."}</span>
        </span>
        <span className={styles.headerActions}>
          {connection && <span className={`${styles.badge} ${connection.enabled ? styles.connected : styles.paused}`}><span className={styles.dot} />{connection.enabled ? "Connected" : "Paused"}</span>}
          {connection?.enabled && pending > 0 && <span className={styles.pending}>{pending} pending</span>}
          <span className={styles.configure}>{expanded ? "Hide settings" : connection ? "Settings" : "Connect repository"}</span>
          <ChevronDown size={16} className={expanded ? styles.chevronOpen : styles.chevron} aria-hidden="true" />
        </span>
      </button>

      {expanded && <div id={panelId} className={styles.body}>
        <div className={styles.setup}>
          <div className={styles.sectionHeading}>
            <h2>{connection ? "Repository settings" : "Connect your repository"}</h2>
            <p>Send Beacon issues straight to your team’s GitHub repository.</p>
          </div>
          <form autoComplete="off" className={styles.form} onSubmit={event => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const parsed = githubConnectionSchema.safeParse({ projectId, owner: data.get("githubOwner"), repo: data.get("githubRepository"), token: data.get("githubAccessToken") });
            if (!parsed.success) { setFailed(true); setMessage(parsed.error.issues[0].message); return; }
            run(async () => { const result = await connectGitHubAction(parsed.data); if (result.success) form.reset(); return result; });
          }}>
            <div className={styles.repositoryFields}>
              <label className={styles.field}>Repository owner
                <input name="githubOwner" required defaultValue={connection?.owner} readOnly={!!connection} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="your-team" disabled={busy} />
              </label>
              <span className={styles.slash} aria-hidden="true">/</span>
              <label className={styles.field}>Repository name
                <input name="githubRepository" required defaultValue={connection?.repo} readOnly={!!connection} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="your-project" disabled={busy} />
              </label>
            </div>
            <label className={styles.field}>Personal access token
              <input name="githubAccessToken" type="password" required autoComplete="new-password" spellCheck={false} placeholder="github_pat_••••••••••••" aria-describedby={`${panelId}-token-help`} disabled={busy} />
            </label>
            <p className={styles.helper} id={`${panelId}-token-help`}>Select this repository and allow <strong>Issues: Read and write</strong>. <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">Create a token <ArrowUpRight size={12} aria-hidden="true" /></a></p>
            <div className={styles.formFooter}>
              <span className={styles.security}><LockKeyhole size={13} aria-hidden="true" />Token stored securely</span>
              <button className={styles.primary} disabled={busy} type="submit">{busy ? <LoaderCircle size={15} className={styles.spin} aria-hidden="true" /> : <GitBranch size={15} aria-hidden="true" />}{busy ? "Saving…" : connection ? "Save connection" : "Connect GitHub"}</button>
            </div>
          </form>
        </div>

        <aside className={styles.explainer}>
          <span className={styles.eyebrow}>BEACON <span aria-hidden="true">→</span> GITHUB</span>
          <h3>One less thing to update.</h3>
          <ul>
            <li><Check size={15} aria-hidden="true" /><span>New issues appear in GitHub.</span></li>
            <li><Check size={15} aria-hidden="true" /><span>Closing and reopening sync automatically.</span></li>
            <li><Check size={15} aria-hidden="true" /><span>Assigned people are added as comments.</span></li>
          </ul>
          <p>Changes sync from Beacon. Edits made in GitHub stay in GitHub.</p>
          {connection?.enabled && <div className={styles.syncActions}>
            <button className={styles.secondary} disabled={busy || pending === 0} type="button" onClick={() => run(() => retryGitHubSyncAction({ projectId }))}><RefreshCw size={14} aria-hidden="true" />Sync pending{pending > 0 && <span>{pending}</span>}</button>
            <span className={styles.helper}>Includes existing project issues.</span>
            <button className={styles.pause} disabled={busy} type="button" onClick={() => run(() => disconnectGitHubAction({ projectId }))}><Pause size={12} aria-hidden="true" />Pause sync</button>
          </div>}
        </aside>
        {errors.length > 0 && <div className={styles.errors} role="alert"><CircleAlert size={16} aria-hidden="true" /><div><strong>Some issues need another try</strong>{errors.map(error => <p key={error.key}><b>{error.key}</b> · {error.message}</p>)}</div></div>}
      </div>}
      {message && <div role={failed ? "alert" : "status"} className={`${styles.notice} ${failed ? styles.failure : styles.success}`}>{failed ? <CircleAlert size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}<span>{message}</span></div>}
    </section>
  );
}
