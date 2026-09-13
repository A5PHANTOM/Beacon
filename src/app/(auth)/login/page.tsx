"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense, useEffect } from "react";
import { AnimatedBackground } from "@/components/ui/animated-background";

type RoleTheme = "dev" | "tester" | "admin";

interface ThemeConfig {
  key: RoleTheme;
  label: string;
  badge: string;
  headline: string;
  subhead: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  bg: string;
  cardBg: string;
  cardBorder: string;
  glowColor: string;
  buttonGradient: string;
  inputBorder: string;
  inputFocusBorder: string;
  emailPlaceholder: string;
  tagline: string;
}

const THEMES: Record<RoleTheme, ThemeConfig> = {
  dev: {
    key: "dev",
    label: "Developer",
    badge: "ENGINEERING // DEV",
    headline: "Developer Portal",
    subhead: "Resolve reported defects, manage issue statuses, and write resolution notes",
    accent: "#10B981", // Emerald
    accentSoft: "rgba(16, 185, 129, 0.12)",
    accentBorder: "rgba(16, 185, 129, 0.35)",
    bg: "#0B0F13",
    cardBg: "rgba(14, 20, 27, 0.88)",
    cardBorder: "rgba(16, 185, 129, 0.28)",
    glowColor: "rgba(16, 185, 129, 0.22)",
    buttonGradient: "linear-gradient(135deg, #059669 0%, #10B981 100%)",
    inputBorder: "rgba(16, 185, 129, 0.22)",
    inputFocusBorder: "#10B981",
    emailPlaceholder: "e.g. arjun@gmail.com",
    tagline: "Terminal & Issue Resolution Suite",
  },
  tester: {
    key: "tester",
    label: "Tester / QA",
    badge: "QA WORKSPACE // RADAR",
    headline: "Tester & QA Portal",
    subhead: "Log bug reports, record actionable reproduction steps, and verify defect status",
    accent: "#F59E0B", // Amber
    accentSoft: "rgba(245, 158, 11, 0.12)",
    accentBorder: "rgba(245, 158, 11, 0.35)",
    bg: "#121115",
    cardBg: "rgba(23, 20, 28, 0.88)",
    cardBorder: "rgba(245, 158, 11, 0.28)",
    glowColor: "rgba(245, 158, 11, 0.22)",
    buttonGradient: "linear-gradient(135deg, #D97706 0%, #F59E0B 100%)",
    inputBorder: "rgba(245, 158, 11, 0.22)",
    inputFocusBorder: "#F59E0B",
    emailPlaceholder: "e.g. tester@beacon.local",
    tagline: "Quality Assurance & Defect Radar",
  },
  admin: {
    key: "admin",
    label: "Admin Console",
    badge: "SOVEREIGN // GOVERNANCE",
    headline: "Administrator Console",
    subhead: "Workspace governance, team membership management, and project access controls",
    accent: "#6366F1", // Indigo / Royal Violet
    accentSoft: "rgba(99, 102, 241, 0.12)",
    accentBorder: "rgba(99, 102, 241, 0.35)",
    bg: "#0B0C18",
    cardBg: "rgba(16, 17, 33, 0.88)",
    cardBorder: "rgba(99, 102, 241, 0.3)",
    glowColor: "rgba(99, 102, 241, 0.25)",
    buttonGradient: "linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)",
    inputBorder: "rgba(99, 102, 241, 0.22)",
    inputFocusBorder: "#6366F1",
    emailPlaceholder: "e.g. admin@gmail.com",
    tagline: "Platform Administration & Security",
  },
};

