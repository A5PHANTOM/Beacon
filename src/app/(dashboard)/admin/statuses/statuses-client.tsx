"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  createCustomStatusAction,
  deleteCustomStatusAction,
  type CustomStatusItem,
} from "./actions";

type StandardStatusDef = {
  key: string;
  label: string;
  color: string;
  category: "TODO" | "IN_PROGRESS" | "DONE" | "INVALID";
  description: string;
};

const STANDARD_STATUSES: StandardStatusDef[] = [
  { key: "OPEN", label: "Open", color: "#3B82F6", category: "TODO", description: "Issue has been logged and is awaiting development triage." },
  { key: "READY_FOR_DEV", label: "Ready for Dev", color: "#06B6D4", category: "TODO", description: "Triaged, prioritized, and ready to be picked up by a developer." },
  { key: "DEV_IN_PROGRESS", label: "Dev In Progress", color: "#6366F1", category: "IN_PROGRESS", description: "Developer is actively writing code and fixing the issue." },
  { key: "DEV_REVIEW", label: "Dev Review", color: "#8B5CF6", category: "IN_PROGRESS", description: "Pull request / code review in progress by engineering team." },
  { key: "DEV_COMPLETED", label: "Dev Completed", color: "#10B981", category: "IN_PROGRESS", description: "Fix implemented and ready for branch deployment." },
  { key: "DEV_DEPLOYED", label: "Dev Deployed", color: "#14B8A6", category: "IN_PROGRESS", description: "Deployed to internal dev environment for staging verification." },
  { key: "QA_IN_PROGRESS", label: "QA In Progress", color: "#F59E0B", category: "IN_PROGRESS", description: "QA team is actively testing the fix." },
  { key: "QA_DEPLOYED", label: "QA Deployed", color: "#10B981", category: "DONE", description: "Fix verified and deployed to QA environment." },
  { key: "READY_FOR_RELEASE", label: "Ready for Release", color: "#EC4899", category: "DONE", description: "Passed QA validation and ready for production deployment." },
  { key: "PROD_DEPLOYED", label: "Prod Deployed", color: "#059669", category: "DONE", description: "Live in production environment." },
  { key: "CLOSED", label: "Closed", color: "#64748B", category: "DONE", description: "Issue lifecycle is complete and verified." },
  { key: "INVALID", label: "Invalid", color: "#EF4444", category: "INVALID", description: "Duplicate, not reproducible, or rejected by triage." },
];

const PRESET_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#64748B", // Slate
  "#E11D48", // Rose
];

