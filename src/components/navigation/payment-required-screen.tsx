"use client";

import { useEffect, useRef } from "react";
import { LockKeyhole } from "lucide-react";
import { PAYMENT_REQUIRED_MESSAGE } from "@/lib/access-gate";
import styles from "./payment-required-screen.module.css";

export function PaymentRequiredScreen() {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div className={styles.screen}>
      {/* Decorative workspace only. Protected data is never sent to this page. */}
      <div className={styles.workspace} inert aria-hidden="true">
        <aside className={styles.sidebar}>
          <div className={styles.brand}>● Beacon</div>
          <div className={styles.workspaceName}>Your workspace</div>
          <div className={styles.active}>Projects</div>
          <div>Analytics</div>
          <div>Timesheets</div>
          <div className={styles.profile}>Workspace member</div>
        </aside>
        <main className={styles.content}>
          <div className={styles.topbar}>Workspace / Projects</div>
          <h1>Projects</h1>
          <p>Manage your projects and track issues</p>
          <div className={styles.cards}>
            {[0, 1, 2, 3, 4, 5].map((card) => (
              <div className={styles.card} key={card}>
                <div className={styles.mark} />
                <div className={styles.line} />
                <div className={styles.shortLine} />
                <div className={styles.progress} />
                <div className={styles.shortLine} />
              </div>
            ))}
          </div>
        </main>
      </div>

      <div className={styles.overlay}>
        <div
          ref={dialogRef}
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-title"
          aria-describedby="payment-description"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape" || event.key === "Tab") event.preventDefault();
          }}
        >
          <div className={styles.lock}><LockKeyhole size={28} aria-hidden="true" /></div>
          <div className={styles.badge}>PAYMENT REQUIRED</div>
          <h2 id="payment-title">{PAYMENT_REQUIRED_MESSAGE}</h2>
          <p id="payment-description">
            You’re signed in. Access to your workspace is locked until payment is resolved.
          </p>
          <div className={styles.notice}>Contact your administrator to arrange payment.</div>
        </div>
      </div>
    </div>
  );
}