function RoleIcon({ role }: { role: RoleTheme }) {
  if (role === "dev") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  }
  if (role === "tester") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/projects";

  // URL query parameter ?role=dev | ?role=tester | ?role=admin
  const initialRoleParam = searchParams.get("role") as RoleTheme | null;
  const [activeRole, setActiveRole] = useState<RoleTheme>(
    initialRoleParam && THEMES[initialRoleParam] ? initialRoleParam : "dev"
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync state if query parameter changes
  useEffect(() => {
    if (initialRoleParam && THEMES[initialRoleParam]) {
      setActiveRole(initialRoleParam);
    }
  }, [initialRoleParam]);

  const current = THEMES[activeRole];

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
        setError("Invalid credentials. Please verify your email and password.");
      } else {
        router.push(callbackUrl);
        router.refresh();
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
        maxWidth: 440,
        background: current.cardBg,
        border: `1px solid ${current.cardBorder}`,
        borderRadius: 20,
        padding: "32px 30px",
        boxShadow: `0 24px 60px rgba(0,0,0,0.5), 0 0 40px ${current.glowColor}`,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        transition: "border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease",
        position: "relative",
        zIndex: 10,
      }}
    >
      {/* Role Theme Switcher Segmented Control */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 6,
          padding: 4,
          background: "rgba(0, 0, 0, 0.4)",
          borderRadius: 12,
          border: "1px solid rgba(255, 255, 255, 0.08)",
          marginBottom: 26,
        }}
      >
        {(["dev", "tester", "admin"] as const).map((r) => {
          const cfg = THEMES[r];
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
                borderRadius: 8,
                border: isSelected
                  ? `1px solid ${cfg.accentBorder}`
                  : "1px solid transparent",
                background: isSelected ? cfg.accentSoft : "transparent",
                color: isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
                fontSize: 12,
                fontWeight: isSelected ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                whiteSpace: "nowrap",
              }}
            >
              <span
                style={{
                  color: isSelected ? cfg.accent : "currentColor",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <RoleIcon role={r} />
              </span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Header & Role Badge */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 11px",
            borderRadius: 99,
            background: current.accentSoft,
            border: `1px solid ${current.accentBorder}`,
            color: current.accent,
            fontSize: 10.5,
            fontFamily: "'IBM Plex Mono', monospace",
            fontWeight: 700,
            letterSpacing: "0.06em",
            marginBottom: 12,
            transition: "all 0.3s ease",
          }}
        >
          <RoleIcon role={activeRole} />
          <span>{current.badge}</span>
        </div>

        <h1
          style={{
            fontSize: 23,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            margin: "0 0 6px",
            color: "#FFFFFF",
            transition: "color 0.3s ease",
          }}
        >
          {current.headline}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: "rgba(255, 255, 255, 0.6)",
            lineHeight: 1.45,
          }}
        >
          {current.subhead}
        </p>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            background: "rgba(220, 38, 38, 0.12)",
            border: "1px solid rgba(220, 38, 38, 0.35)",
            color: "#FCA5A5",
            padding: "9px 12px",
            borderRadius: 8,
            fontSize: 12.5,
            marginBottom: 16,
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "rgba(255, 255, 255, 0.6)",
              marginBottom: 6,
            }}
          >
            Email Address
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={current.emailPlaceholder}
            style={{
              width: "100%",
              background: "rgba(0, 0, 0, 0.4)",
              border: `1px solid ${current.inputBorder}`,
              borderRadius: 9,
              padding: "11px 13px",
              fontSize: 13,
              color: "#FFFFFF",
              outline: "none",
              transition: "border-color .15s, box-shadow .15s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = current.inputFocusBorder;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${current.accentSoft}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = current.inputBorder;
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "rgba(255, 255, 255, 0.6)",
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
              placeholder="••••••••"
              style={{
                width: "100%",
                background: "rgba(0, 0, 0, 0.4)",
                border: `1px solid ${current.inputBorder}`,
                borderRadius: 9,
                padding: "11px 40px 11px 13px",
                fontSize: 13,
                color: "#FFFFFF",
                outline: "none",
                transition: "border-color .15s, box-shadow .15s",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = current.inputFocusBorder;
                e.currentTarget.style.boxShadow = `0 0 0 3px ${current.accentSoft}`;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = current.inputBorder;
                e.currentTarget.style.boxShadow = "none";
              }}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            padding: "12px",
            borderRadius: 9,
            border: "none",
            background: current.buttonGradient,
            color: "#FFFFFF",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            marginTop: 6,
            boxShadow: `0 4px 20px ${current.glowColor}`,
            transition: "transform 0.12s ease, filter 0.15s ease",
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.filter = "brightness(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "none";
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
              <span>Authenticating…</span>
            </>
          ) : (
            <>
              <span>Sign In to {current.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </form>

      {/* Card Footer */}
      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid rgba(255, 255, 255, 0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "rgba(255, 255, 255, 0.45)",
          fontFamily: "'IBM Plex Mono', monospace",
        }}
      >
        <span>BEACON // ACCESS</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: current.accent,
              boxShadow: `0 0 8px ${current.accent}`,
              transition: "background 0.3s ease, box-shadow 0.3s ease",
            }}
          />
          {current.tagline}
        </span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ color: "#888", fontSize: 13 }}>Loading…</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const initialRoleParam = searchParams.get("role") as RoleTheme | null;
  const activeRole: RoleTheme =
    initialRoleParam && THEMES[initialRoleParam] ? initialRoleParam : "dev";
  const current = THEMES[activeRole];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: current.bg,
        backgroundImage: `radial-gradient(ellipse 65% 55% at 50% 0%, ${current.glowColor} 0%, transparent 80%), radial-gradient(ellipse 50% 50% at 50% 100%, ${current.glowColor} 0%, transparent 80%)`,
        padding: "24px 16px",
        transition: "background 0.4s ease, background-image 0.4s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient Animated Moving Background */}
      <AnimatedBackground />

      <LoginForm />
    </div>
  );
}
