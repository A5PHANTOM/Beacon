"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";

type RoleTheme = "dev" | "tester" | "admin";

interface RoleConfig {
  key: RoleTheme;
  label: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  headline: string;
  subhead: string;
  accent: string;
}

const ROLES: Record<RoleTheme, RoleConfig> = {
  dev: {
    key: "dev",
    label: "Developer",
    badge: "ENGINEERING // DEV",
    badgeBg: "#ECFDF5",
    badgeColor: "#047857",
    badgeBorder: "#A7F3D0",
    headline: "Developer Portal",
    subhead: "Resolve assigned defects and manage issue workflows",
    accent: "#059669",
  },
  tester: {
    key: "tester",
    label: "Tester / QA",
    badge: "QA RADAR // REPORTING",
    badgeBg: "#FFFBEB",
    badgeColor: "#B45309",
    badgeBorder: "#FDE68A",
    headline: "Tester & QA Portal",
    subhead: "Log bug reports, document repro steps, and verify fixes",
    accent: "#D97706",
  },
  admin: {
    key: "admin",
    label: "Admin Console",
    badge: "ADMIN // GOVERNANCE",
    badgeBg: "#EEF2FF",
    badgeColor: "#4338CA",
    badgeBorder: "#C7D2FE",
    headline: "Administrator Console",
    subhead: "Manage workspace governance, roles, and project access",
    accent: "#4F46E5",
  },
};

function RoleIcon({ role }: { role: RoleTheme }) {
  if (role === "dev") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  if (role === "tester") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="3" x2="12" y2="7" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <line x1="3" y1="12" x2="7" y2="12" />
        <line x1="17" y1="12" x2="21" y2="12" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";

  const initialRoleParam = searchParams.get("role") as RoleTheme | null;
  const [activeRole, setActiveRole] = useState<RoleTheme>(
    initialRoleParam && ROLES[initialRoleParam] ? initialRoleParam : "dev"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialRoleParam && ROLES[initialRoleParam]) {
      setActiveRole(initialRoleParam);
    }
  }, [initialRoleParam]);

  const current = ROLES[activeRole];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: email.trim(),
        password,
        callbackUrl,
      });

      if (res?.error) {
        setError("Invalid email or password. Please verify your credentials.");
      } else {
        window.location.href = res?.url || callbackUrl;
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 16,
        padding: "36px 32px",
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.03), 0 0 1px rgba(15, 23, 42, 0.08)",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            color: "#FFFFFF",
            marginBottom: 12,
            boxShadow: "0 4px 12px rgba(15, 23, 42, 0.12)",
          }}
        >
          {/* Glowing Beacon Logo */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M4.93 4.93l2.83 2.83M2 12h4M4.93 19.07l2.83-2.83M12 22v-4M19.07 19.07l-2.83-2.83M22 12h-4M19.07 4.93l-2.83 2.83" />
            <circle cx="12" cy="12" r="3" fill="#38BDF8" stroke="#38BDF8" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "#0F172A",
            margin: "0 0 4px",
          }}
        >
          Beacon
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "#64748B",
            margin: 0,
          }}
        >
          Internal Workspace & Issue Tracker
        </p>
      </div>

      {/* Role Segmented Controller */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 4,
          padding: 4,
          backgroundColor: "#F1F5F9",
          borderRadius: 10,
          border: "1px solid #E2E8F0",
          marginBottom: 20,
        }}
      >
        {(["dev", "tester", "admin"] as const).map((r) => {
          const cfg = ROLES[r];
          const isSelected = activeRole === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => {
                setActiveRole(r);
                setError("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                padding: "8px 4px",
                borderRadius: 7,
                border: isSelected ? "1px solid #E2E8F0" : "1px solid transparent",
                backgroundColor: isSelected ? "#FFFFFF" : "transparent",
                color: isSelected ? "#0F172A" : "#64748B",
                boxShadow: isSelected ? "0 1px 3px rgba(15, 23, 42, 0.08)" : "none",
                fontSize: 12,
                fontWeight: isSelected ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: isSelected ? cfg.accent : "currentColor" }}>
                <RoleIcon role={r} />
              </span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Role Context Information */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 10px",
            borderRadius: 999,
            backgroundColor: current.badgeBg,
            border: `1px solid ${current.badgeBorder}`,
            color: current.badgeColor,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.04em",
            fontFamily: "'IBM Plex Mono', monospace",
            marginBottom: 8,
          }}
        >
          <RoleIcon role={activeRole} />
          <span>{current.badge}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
          {current.headline}
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "#64748B", lineHeight: 1.4 }}>
          {current.subhead}
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            padding: "10px 12px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
            }}
          >
            Email address
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{
              width: "100%",
              backgroundColor: "#FFFFFF",
              border: "1px solid #CBD5E1",
              borderRadius: 8,
              padding: "10px 13px",
              fontSize: 14,
              color: "#0F172A",
              outline: "none",
              transition: "border-color 0.15s, box-shadow 0.15s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "#0F172A";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15, 23, 42, 0.08)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "#CBD5E1";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 6,
            }}
          >
            Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{
                width: "100%",
                backgroundColor: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: 8,
                padding: "10px 38px 10px 13px",
                fontSize: 14,
                color: "#0F172A",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#0F172A";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(15, 23, 42, 0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#CBD5E1";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#94A3B8",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "11px 16px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#0F172A",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 6,
            transition: "background-color 0.15s ease",
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.1)",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = "#1E293B";
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = "#0F172A";
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span>Signing in…</span>
            </>
          ) : (
            <span>Sign in</span>
          )}
        </button>
      </form>

      {/* Card Footer */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid #F1F5F9",
          textAlign: "center",
          fontSize: 12,
          color: "#94A3B8",
        }}
      >
        Beacon Issue Tracker · Protected by role-based access
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#F8FAFC", color: "#64748B", fontSize: 14 }}>
          Loading…
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8FAFC",
        backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -15%, rgba(59, 130, 246, 0.06), transparent 70%), radial-gradient(#CBD5E1 1px, transparent 1px)",
        backgroundSize: "100% 100%, 24px 24px",
        padding: "32px 16px",
        position: "relative",
      }}
    >
      <LoginForm />
    </div>
  );
}
