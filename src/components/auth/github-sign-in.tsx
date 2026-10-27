"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import styles from "./github-sign-in.module.css";

type ProviderState = "loading" | "ready" | "unconfigured" | "error";

export function GitHubSignIn({ callbackUrl, disabled = false }: { callbackUrl: string; disabled?: boolean }) {
  const [state, setState] = useState<ProviderState>("loading");
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const timeout = setTimeout(() => { if (active) { setState("error"); active = false; } }, 10000);
    getProviders().then(providers => {
      if (active) setState(providers ? providers.github ? "ready" : "unconfigured" : "error");
    }).catch(() => { if (active) setState("error"); }).finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); };
  }, [retry]);

  async function startGitHubLogin() {
    setError("");
    setRedirecting(true);
    try {
      const destination = new URL(callbackUrl, window.location.origin);
      const safeCallbackUrl = destination.origin === window.location.origin ? `${destination.pathname}${destination.search}${destination.hash}` : "/projects";
      await signIn("github", { callbackUrl: safeCallbackUrl });
    } catch {
      setError("Could not reach GitHub. Please try again.");
      setRedirecting(false);
    }
  }

  return <div className={styles.group}>
    <div className={styles.divider}><span />or<span /></div>
    <button type="button" className={styles.button} disabled={disabled || state !== "ready" || redirecting} onClick={startGitHubLogin}>
      {state === "loading" || redirecting ? <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> : <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.64-1.25-1.64-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.71 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.62 0c2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.33-2.64 5.29-5.15 5.57.41.35.77 1.03.77 2.08v3.09c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z" /></svg>}
      {redirecting ? "Opening GitHub…" : "Continue with GitHub"}
    </button>
    {state === "unconfigured" && <p className={styles.hint}>GitHub sign-in is waiting for OAuth app setup.</p>}
    {state === "ready" && <p className={styles.hint}>Use a GitHub account with a verified email matching your Beacon account.</p>}
    {state === "error" && <p className={styles.hint} role="alert">Sign-in options couldn’t load. <button className={styles.retry} type="button" onClick={() => { setState("loading"); setRetry(value => value + 1); }}><RefreshCw size={12} aria-hidden="true" />Retry</button></p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </div>;
}
