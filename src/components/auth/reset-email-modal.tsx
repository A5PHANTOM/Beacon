"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mail, X } from "lucide-react";
import { resetUserEmailAction } from "@/app/(dashboard)/admin/users/actions";
import { resetUserEmailSchema } from "@/lib/user-validation";
import styles from "./reset-email-modal.module.css";

type EmailUser = { id: string; name: string; email: string };
export function ResetEmailModal({ user, onClose, onSaved }: { user: EmailUser; onClose: () => void; onSaved: (user: EmailUser & { githubLogin: string | null }) => void }) {
  const [email, setEmail] = useState(user.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const id = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    input.current?.focus();
    input.current?.select();
    return () => previous?.focus();
  }, []);

  return createPortal(<div className={styles.overlay} onClick={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className={styles.dialog} ref={dialog} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onKeyDown={event => {
      if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const elements = dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled)');
        if (!elements?.length) return;
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <header className={styles.header}><span className={styles.icon}><Mail size={20} /></span><div><h2 id={`${id}-title`}>Change sign-in email</h2><p>{user.name}</p></div><button type="button" aria-label="Close email settings" disabled={busy} onClick={onClose}><X size={18} /></button></header>
      <p id={`${id}-description`} className={styles.description}>Update this person’s Beacon login email. Their password, role, and project access stay the same.</p>
      <form onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        const parsed = resetUserEmailSchema.safeParse({ userId: user.id, email, expectedEmail: user.email });
        if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
        setBusy(true); setError("");
        try {
          const result = await resetUserEmailAction(parsed.data);
          if (!result.success) { setError(result.error); return; }
          onSaved(result.data);
        } catch { setError("Could not save the new email. Please retry."); }
        finally { setBusy(false); }
      }}>
        <label className={styles.field}>New email address<input ref={input} name="newEmail" type="email" autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} required disabled={busy} /></label>
        <div className={styles.note}>Existing sessions will end and the GitHub login link will be cleared. To reconnect, the user must sign in with a GitHub account that verifies the new email.</div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <footer className={styles.footer}><button className={styles.cancel} type="button" disabled={busy} onClick={onClose}>Cancel</button><button className={styles.save} type="submit" disabled={busy || email.trim().toLowerCase() === user.email}>{busy ? "Saving…" : "Update email"}</button></footer>
      </form>
    </div>
  </div>, document.body);
}
