"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  FolderKanban,
  Users,
  LogOut,
  ChevronDown,
  Layers,
  PlusCircle,
} from "lucide-react";
import { useState, useEffect } from "react";

type SimpleProject = {
  id: string;
  name: string;
  key: string;
};

export function Navbar({
  projects = [],
  currentProjectId,
}: {
  projects?: SimpleProject[];
  currentProjectId?: string;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Close menus on path change or outside click
  useEffect(() => {
    setProjectMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  const currentProject = projects.find((p) => p.id === currentProjectId) || projects[0];
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Brand + Project Switcher + Nav Links */}
        <div className="flex items-center gap-6">
          <Link href="/projects" className="flex items-center gap-2.5 font-bold tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 font-bold text-white shadow-sm shadow-indigo-200">
              B
            </span>
            <span className="text-lg">Beacon</span>
          </Link>

          {/* Project Switcher Dropdown */}
          {projects.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProjectMenuOpen(!projectMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                <Layers className="h-3.5 w-3.5 text-indigo-600" />
                <span>{currentProject ? currentProject.name : "Select Project"}</span>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono">
                  {currentProject?.key}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {projectMenuOpen && (
                <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50">
                  <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Switch Project
                  </div>
                  <div className="space-y-0.5">
                    {projects.map((proj) => (
                      <Link
                        key={proj.id}
                        href={`/projects/${proj.id}`}
                        onClick={() => setProjectMenuOpen(false)}
                        className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                          proj.id === currentProjectId
                            ? "bg-indigo-50 text-indigo-700 font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">{proj.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
                          {proj.key}
                        </span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-1.5 border-t border-slate-100 pt-1.5">
                    <Link
                      href="/projects"
                      onClick={() => setProjectMenuOpen(false)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-indigo-600 font-medium hover:bg-indigo-50 transition"
                    >
                      <PlusCircle className="h-3.5 w-3.5" />
                      Manage all projects
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nav items */}
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              href="/projects"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                pathname === "/projects"
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <FolderKanban className="h-4 w-4" />
              Projects
            </Link>

            {isAdmin && (
              <Link
                href="/admin/users"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  pathname.startsWith("/admin")
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Users className="h-4 w-4" />
                Team & Users (Admin)
              </Link>
            )}
          </nav>
        </div>

        {/* Right: User profile menu */}
        <div className="flex items-center gap-3">
          {session?.user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-3 text-left hover:bg-slate-100 transition"
              >
                <div className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                  {session.user.name?.charAt(0) || "U"}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {session.user.name}
                  </div>
                  <div className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                    {session.user.role}
                  </div>
                </div>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1">
                    <p className="text-xs font-bold text-slate-800">{session.user.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{session.user.email}</p>
                    <div className="mt-1">
                      <span className="inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                        Global {session.user.role}
                      </span>
                    </div>
                  </div>

                  {isAdmin && (
                    <Link
                      href="/admin/users"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                      Manage Users & Accounts
                    </Link>
                  )}

                  <Link
                    href="/projects"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FolderKanban className="h-3.5 w-3.5 text-slate-500" />
                    All Projects
                  </Link>

                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
