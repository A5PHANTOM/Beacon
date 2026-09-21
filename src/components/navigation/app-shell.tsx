"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AnimatedBackground } from "@/components/ui/animated-background";

type SimpleProject = {
  id: string;
  name: string;
  key: string;
};

type ShellUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function AppShell({
  projects,
  currentProjectId,
  currentUser,
  children,
}: {
  projects: SimpleProject[];
  currentProjectId?: string;
  currentUser: ShellUser;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [cmdkSearch, setCmdkSearch] = useState("");
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [wsDropdownOpen, setWsDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const wsRef = React.useRef<HTMLDivElement>(null);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Extract active project from pathname e.g. /projects/[id]
  const pathSegments = pathname.split("/").filter(Boolean);
  const routeProjectId =
    pathSegments[0] === "projects" && pathSegments[1] && pathSegments[1] !== "new"
      ? pathSegments[1]
      : undefined;

  const activeTarget = currentProjectId || routeProjectId;

  // Derive current project dynamically from route or props
  const currentProject =
    (activeTarget
      ? projects.find(
          (p) =>
            p.id.toLowerCase() === activeTarget.toLowerCase() ||
            p.key.toLowerCase() === activeTarget.toLowerCase()
        )
      : undefined) ||
    projects[0] || { id: "", name: "Beacon", key: "BCN" };

  // Dismiss dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wsRef.current && !wsRef.current.contains(event.target as Node)) {
        setWsDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Theme synchronization
  useEffect(() => {
    const saved = localStorage.getItem("beacon_theme") as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  function handleSetTheme(t: "light" | "dark") {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("beacon_theme", t);
  }

  function addToast(text: string) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setCmdkOpen(false);
        setWsDropdownOpen(false);
        setUserMenuOpen(false);
        return;
      }
      if (isInput) return;

      if (e.key === "/") {
        e.preventDefault();
        setCmdkOpen(true);
      } else if (e.key.toLowerCase() === "i" && currentProject.id) {
        router.push(`/projects/${currentProject.id}`);
      } else if (e.key.toLowerCase() === "p") {
        router.push("/projects");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentProject.id, router]);

  const isAdmin = currentUser.role === "ADMIN";

  return (
    <div className="shell">
      <AnimatedBackground />
      {/* SIDEBAR */}
      <div className={`sidebar ${collapsed ? "collapsed" : ""}`} id="sidebar">
        <div className="sb-top">
          <Link href="/projects" className="brand">
            <div className="brand-mark" />
            <span className="brand-name">Beacon</span>
          </Link>
          <button
            type="button"
            className="sb-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title="Toggle sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 3v18M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" />
            </svg>
          </button>
        </div>

        {/* Project Switcher */}
        <div className="relative" ref={wsRef}>
          <button
            type="button"
            className="ws-switcher"
            onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
          >
            <div className="ws-dot" />
            <span className="ws-name">
              {pathname === "/projects" ? "All Projects" : currentProject.name}
            </span>
            <span className="ws-plan">
              {pathname === "/projects" ? "LIST" : currentProject.key}
            </span>
          </button>

          {wsDropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg z-50">
              <div className="px-2 py-1 text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-faint)]">
                Switch Project
              </div>
              <div className="space-y-0.5">
                {projects.map((p) => {
                  const isActive =
                    p.id === currentProject.id ||
                    p.key.toUpperCase() === currentProject.key.toUpperCase();
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setWsDropdownOpen(false);
                        router.push(`/projects/${p.id}`);
                      }}
                      className={`w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition text-left cursor-pointer ${
                        isActive
                          ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold"
                          : "text-[var(--text)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="mono text-[10.5px] text-[var(--text-faint)] font-bold">{p.key}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 border-t border-[var(--border)] pt-1">
                <Link
                  href="/projects"
                  onClick={() => setWsDropdownOpen(false)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs text-[var(--accent)] font-semibold hover:bg-[var(--surface-hover)] transition"
                >
                  Manage all projects →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Group */}
        <div className="nav-group">
          <Link
            href={currentProject.id ? `/projects/${currentProject.id}` : "/projects"}
            className={`nav-item ${pathname.startsWith("/projects/") ? "active" : ""}`}
            title="Dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" rx="1.5" />
              <rect x="14" y="3" width="7" height="5" rx="1.5" />
              <rect x="14" y="12" width="7" height="9" rx="1.5" />
              <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </svg>
            <span className="nav-label">Dashboard</span>
          </Link>

          <Link
            href="/projects"
            className={`nav-item ${pathname === "/projects" ? "active" : ""}`}
            title="Projects"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span className="nav-label">Projects</span>
            <span className="nav-kbd">P</span>
          </Link>

          {isAdmin && (
            <>
              <Link
                href="/admin/users"
                className={`nav-item ${pathname.startsWith("/admin/users") ? "active" : ""}`}
                title="Team & Accounts"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
                <span className="nav-label">Team & Users</span>
              </Link>
              <Link
                href="/admin/statuses"
                className={`nav-item ${pathname.startsWith("/admin/statuses") ? "active" : ""}`}
                title="Workflow & Statuses"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h7" />
                  <circle cx="18" cy="18" r="3" />
                </svg>
                <span className="nav-label">Statuses</span>
              </Link>
              <Link
                href="/admin/usage"
                className={`nav-item ${pathname.startsWith("/admin/usage") ? "active" : ""}`}
                title="Storage & Resource Usage"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                <span className="nav-label">Usage</span>
              </Link>
            </>
          )}
        </div>

        <div className="sb-spacer" />

        {/* User profile footer */}
        <div className="relative" ref={userMenuRef}>
          <div
            className="sb-user"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            title={currentUser.name}
          >
            <div className="avatar">{currentUser.name?.charAt(0) || "U"}</div>
            <div className="sb-user-meta">
              <div className="n">{currentUser.name}</div>
              <div className="r">{currentUser.role}</div>
            </div>
          </div>

          {userMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg z-50">
              <div className="px-3 py-2 border-b border-[var(--border)] mb-1">
                <div className="text-xs font-bold text-[var(--text)]">{currentUser.name}</div>
                <div className="mono text-[10.5px] text-[var(--text-faint)] truncate">{currentUser.email}</div>
                <div className="mt-1">
                  <span className="rounded bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9.5px] font-bold text-[var(--accent)] uppercase">
                    {currentUser.role}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <>
                  <Link
                    href="/admin/users"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
                  >
                    Manage Users & Accounts
                  </Link>
                  <Link
                    href="/admin/statuses"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
                  >
                    Workflow & Statuses
                  </Link>
                  <Link
                    href="/admin/usage"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-[var(--text)] hover:bg-[var(--surface-hover)] transition"
                  >
                    Storage Usage & Cleanup
                  </Link>
                </>
              )}

              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--crit)] hover:bg-[var(--crit-soft)] transition text-left"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MAIN COLUMN */}
      <div className="main">
        {/* Topbar */}
        <div className="topbar">
          <div className="crumb">
            {pathname === "/projects" ? (
              <><b>Workspace</b> / Projects</>
            ) : pathname.startsWith("/admin/statuses") ? (
              <><b>Admin Console</b> / Workflow & Statuses</>
            ) : pathname.startsWith("/admin/usage") ? (
              <><b>Admin Console</b> / Storage Usage</>
            ) : pathname.startsWith("/admin") ? (
              <><b>Admin Console</b> / Team & Users</>
            ) : (
              <><b>{currentProject.name}</b> / {currentProject.key}</>
            )}
          </div>

          {/* Search Trigger */}
          <div
            className="search-trigger"
            onClick={() => setCmdkOpen(true)}
            id="searchTrigger"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span>Search or jump to…</span>
            <span className="kbd-pill">⌘K</span>
          </div>

          {/* Actions & Theme */}
          <div className="top-actions">
            <button
              type="button"
              className="icon-btn has-unread"
              title="Notifications"
              onClick={() => addToast("No unread notifications")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              <span className="dot-badge" />
            </button>


            {/* Light / Dark Switcher */}
            <div className="theme-switch">
              <button
                type="button"
                id="lightBtn"
                className={theme === "light" ? "active" : ""}
                onClick={() => handleSetTheme("light")}
                title="Light"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              </button>
              <button
                type="button"
                id="darkBtn"
                className={theme === "dark" ? "active" : ""}
                onClick={() => handleSetTheme("dark")}
                title="Dark"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              </button>
            </div>

            <div className="avatar" style={{ width: 30, height: 30 }}>
              {currentUser.name?.charAt(0) || "U"}
            </div>
          </div>
        </div>

        {/* Scrollable Page Body */}
        <div className="scroll">{children}</div>
      </div>

      {/* COMMAND PALETTE */}
      <div
        className={`cmdk-overlay ${cmdkOpen ? "open" : ""}`}
        onClick={() => setCmdkOpen(false)}
      >
        <div className="cmdk" onClick={(e) => e.stopPropagation()}>
          <div className="cmdk-input-row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-faint)" }}>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              autoFocus={cmdkOpen}
              placeholder="Search issues, projects, or type a command…"
              value={cmdkSearch}
              onChange={(e) => setCmdkSearch(e.target.value)}
            />
            <span className="kbd-pill">esc</span>
          </div>
          <div className="cmdk-list">
            <div className="cmdk-sec">Quick actions</div>
            <div
              className="cmdk-item sel"
              onClick={() => {
                setCmdkOpen(false);
                if (currentProject.id) router.push(`/projects/${currentProject.id}`);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
              </svg>
              Go to {currentProject.name} Dashboard
              <span className="kbd-pill">I</span>
            </div>

            <div
              className="cmdk-item"
              onClick={() => {
                setCmdkOpen(false);
                router.push("/projects");
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              View all projects
              <span className="kbd-pill">P</span>
            </div>

            {isAdmin && (
              <div
                className="cmdk-item"
                onClick={() => {
                  setCmdkOpen(false);
                  router.push("/admin/users");
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                Manage Team & Users
              </div>
            )}

            <div className="cmdk-sec">Switch Project</div>
            {projects.map((p) => (
              <div
                key={p.id}
                className="cmdk-item"
                onClick={() => {
                  setCmdkOpen(false);
                  router.push(`/projects/${p.id}`);
                }}
              >
                <span className="mono font-bold text-[11px] text-[var(--accent)]">{p.key}</span>
                <span>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOAST STACK */}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast show">
            <span className="tdot" />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
