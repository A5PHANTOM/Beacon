"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  Plus,
  Users,
  ArrowRight,
  Shield,
  Code2,
  Bug,
  Eye,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  UserX,
  Trash2,
} from "lucide-react";
import {
  createProjectAction,
  assignProjectMemberAction,
  removeProjectMemberAction,
  deleteProjectAction,
} from "./actions";

type ProjectData = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  createdById?: string;
  createdAt: string;
  _count: {
    issues: number;
    members: number;
  };
  openIssuesCount: number;
  members: {
    userId: string;
    userName: string;
    userEmail: string;
    userRole: string;
    roleInProject: string;
  }[];
};

type AvailableUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export function ProjectsClient({
  initialProjects,
  allUsers,
  currentUserId,
  isAdmin,
}: {
  initialProjects: ProjectData[];
  allUsers: AvailableUser[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects);

  // New Project modal state
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectKey, setNewProjectKey] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Team Management modal state
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRole, setAssignRole] = useState<"DEVELOPER" | "QA" | "LEAD" | "VIEWER">("DEVELOPER");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  // Delete Project modal state
  const [projectToDelete, setProjectToDelete] = useState<ProjectData | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDeleteProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectToDelete) return;

    if (deleteConfirmText.trim().toUpperCase() !== projectToDelete.key.toUpperCase()) {
      setDeleteError(`Please type "${projectToDelete.key}" to confirm deletion.`);
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);

    const res = await deleteProjectAction({ projectId: projectToDelete.id });
    setDeleteLoading(false);

    if (!res.success) {
      setDeleteError(res.error || "Failed to delete project");
    } else {
      setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
      setProjectToDelete(null);
      setDeleteConfirmText("");
      router.refresh();
    }
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);

    const res = await createProjectAction({
      name: newProjectName,
      key: newProjectKey,
      description: newProjectDesc,
    });

    setCreateLoading(false);

    if (!res.success) {
      setCreateError(res.error || "Failed to create project");
    } else {
      setIsNewProjectOpen(false);
      setNewProjectName("");
      setNewProjectKey("");
      setNewProjectDesc("");
      router.refresh();
    }
  }

  async function handleAssignMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject || !assignUserId) return;

    setAssignError(null);
    setAssignSuccess(null);
    setAssignLoading(true);

    const res = await assignProjectMemberAction({
      projectId: selectedProject.id,
      userId: assignUserId,
      roleInProject: assignRole,
    });

    setAssignLoading(false);

    if (!res.success) {
      setAssignError(res.error || "Failed to assign member");
    } else {
      const assignedUser = allUsers.find((u) => u.id === assignUserId);
      setAssignSuccess(`Assigned ${assignedUser?.name || "member"} as ${assignRole}!`);

      // Update local state
      const updatedMembers = [
        ...selectedProject.members.filter((m) => m.userId !== assignUserId),
        {
          userId: assignUserId,
          userName: assignedUser?.name || "User",
          userEmail: assignedUser?.email || "",
          userRole: assignedUser?.role || "MEMBER",
          roleInProject: assignRole,
        },
      ];

      const updatedProject = {
        ...selectedProject,
        members: updatedMembers,
        _count: {
          ...selectedProject._count,
          members: updatedMembers.length,
        },
      };

      setSelectedProject(updatedProject);
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? updatedProject : p))
      );
      setAssignUserId("");

      setTimeout(() => setAssignSuccess(null), 1500);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedProject) return;
    if (!confirm("Are you sure you want to remove this member from the project?")) return;

    const res = await removeProjectMemberAction(selectedProject.id, userId);
    if (!res.success) {
      alert(res.error || "Failed to remove member");
    } else {
      const updatedMembers = selectedProject.members.filter((m) => m.userId !== userId);
      const updatedProject = {
        ...selectedProject,
        members: updatedMembers,
        _count: {
          ...selectedProject._count,
          members: updatedMembers.length,
        },
      };
      setSelectedProject(updatedProject);
      setProjects((prev) =>
        prev.map((p) => (p.id === selectedProject.id ? updatedProject : p))
      );
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div className="dash-head" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="date">WORKSPACE PROJECTS</div>
          <h1>Projects</h1>
          <p>
            Select a project to enter its issue board, or assign developers and testers to project teams.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsNewProjectOpen(true)}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" />
            Create Project
          </button>
        )}
      </div>

      {/* Projects Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18, marginTop: 24 }}>
        {projects.map((project, index) => {
          const lead = project.members.find((m) => m.roleInProject === "LEAD");
          const developers = project.members.filter((m) => m.roleInProject === "DEVELOPER");
          const testers = project.members.filter((m) => m.roleInProject === "QA");
          const solvedCount = project._count.issues - project.openIssuesCount;
          const solveRate = project._count.issues > 0 ? Math.round((solvedCount / project._count.issues) * 100) : 0;

          return (
            <div
              key={project.id}
              className="spotlight-card animate-float-in"
              style={{
                padding: 22,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                animationDelay: `${index * 60}ms`,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      className="mono"
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                        fontWeight: 700,
                        fontSize: 13,
                        border: "1px solid var(--border)",
                      }}
                    >
                      {project.key}
                    </span>
                    <div>
                      <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                        {project.name}
                      </h2>
                      <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                        Lead: {lead ? lead.userName : "None"}
                      </span>
                    </div>
                  </div>

                  {/* Delete Project Option for Admins / Leads / Creators */}
                  {(isAdmin ||
                    project.createdById === currentUserId ||
                    project.members.some(
                      (m) => m.userId === currentUserId && m.roleInProject === "LEAD"
                    )) && (
                    <button
                      type="button"
                      onClick={() => {
                        setProjectToDelete(project);
                        setDeleteConfirmText("");
                        setDeleteError(null);
                      }}
                      title={`Delete project "${project.name}"`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        background: "transparent",
                        border: "1px solid transparent",
                        color: "var(--text-faint)",
                        cursor: "pointer",
                        transition: "all .15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--crit)";
                        e.currentTarget.style.background = "var(--crit-soft)";
                        e.currentTarget.style.borderColor = "var(--crit-bd)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-faint)";
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <p style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5, minHeight: 38, margin: "0 0 16px" }}>
                  {project.description || "No description provided."}
                </p>

                {/* Team summary box */}
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 14,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Users className="h-3.5 w-3.5" style={{ color: "var(--text-faint)" }} />
                      Team ({project.members.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedProject(project)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent)",
                        fontWeight: 700,
                        fontSize: 11.5,
                        cursor: "pointer",
                      }}
                    >
                      {isAdmin ? "Manage & Assign" : "View Team"}
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {developers.length > 0 && (
                      <span
                        style={{
                          background: "var(--info-soft)",
                          color: "var(--info)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {developers.length} Dev{developers.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {testers.length > 0 && (
                      <span
                        style={{
                          background: "var(--warn-soft)",
                          color: "var(--warn)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {testers.length} Tester{testers.length > 1 ? "s" : ""}
                      </span>
                    )}
                    {project.members.length === 0 && (
                      <span style={{ color: "var(--text-faint)", fontStyle: "italic", fontSize: 11 }}>
                        No assigned members
                      </span>
                    )}
                  </div>
                </div>

                {/* Lifetime Project Issue Counter */}
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: "0.02em" }}>
                      Lifetime Issues (Since {new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})
                    </span>
                    <span className="mono" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ok)" }}>
                      {solveRate}% Solved
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, textAlign: "center" }}>
                    <div>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                        {project._count.issues}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-faint)", display: "block" }}>Total</span>
                    </div>
                    <div>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--ok)" }}>
                        {solvedCount}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--ok)", display: "block" }}>Solved</span>
                    </div>
                    <div>
                      <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--warn)" }}>
                        {project.openIssuesCount}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--warn)", display: "block" }}>Active Open</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 6, width: "100%", borderRadius: 99, background: "var(--border)", overflow: "hidden", display: "flex" }}>
                    {project._count.issues > 0 ? (
                      <>
                        <div
                          className="animated-progress-fill"
                          style={{
                            width: `${(solvedCount / project._count.issues) * 100}%`,
                            transition: "width .3s",
                          }}
                        />
                        <div
                          style={{
                            width: `${(project.openIssuesCount / project._count.issues) * 100}%`,
                            background: "var(--warn)",
                            transition: "width .3s",
                          }}
                        />
                      </>
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "var(--border)" }} />
                    )}
                  </div>
                </div>
              </div>

              {/* Action link */}
              <Link
                href={`/projects/${project.id}`}
                className="btn-primary"
                style={{ justifyContent: "center", padding: "9px 14px", width: "100%" }}
              >
                <span>Open Issue Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>


      {/* New Project Modal */}
      {isAdmin && isNewProjectOpen && (
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
              maxWidth: 460,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>Create New Project</h3>
              <button
                type="button"
                onClick={() => setIsNewProjectOpen(false)}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div style={{ background: "var(--crit-soft)", border: "1px solid var(--crit-bd)", color: "var(--crit)", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateProject} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payments Microservice"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                  Project Key (Issue Prefix)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PAY"
                  maxLength={6}
                  value={newProjectKey}
                  onChange={(e) => setNewProjectKey(e.target.value.toUpperCase())}
                  className="mono"
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", outline: "none", textTransform: "uppercase" }}
                />
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-faint)" }}>
                  Issues will be numbered like {newProjectKey || "KEY"}-1, {newProjectKey || "KEY"}-2.
                </p>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="What is this project about?"
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text)", outline: "none", resize: "none" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <button
                  type="button"
                  onClick={() => setIsNewProjectOpen(false)}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="btn-primary"
                  style={{ margin: 0 }}
                >
                  {createLoading ? "Creating…" : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Team & Assign Members Modal */}
      {selectedProject && (
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
              maxWidth: 560,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "var(--shadow-lg)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "var(--text)" }}>
                  {isAdmin ? "Manage Team & Assign Members" : "Team Members"} — {selectedProject.name} ({selectedProject.key})
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
                  {isAdmin
                    ? "Assign developers and testers, or revoke members from this project."
                    : "View current developers, testers, and leads assigned to this project."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="close-btn"
              >
                ✕
              </button>
            </div>

            {assignError && (
              <div style={{ background: "var(--crit-soft)", border: "1px solid var(--crit-bd)", color: "var(--crit)", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                {assignError}
              </div>
            )}

            {assignSuccess && (
              <div style={{ background: "var(--ok-soft)", border: "1px solid var(--ok)", color: "var(--ok)", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14, fontWeight: 600 }}>
                {assignSuccess}
              </div>
            )}

            {/* Current Members List */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 8 }}>
                Current Assigned Team ({selectedProject.members.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--border)", borderRadius: 10, padding: 8 }}>
                {selectedProject.members.map((member) => (
                  <div
                    key={member.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--surface-2)",
                      padding: "8px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div className="mini-avatar" style={{ background: "var(--accent)" }}>
                        {member.userName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text)" }}>{member.userName}</div>
                        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{member.userEmail}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 10,
                          fontWeight: 700,
                          background:
                            member.roleInProject === "DEVELOPER"
                              ? "var(--info-soft)"
                              : member.roleInProject === "QA"
                              ? "var(--warn-soft)"
                              : "var(--accent-soft)",
                          color:
                            member.roleInProject === "DEVELOPER"
                              ? "var(--info)"
                              : member.roleInProject === "QA"
                              ? "var(--warn)"
                              : "var(--accent)",
                        }}
                      >
                        {member.roleInProject === "QA" ? "Tester (QA)" : member.roleInProject}
                      </span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.userId)}
                          style={{ background: "none", border: "none", color: "var(--crit)", cursor: "pointer", fontSize: 11, padding: 2 }}
                          title="Revoke member from project"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {selectedProject.members.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--text-faint)", fontSize: 12, padding: 12 }}>
                    No members assigned yet.
                  </div>
                )}
              </div>
            </div>

            {/* Assign Member Form or Admin Privilege Notice */}
            {isAdmin ? (
              <form onSubmit={handleAssignMember} style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>
                  Assign New Team Member
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                      Select User
                    </label>
                    <select
                      value={assignUserId}
                      onChange={(e) => setAssignUserId(e.target.value)}
                      required
                      style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}
                    >
                      <option value="">Choose a user…</option>
                      {allUsers
                        .filter((u) => !selectedProject.members.some((m) => m.userId === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 4 }}>
                      Project Role
                    </label>
                    <select
                      value={assignRole}
                      onChange={(e) =>
                        setAssignRole(
                          e.target.value as "DEVELOPER" | "QA" | "LEAD" | "VIEWER"
                        )
                      }
                      style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}
                    >
                      <option value="DEVELOPER">Developer (Fix bugs & code)</option>
                      <option value="QA">Tester / QA (Report & verify fixes)</option>
                      <option value="LEAD">Project Lead (Manage team & issues)</option>
                      <option value="VIEWER">Viewer (Read only)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
                  {(isAdmin ||
                    selectedProject.createdById === currentUserId) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const p = selectedProject;
                        setSelectedProject(null);
                        setProjectToDelete(p);
                        setDeleteConfirmText("");
                        setDeleteError(null);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--crit)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Project
                    </button>
                  ) : <div />}

                  <button
                    type="submit"
                    disabled={assignLoading || !assignUserId}
                    className="btn-primary"
                    style={{ margin: 0, padding: "8px 14px" }}
                  >
                    {assignLoading ? "Assigning…" : "Assign to Project"}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-faint)" }}>
                  <Shield className="h-4 w-4" style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <span>Only administrators have the privilege of assigning and revoking team members.</span>
                </div>
                {selectedProject.createdById === currentUserId && (
                  <button
                    type="button"
                    onClick={() => {
                      const p = selectedProject;
                      setSelectedProject(null);
                      setProjectToDelete(p);
                      setDeleteConfirmText("");
                      setDeleteError(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--crit)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete Project
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--overlay)",
            padding: 16,
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--crit-soft)",
                  border: "1px solid var(--crit-bd)",
                  color: "var(--crit)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 className="h-5 w-5" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 4px", color: "var(--text)" }}>
                  Delete Project
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.4 }}>
                  Are you sure you want to permanently delete{" "}
                  <strong style={{ color: "var(--text)" }}>{projectToDelete.name}</strong> [
                  <span className="mono" style={{ fontWeight: 700 }}>{projectToDelete.key}</span>]?
                </p>
              </div>
            </div>

            <div
              style={{
                background: "var(--crit-soft)",
                border: "1px solid var(--crit-bd)",
                color: "var(--crit)",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12,
                lineHeight: 1.45,
                marginBottom: 16,
                fontWeight: 500,
              }}
            >
              ⚠️ <strong>Warning:</strong> This action cannot be undone. All {projectToDelete._count.issues} issues, comments, attachments, activity history, and member roles in this project will be permanently erased.
            </div>

            {deleteError && (
              <div
                style={{
                  background: "var(--crit-soft)",
                  border: "1px solid var(--crit-bd)",
                  color: "var(--crit)",
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  marginBottom: 14,
                }}
              >
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteProject}>
              <div style={{ marginBottom: 18 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "var(--text-dim)",
                    marginBottom: 6,
                  }}
                >
                  Type <strong style={{ color: "var(--text)" }}>{projectToDelete.key}</strong> to confirm deletion:
                </label>
                <input
                  type="text"
                  required
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={projectToDelete.key}
                  className="mono"
                  style={{
                    width: "100%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 13,
                    color: "var(--text)",
                    outline: "none",
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => {
                    setProjectToDelete(null);
                    setDeleteConfirmText("");
                    setDeleteError(null);
                  }}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== projectToDelete.key.toUpperCase()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "var(--crit)",
                    border: "none",
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor:
                      deleteLoading || deleteConfirmText.trim().toUpperCase() !== projectToDelete.key.toUpperCase()
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      deleteConfirmText.trim().toUpperCase() !== projectToDelete.key.toUpperCase() ? 0.6 : 1,
                    transition: "opacity .15s",
                  }}
                >
                  {deleteLoading ? "Deleting Project…" : "Delete Project Permanently"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