export function StatusesClient({
  initialCustomStatuses,
  systemCounts,
}: {
  initialCustomStatuses: CustomStatusItem[];
  systemCounts: Record<string, number>;
}) {
  const [customStatuses, setCustomStatuses] = useState<CustomStatusItem[]>(initialCustomStatuses);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomStatusItem | null>(null);

  // Form states
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [autoKey, setAutoKey] = useState(true);
  const [color, setColor] = useState("#6366F1");
  const [category, setCategory] = useState<"TODO" | "IN_PROGRESS" | "DONE" | "INVALID">("IN_PROGRESS");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Filter state
  const [activeTab, setActiveTab] = useState<"ALL" | "CUSTOM" | "TODO" | "IN_PROGRESS" | "DONE" | "INVALID">("ALL");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleLabelChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLabel(val);
    if (autoKey) {
      const derived = val
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
      setKey(derived);
    }
  }

  function resetForm() {
    setLabel("");
    setKey("");
    setAutoKey(true);
    setColor("#6366F1");
    setCategory("IN_PROGRESS");
    setDescription("");
    setFormError(null);
  }

  async function handleCreateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) {
      setFormError("Status label is required");
      return;
    }
    setLoading(true);
    setFormError(null);

    const res = await createCustomStatusAction({
      label: label.trim(),
      key: key.trim() || undefined,
      color,
      category,
      description: description.trim() || undefined,
    });

    setLoading(false);
    if (!res.success || !res.data) {
      setFormError(res.error || "Failed to create status");
      return;
    }

    setCustomStatuses((prev) => [...prev, { ...res.data!, issuesCount: 0 }]);
    setIsModalOpen(false);
    resetForm();
    showToast(`Status "${res.data.label}" created successfully`);
  }

  async function handleDeleteStatus(status: CustomStatusItem) {
    setLoading(true);
    const res = await deleteCustomStatusAction(status.id);
    setLoading(false);
    if (!res.success) {
      alert(res.error || "Failed to delete status");
      return;
    }

    setCustomStatuses((prev) => prev.filter((s) => s.id !== status.id));
    setDeleteTarget(null);
    showToast(`Status "${status.label}" deleted`);
  }

  type StatusDisplayItem = {
    id: string;
    key: string;
    label: string;
    color: string;
    category: "TODO" | "IN_PROGRESS" | "DONE" | "INVALID";
    description: string;
    isSystem: boolean;
    issuesCount: number;
    rawItem?: CustomStatusItem;
  };

  // Combined statuses list for view
  const allStatuses: StatusDisplayItem[] = [
    ...STANDARD_STATUSES.map((s) => ({
      id: s.key,
      key: s.key,
      label: s.label,
      color: s.color,
      category: s.category,
      description: s.description,
      isSystem: true,
      issuesCount: systemCounts[s.key] || 0,
    })),
    ...customStatuses.map((s) => ({
      id: s.id,
      key: s.key,
      label: s.label,
      color: s.color,
      category: s.category,
      description: s.description || "Custom status defined by Admin.",
      isSystem: false,
      issuesCount: s.issuesCount || 0,
      rawItem: s,
    })),
  ];

  const filteredStatuses = allStatuses.filter((s) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "CUSTOM") return !s.isSystem;
    return s.category === activeTab;
  });

  const totalIssuesCount = allStatuses.reduce((acc, curr) => acc + curr.issuesCount, 0);

  return (
    <div className="page" style={{ maxWidth: 1200 }}>
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--surface)",
            color: "var(--text)",
            border: "1px solid var(--accent)",
            boxShadow: "var(--shadow-lg)",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--ok)", fontSize: 16 }}>✓</span>
          {toast}
        </div>
      )}

      {/* Breadcrumb & Navigation */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13, color: "var(--text-faint)" }}>
        <Link href="/projects" style={{ color: "var(--text-dim)", textDecoration: "none" }}>
          Workspace
        </Link>
        <span>/</span>
        <span style={{ color: "var(--text)", fontWeight: 600 }}>Admin Console</span>
        <span>/</span>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>Workflow & Statuses</span>
      </div>

      {/* Main Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>
            Workflow & Status Management
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-dim)" }}>
            Customize issue lifecycles. Newly added statuses are automatically enabled in project workspaces and modals.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          style={{ padding: "9px 18px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add New Status
        </button>
      </div>

      {/* Metrics Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>
            Total Statuses
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 0", fontFamily: "IBM Plex Mono, monospace" }}>
            {allStatuses.length}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>
            Custom Statuses
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 0", fontFamily: "IBM Plex Mono, monospace", color: "var(--accent)" }}>
            {customStatuses.length}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>
            Issues Managed
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, margin: "6px 0 0", fontFamily: "IBM Plex Mono, monospace" }}>
            {totalIssuesCount}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        {[
          { id: "ALL", label: `All (${allStatuses.length})` },
          { id: "CUSTOM", label: `Custom (${customStatuses.length})` },
          { id: "TODO", label: "To Do / Backlog" },
          { id: "IN_PROGRESS", label: "In Progress" },
          { id: "DONE", label: "Completed / Done" },
          { id: "INVALID", label: "Invalid / Cancelled" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            style={{
              background: activeTab === tab.id ? "var(--surface-hover)" : "none",
              border: activeTab === tab.id ? "1px solid var(--border-strong)" : "1px solid transparent",
              color: activeTab === tab.id ? "var(--text)" : "var(--text-dim)",
              fontWeight: activeTab === tab.id ? 700 : 500,
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12.5,
              cursor: "pointer",
              transition: "all .12s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Statuses Grid / Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2.2fr 1.2fr 1.2fr 1fr 1fr 80px", padding: "12px 20px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div>Status Name & Description</div>
          <div>Status Key</div>
          <div>Category</div>
          <div>Source</div>
          <div>Issues</div>
          <div style={{ textAlign: "right" }}>Actions</div>
        </div>

        {filteredStatuses.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
            No statuses found in this category.
          </div>
        ) : (
          filteredStatuses.map((s) => (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2.2fr 1.2fr 1.2fr 1fr 1fr 80px",
                alignItems: "center",
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                fontSize: 13,
                transition: "background .12s",
              }}
            >
              {/* Name & Dot */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: s.color,
                    marginTop: 5,
                    flexShrink: 0,
                    boxShadow: `0 0 8px ${s.color}60`,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.4 }}>
                    {s.description}
                  </div>
                </div>
              </div>

              {/* Status Key */}
              <div>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    padding: "2px 7px",
                    borderRadius: 6,
                    color: "var(--text)",
                  }}
                >
                  {s.key}
                </span>
              </div>

              {/* Category */}
              <div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background:
                      s.category === "DONE"
                        ? "var(--ok-soft)"
                        : s.category === "IN_PROGRESS"
                        ? "var(--info-soft)"
                        : s.category === "INVALID"
                        ? "var(--crit-soft)"
                        : "var(--surface-2)",
                    color:
                      s.category === "DONE"
                        ? "var(--ok)"
                        : s.category === "IN_PROGRESS"
                        ? "var(--info)"
                        : s.category === "INVALID"
                        ? "var(--crit)"
                        : "var(--text-dim)",
                    border: "1px solid currentColor",
                  }}
                >
                  {s.category.replace(/_/g, " ")}
                </span>
              </div>

              {/* Source */}
              <div>
                {s.isSystem ? (
                  <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Standard</span>
                ) : (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)" }}>
                    ★ Custom
                  </span>
                )}
              </div>

              {/* Issues count */}
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>
                  {s.issuesCount} {s.issuesCount === 1 ? "issue" : "issues"}
                </span>
              </div>

              {/* Actions */}
              <div style={{ textAlign: "right" }}>
                {!s.isSystem && s.rawItem ? (
                  <button
                    type="button"
                    title="Delete custom status"
                    onClick={() => setDeleteTarget(s.rawItem!)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--crit)",
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>—</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE NEW STATUS MODAL */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 99990,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 540,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
              margin: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Add New Status</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
                  Define a new workflow status for issues across Beacon projects.
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStatus} style={{ padding: "20px 24px" }}>
              {formError && (
                <div style={{ padding: "8px 12px", background: "var(--crit-soft)", border: "1px solid var(--crit)", borderRadius: 8, color: "var(--crit)", fontSize: 12, marginBottom: 14 }}>
                  {formError}
                </div>
              )}

              {/* Status Label */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6 }}>
                  Status Label *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Blocked, Staging QA, Security Review"
                  value={label}
                  onChange={handleLabelChange}
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Status Key */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)" }}>
                    Status Key (Uppercase Identifier) *
                  </label>
                  <label style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={autoKey}
                      onChange={(e) => setAutoKey(e.target.checked)}
                    />
                    Auto-generate from label
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="e.g. BLOCKED, STAGING_QA"
                  value={key}
                  onChange={(e) => {
                    setAutoKey(false);
                    setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""));
                  }}
                  className="mono"
                  required
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12.5,
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Category */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6 }}>
                  Workflow Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 13,
                    color: "var(--text)",
                    outline: "none",
                  }}
                >
                  <option value="TODO">To Do / Backlog (Awaiting work)</option>
                  <option value="IN_PROGRESS">In Progress (Active development / testing)</option>
                  <option value="DONE">Done / Completed (Resolved or deployed)</option>
                  <option value="INVALID">Invalid / Cancelled (Rejected / won't fix)</option>
                </select>
              </div>

              {/* Color Selection */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6 }}>
                  Badge & Dot Color *
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: c,
                        border: color === c ? "2px solid #fff" : "2px solid transparent",
                        boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                        cursor: "pointer",
                        transition: "transform .1s",
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ width: 34, height: 34, borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer", background: "none" }}
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="mono"
                    style={{
                      width: 100,
                      padding: "6px 8px",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "var(--text)",
                    }}
                  />
                  {/* Live preview badge */}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{label || "Status Preview"}</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-dim)", marginBottom: 6 }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain when this status should be used..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12.5,
                    color: "var(--text)",
                    outline: "none",
                    resize: "none",
                  }}
                />
              </div>

              {/* Form Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: "initial", minWidth: 90 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                  style={{ flex: "initial", minWidth: 120 }}
                >
                  {loading ? "Creating..." : "Save Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "var(--shadow-lg)",
              padding: "20px 24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--crit)" }}>
              Delete Custom Status?
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-dim)", lineHeight: 1.5 }}>
              Are you sure you want to delete status <b>{deleteTarget.label}</b> (<code>{deleteTarget.key}</code>)?
            </p>
            {deleteTarget.issuesCount && deleteTarget.issuesCount > 0 ? (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "var(--crit-soft)", border: "1px solid var(--crit)", borderRadius: 8, fontSize: 12, color: "var(--crit)" }}>
                Warning: {deleteTarget.issuesCount} issue(s) are currently in this status. Reassign them before deleting.
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDeleteTarget(null)}
                style={{ flex: "initial", minWidth: 80 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading || Boolean(deleteTarget.issuesCount && deleteTarget.issuesCount > 0)}
                onClick={() => handleDeleteStatus(deleteTarget)}
                style={{
                  background: "var(--crit)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: deleteTarget.issuesCount && deleteTarget.issuesCount > 0 ? "not-allowed" : "pointer",
                  opacity: deleteTarget.issuesCount && deleteTarget.issuesCount > 0 ? 0.5 : 1,
                }}
              >
                {loading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
