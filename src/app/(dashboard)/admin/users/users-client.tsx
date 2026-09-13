"use client";

import { useState } from "react";
import {
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Code2,
  Bug,
  Shield,
  Layers,
} from "lucide-react";
import { createUserAction, deleteUserAction } from "./actions";

type UserItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  memberships: {
    projectId: string;
    projectName: string;
    projectKey: string;
    roleInProject: string;
  }[];
  _count: {
    reported: number;
    assigned: number;
  };
};

type ProjectOption = {
  id: string;
  name: string;
  key: string;
};

export function UsersClient({
  initialUsers,
  projects,
  currentUserId,
}: {
  initialUsers: UserItem[];
  projects: ProjectOption[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<UserItem[]>(initialUsers);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("1234");
  const [roleType, setRoleType] = useState<"DEVELOPER" | "QA" | "ADMIN">("DEVELOPER");
  const [assignProjectId, setAssignProjectId] = useState<string>(projects[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const developerCount = users.filter((u) =>
    u.memberships.some((m) => m.roleInProject === "DEVELOPER")
  ).length;
  const testerCount = users.filter((u) =>
    u.memberships.some((m) => m.roleInProject === "QA")
  ).length;
  const adminCount = users.filter((u) => u.role === "ADMIN").length;

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const globalRole = roleType === "ADMIN" ? "ADMIN" : "MEMBER";
    const projectRole =
      roleType === "ADMIN" ? "LEAD" : roleType === "QA" ? "QA" : "DEVELOPER";

    const res = await createUserAction({
      name,
      email,
      password,
      role: globalRole,
      assignToProjectId: assignProjectId || undefined,
      projectRole: assignProjectId ? projectRole : undefined,
    });

    setLoading(false);

    if (!res.success) {
      setError(res.error || "Failed to create user");
    } else {
      setSuccess(`Account created for ${name} (${email})!`);
      // Update local state
      const targetProj = projects.find((p) => p.id === assignProjectId);
      const newEntry: UserItem = {
        id: res.data!.id,
        name: res.data!.name,
        email: res.data!.email,
        role: res.data!.role,
        createdAt: new Date().toISOString(),
        memberships: targetProj
          ? [
              {
                projectId: targetProj.id,
                projectName: targetProj.name,
                projectKey: targetProj.key,
                roleInProject: projectRole,
              },
            ]
          : [],
        _count: { reported: 0, assigned: 0 },
      };
      setUsers((prev) => [newEntry, ...prev]);
      setName("");
      setEmail("");
      setPassword("1234");
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(null);
      }, 1200);
    }
  }

  async function handleDelete(userId: string, userName: string) {
    if (!confirm(`Are you sure you want to delete user "${userName}"?`)) {
      return;
    }

    const res = await deleteUserAction(userId);
    if (!res.success) {
      alert(res.error || "Failed to delete user");
    } else {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div className="dash-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="date">ADMIN CONSOLE</div>
          <h1>Team & User Management</h1>
          <p>
            Create Developer, Tester (QA), and Admin accounts and manage project access across your workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <UserPlus className="h-4 w-4" />
          Create New Account
        </button>
      </div>

      {/* Overview Metrics Cards */}
      <div className="metrics" style={{ marginBottom: 32 }}>
        <div className="metric">
          <div className="mlabel">
            <span>Total Accounts</span>
          </div>
          <div className="mnum">{users.length}</div>
          <div className="mtrend flat">Active team members</div>
          <div className="mfoot">
            <span className="mperiod">Workspace wide</span>
          </div>
        </div>

        <div className="metric">
          <div className="mlabel">
            <span>Developers</span>
          </div>
          <div className="mnum" style={{ color: "var(--info)" }}>{developerCount}</div>
          <div className="mtrend down">Code & bug fixing</div>
          <div className="mfoot">
            <span className="mperiod">Assigned engineering</span>
          </div>
        </div>

        <div className="metric">
          <div className="mlabel">
            <span>Testers / QA</span>
          </div>
          <div className="mnum" style={{ color: "var(--warn)" }}>{testerCount}</div>
          <div className="mtrend up">Verification & QA</div>
          <div className="mfoot">
            <span className="mperiod">Quality assurance</span>
          </div>
        </div>

        <div className="metric">
          <div className="mlabel">
            <span>Administrators</span>
          </div>
          <div className="mnum" style={{ color: "var(--accent)" }}>{adminCount}</div>
          <div className="mtrend flat">Full governance</div>
          <div className="mfoot">
            <span className="mperiod">Workspace admin</span>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "var(--shadow-xs)",
        }}
      >
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" }}>Registered Accounts</h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)" }}>
            System accounts eligible to be assigned as developers, testers, or leads on projects.
          </p>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-faint)" }}>User</th>
                <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-faint)" }}>Global Role</th>
                <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-faint)" }}>Project Assignments</th>
                <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-faint)" }}>Workload</th>
                <th style={{ padding: "12px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-faint)", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="mini-avatar" style={{ background: "var(--accent)", width: 28, height: 28, fontSize: 12 }}>
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                            {user.name}
                            {isSelf && (
                              <span style={{ fontSize: 9.5, background: "var(--surface-2)", padding: "1px 5px", borderRadius: 4, color: "var(--text-faint)" }}>
                                You
                              </span>
                            )}
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: user.role === "ADMIN" ? "var(--accent-soft)" : "var(--surface-2)",
                          color: user.role === "ADMIN" ? "var(--accent)" : "var(--text-dim)",
                        }}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      {user.memberships.length === 0 ? (
                        <span style={{ fontSize: 11.5, color: "var(--text-faint)", fontStyle: "italic" }}>No projects assigned</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {user.memberships.map((m) => (
                            <span
                              key={m.projectId}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                background:
                                  m.roleInProject === "DEVELOPER"
                                    ? "var(--info-soft)"
                                    : m.roleInProject === "QA"
                                    ? "var(--warn-soft)"
                                    : "var(--accent-soft)",
                                color:
                                  m.roleInProject === "DEVELOPER"
                                    ? "var(--info)"
                                    : m.roleInProject === "QA"
                                    ? "var(--warn)"
                                    : "var(--accent)",
                              }}
                            >
                              <span className="mono font-bold">{m.projectKey}</span>
                              <span>•</span>
                              <span>{m.roleInProject === "QA" ? "Tester" : m.roleInProject}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 11.5, color: "var(--text-dim)" }}>
                      <div><b>{user._count.assigned}</b> assigned</div>
                      <div style={{ color: "var(--text-faint)" }}><b>{user._count.reported}</b> reported</div>
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      {!isSelf && (
                        <button
                          type="button"
                          onClick={() => handleDelete(user.id, user.name)}
                          style={{ background: "none", border: "none", color: "var(--crit)", cursor: "pointer", padding: 4 }}
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--overlay)",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>Create New Account</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
                  Provision access for developers, testers (QA), or administrators.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ background: "var(--crit-soft)", border: "1px solid var(--crit-bd)", color: "var(--crit)", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ background: "var(--ok-soft)", border: "1px solid var(--ok)", color: "var(--ok)", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14, fontWeight: 600 }}>
                {success}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Miller"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. jordan.dev@beacon.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                  Password
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 4 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6 }}>
                  Account Specialization
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setRoleType("DEVELOPER")}
                    style={{
                      background: roleType === "DEVELOPER" ? "var(--info-soft)" : "var(--surface-2)",
                      border: `1.5px solid ${roleType === "DEVELOPER" ? "var(--info)" : "var(--border)"}`,
                      color: roleType === "DEVELOPER" ? "var(--info)" : "var(--text)",
                      borderRadius: 10,
                      padding: 10,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <Code2 className="h-4 w-4" style={{ margin: "0 auto 4px" }} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Developer</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-faint)" }}>Fix & code</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoleType("QA")}
                    style={{
                      background: roleType === "QA" ? "var(--warn-soft)" : "var(--surface-2)",
                      border: `1.5px solid ${roleType === "QA" ? "var(--warn)" : "var(--border)"}`,
                      color: roleType === "QA" ? "var(--warn)" : "var(--text)",
                      borderRadius: 10,
                      padding: 10,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <Bug className="h-4 w-4" style={{ margin: "0 auto 4px" }} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Tester / QA</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-faint)" }}>Log & verify</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRoleType("ADMIN")}
                    style={{
                      background: roleType === "ADMIN" ? "var(--accent-soft)" : "var(--surface-2)",
                      border: `1.5px solid ${roleType === "ADMIN" ? "var(--accent)" : "var(--border)"}`,
                      color: roleType === "ADMIN" ? "var(--accent)" : "var(--text)",
                      borderRadius: 10,
                      padding: 10,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <Shield className="h-4 w-4" style={{ margin: "0 auto 4px" }} />
                    <div style={{ fontSize: 12, fontWeight: 700 }}>Admin</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-faint)" }}>All projects</div>
                  </button>
                </div>
              </div>

              {projects.length > 0 && roleType !== "ADMIN" && (
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                    Initial Project Assignment (Optional)
                  </label>
                  <select
                    value={assignProjectId}
                    onChange={(e) => setAssignProjectId(e.target.value)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text)", outline: "none" }}
                  >
                    <option value="">-- Assign Later --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.key})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ margin: 0 }}
                >
                  {loading ? "Creating…" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


