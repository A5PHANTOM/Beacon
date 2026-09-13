"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Database,
  HardDrive,
  Users,
  Trash2,
  Image as ImageIcon,
  FileText,
  ShieldCheck,
  RefreshCw,
  Search,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import {
  StorageUsageData,
  AttachmentItem,
  getStorageUsageEstimateAction,
  deleteIssueAttachmentAction,
  bulkDeleteIssueAttachmentsAction,
} from "./actions";

export function UsageClient({ initialData }: { initialData: StorageUsageData }) {
  const [data, setData] = useState<StorageUsageData>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [previewImage, setPreviewImage] = useState<AttachmentItem | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<AttachmentItem | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string; type: "success" | "error" } | null>(
    null
  );

  const showToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToast({ id, text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3500);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await getStorageUsageEstimateAction();
    setRefreshing(false);
    if (res.success && res.data) {
      setData(res.data);
      showToast("Storage estimates updated successfully");
    } else {
      showToast(res.error || "Failed to refresh storage data", "error");
    }
  };

  const handleDeleteSingle = async (att: AttachmentItem) => {
    setDeletingId(att.id);
    const res = await deleteIssueAttachmentAction(att.id);
    setDeletingId(null);
    setConfirmDeleteModal(null);

    if (res.success) {
      showToast(
        `Deleted screenshot "${att.filename}" (${(att.size / 1024).toFixed(1)} KB freed). Issue ${att.issueKey} remains completely intact!`
      );
      // Update local state
      const freedBytes = res.freedBytes || att.size;
      const updatedAttachments = data.attachments.filter((a) => a.id !== att.id);
      const newImageBytes = Math.max(0, data.imageStorageBytes - freedBytes);
      const newTotalStorageBytes = newImageBytes + data.databaseRecordsBytes;
      const newTotalMB = Number((newTotalStorageBytes / (1024 * 1024)).toFixed(2));
      const newFreeMB = Number(Math.max(0, data.planLimitMB - newTotalMB).toFixed(2));
      const newPctUsed = Number(((newTotalMB / data.planLimitMB) * 100).toFixed(2));

      setData({
        ...data,
        attachments: updatedAttachments,
        imageStorageBytes: newImageBytes,
        imageStorageMB: Number((newImageBytes / (1024 * 1024)).toFixed(3)),
        imageCount: updatedAttachments.length,
        totalStorageUsedMB: newTotalMB,
        storageFreeMB: newFreeMB,
        percentageUsed: newPctUsed,
        percentageFree: Number((100 - newPctUsed).toFixed(2)),
      });
      setSelectedIds((prev) => prev.filter((id) => id !== att.id));
    } else {
      showToast(res.error || "Failed to delete attachment", "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.length} screenshot attachments? Note: The parent issues and descriptions will remain safe and untouched.`
      )
    ) {
      return;
    }

    setBulkDeleting(true);
    const res = await bulkDeleteIssueAttachmentsAction(selectedIds);
    setBulkDeleting(false);

    if (res.success) {
      showToast(
        `Pruned ${res.deletedCount} screenshots (${(res.freedBytes / 1024).toFixed(1)} KB freed). All issues remain 100% intact.`
      );
      const updatedAttachments = data.attachments.filter((a) => !selectedIds.includes(a.id));
      const newImageBytes = Math.max(0, data.imageStorageBytes - res.freedBytes);
      const newTotalBytes = newImageBytes + data.databaseRecordsBytes;
      const newTotalMB = Number((newTotalBytes / (1024 * 1024)).toFixed(2));
      const newFreeMB = Number(Math.max(0, data.planLimitMB - newTotalMB).toFixed(2));
      const newPctUsed = Number(((newTotalMB / data.planLimitMB) * 100).toFixed(2));

      setData({
        ...data,
        attachments: updatedAttachments,
        imageStorageBytes: newImageBytes,
        imageStorageMB: Number((newImageBytes / (1024 * 1024)).toFixed(3)),
        imageCount: updatedAttachments.length,
        totalStorageUsedMB: newTotalMB,
        storageFreeMB: newFreeMB,
        percentageUsed: newPctUsed,
        percentageFree: Number((100 - newPctUsed).toFixed(2)),
      });
      setSelectedIds([]);
    } else {
      showToast(res.error || "Bulk deletion failed", "error");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAttachments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAttachments.map((a) => a.id));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredAttachments = data.attachments.filter((att) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      att.filename.toLowerCase().includes(q) ||
      att.issueKey.toLowerCase().includes(q) ||
      att.issueTitle.toLowerCase().includes(q) ||
      att.projectName.toLowerCase().includes(q) ||
      att.uploaderName.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 80px" }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: toast.type === "success" ? "#0f172a" : "#dc2626",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
            animation: "slideInUp 0.2s ease-out",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-white shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Admin Navbar Tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: "1px solid var(--border)",
          marginBottom: 24,
          paddingBottom: 10,
        }}
      >
        <Link
          href="/admin/users"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 15px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            background: "transparent",
            color: "var(--text-dim)",
            border: "1px solid transparent",
            transition: "all 0.15s ease",
          }}
        >
          <Users className="h-4 w-4" />
          <span>Team & Users</span>
        </Link>
        <Link
          href="/admin/usage"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "7px 15px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
          }}
        >
          <HardDrive className="h-4 w-4" />
          <span>Usage & Storage</span>
        </Link>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
              Storage Usage & Resource Estimation
            </h1>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                background: "rgba(99, 102, 241, 0.12)",
                color: "#6366f1",
                padding: "3px 9px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Database className="h-3 w-3" /> Admin Tool
            </span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-dim)", margin: 0 }}>
            Real-time calculation of your Prisma Postgres database records and screenshot storage against the 512 MB free tier quota.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn-secondary"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            fontSize: 12.5,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--text)",
            cursor: "pointer",
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          <span>{refreshing ? "Recalculating…" : "Refresh Usage"}</span>
        </button>
      </div>

      {/* Main Storage Gauge Card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
          marginBottom: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Prisma Postgres Free Tier Quota
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 2 }}>
              {data.totalStorageUsedMB}{" "}
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-dim)" }}>
                MB used of {data.planLimitMB}.00 MB
              </span>
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
              Available Storage
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ok, #16a34a)" }}>
              {data.storageFreeMB} MB ({data.percentageFree}% free)
            </div>
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div
          style={{
            height: 14,
            width: "100%",
            background: "var(--surface-2)",
            borderRadius: 999,
            overflow: "hidden",
            display: "flex",
            margin: "12px 0 16px",
            border: "1px solid var(--border)",
          }}
        >
          {/* Images Portion */}
          <div
            title={`Image Attachments: ${data.imageStorageMB} MB`}
            style={{
              width: `${Math.max(0.5, (data.imageStorageMB / data.planLimitMB) * 100)}%`,
              background: "#3b82f6",
              transition: "width 0.3s ease",
            }}
          />
          {/* Database Text Records Portion */}
          <div
            title={`Database Records & Catalog: ${data.databaseRecordsMB} MB`}
            style={{
              width: `${Math.max(0.5, (data.databaseRecordsMB / data.planLimitMB) * 100)}%`,
              background: "#8b5cf6",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", fontSize: 12, color: "var(--text-dim)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#3b82f6" }} />
            <span>Image Attachments ({data.imageStorageMB} MB · {data.imageCount} files)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "#8b5cf6" }} />
            <span>Database Records & Overhead ({data.databaseRecordsMB} MB)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--surface-2)", border: "1px solid var(--border)" }} />
            <span>Free Space ({data.storageFreeMB} MB)</span>
          </div>
        </div>
      </div>

      {/* 4 Detail Metric Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* Card 1: Database Records */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Database Records
            </span>
            <div style={{ background: "rgba(139, 92, 246, 0.1)", padding: 6, borderRadius: 8 }}>
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
            {data.databaseRecordsMB} MB
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <div>• <strong>{data.counts.issues}</strong> Total Issues</div>
            <div>• <strong>{data.counts.comments}</strong> Comments</div>
            <div>• <strong>{data.counts.history}</strong> Audit Log Events</div>
            <div>• <strong>{data.counts.users}</strong> User Accounts</div>
          </div>
        </div>

        {/* Card 2: Image Attachments */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Image Attachments
            </span>
            <div style={{ background: "rgba(59, 130, 246, 0.1)", padding: 6, borderRadius: 8 }}>
              <ImageIcon className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
            {data.imageStorageMB} MB
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <div>• <strong>{data.imageCount}</strong> Screenshots uploaded</div>
            <div>• <strong>{data.averageImageSizeKB} KB</strong> Average image size</div>
            <div>• Can be safely pruned below</div>
          </div>
        </div>

        {/* Card 3: Capacity Estimates */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Remaining Capacity
            </span>
            <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: 6, borderRadius: 8 }}>
              <Sparkles className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ok, #16a34a)", marginBottom: 8 }}>
            Plenty of Room
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <div>• ~<strong>{data.capacityEstimates.moreIssuesTextOnly.toLocaleString()}</strong> more text issues</div>
            <div>• or ~<strong>{data.capacityEstimates.moreScreenshots.toLocaleString()}</strong> more screenshots</div>
            <div>• Zero risk of storage overflow</div>
          </div>
        </div>

        {/* Card 4: Plan Status */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
              Database Plan
            </span>
            <div style={{ background: "rgba(99, 102, 241, 0.1)", padding: 6, borderRadius: 8 }}>
              <HardDrive className="h-4 w-4 text-indigo-600" />
            </div>
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>
            Prisma Postgres
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.6 }}>
            <div>• Plan: <strong>Free Tier (512 MB)</strong></div>
            <div>• Egress: Included</div>
            <div>• Location: Managed Cloud</div>
          </div>
        </div>
      </div>

      {/* Image Deletion & Gallery Section */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: 24,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Section Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: "var(--text)", margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
              <ImageIcon className="h-4 w-4 text-indigo-600" />
              Uploaded Issue Screenshots & Images ({data.attachments.length})
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: 0 }}>
              Review all screenshots attached across all issues. Prune older or large images to reclaim space.
            </p>
          </div>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 13px",
                background: "var(--crit, #dc2626)",
                color: "#ffffff",
                borderRadius: 8,
                border: "none",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{bulkDeleting ? "Deleting…" : `Delete Selected (${selectedIds.length})`}</span>
            </button>
          )}
        </div>

        {/* Safety Notice Banner */}
        <div
          style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: 10,
            padding: "12px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 20,
            fontSize: 12.5,
            color: "var(--text)",
            lineHeight: 1.45,
          }}
        >
          <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" style={{ marginTop: 1 }} />
          <div>
            <strong style={{ color: "var(--ok, #16a34a)", display: "block", marginBottom: 2 }}>
              Safe Image Cleanup Guarantee:
            </strong>
            <span>
              Deleting an image here permanently frees your database/blob storage.{" "}
              <strong>
                Only the image attachment is removed — the parent issue, issue number, title, reproduction steps, comments, and status remain 100% intact and untouched.
              </strong>
            </span>
          </div>
        </div>

        {/* Search and Filters */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by issue key (e.g. TEST-1), title, uploader, or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12.5,
                color: "var(--text)",
                outline: "none",
              }}
            />
          </div>

          {filteredAttachments.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "7px 12px",
                fontSize: 12,
                color: "var(--text-dim)",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              {selectedIds.length === filteredAttachments.length ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>

        {/* Empty State */}
        {filteredAttachments.length === 0 && (
          <div
            style={{
              padding: "48px 20px",
              textAlign: "center",
              background: "var(--surface-2)",
              borderRadius: 10,
              border: "1px dashed var(--border)",
            }}
          >
            <ImageIcon className="h-10 w-10 text-slate-400" style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
              {searchQuery ? "No matching screenshot attachments" : "No image attachments uploaded yet"}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: 0, maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}>
              {searchQuery
                ? "Try clearing your search query to see all attachments."
                : "All existing issues in Beacon are currently text-only. Whenever testers attach screenshots, they will appear here for easy review and safe cleanup."}
            </p>
          </div>
        )}

        {/* Gallery Grid */}
        {filteredAttachments.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
              gap: 16,
            }}
          >
            {filteredAttachments.map((att) => {
              const isSelected = selectedIds.includes(att.id);
              const isDeleting = deletingId === att.id;

              return (
                <div
                  key={att.id}
                  style={{
                    background: "var(--surface-2)",
                    border: `1.5px solid ${isSelected ? "var(--info, #3b82f6)" : "var(--border)"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    transition: "all 0.15s ease",
                  }}
                >
                  {/* Thumbnail Container */}
                  <div
                    style={{
                      height: 160,
                      background: "rgba(0,0,0,0.04)",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <img
                      src={att.fileUrl}
                      alt={att.filename}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        cursor: "pointer",
                      }}
                      onClick={() => setPreviewImage(att)}
                    />

                    {/* Checkbox Overlay */}
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        zIndex: 2,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectId(att.id)}
                        style={{ width: 16, height: 16, cursor: "pointer" }}
                      />
                    </div>

                    {/* Size Badge */}
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "rgba(15, 23, 42, 0.75)",
                        color: "#ffffff",
                        padding: "2px 7px",
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: 600,
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {(att.size / 1024).toFixed(1)} KB
                    </span>

                    {/* Quick Preview Hover Action */}
                    <button
                      type="button"
                      onClick={() => setPreviewImage(att)}
                      style={{
                        position: "absolute",
                        bottom: 8,
                        right: 8,
                        background: "rgba(255, 255, 255, 0.9)",
                        border: "none",
                        borderRadius: 6,
                        padding: "4px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "#0f172a",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      }}
                    >
                      <Maximize2 className="h-3 w-3" /> Zoom
                    </button>
                  </div>

                  {/* Info Body */}
                  <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      {/* Issue link */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Link
                          href={`/projects/${att.projectId}`}
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: "var(--info, #3b82f6)",
                            background: "rgba(59, 130, 246, 0.1)",
                            padding: "2px 6px",
                            borderRadius: 4,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <span>{att.issueKey}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                        <span style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {att.projectName}
                        </span>
                      </div>

                      <div
                        title={att.issueTitle}
                        style={{
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: "var(--text)",
                          marginBottom: 6,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {att.issueTitle}
                      </div>

                      <div style={{ fontSize: 11, color: "var(--text-dim)", lineHeight: 1.4 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={att.filename}>
                          File: <strong>{att.filename}</strong>
                        </div>
                        <div>By: {att.uploaderName}</div>
                        <div>{new Date(att.uploadedAt).toLocaleDateString()}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteModal(att)}
                        disabled={isDeleting}
                        style={{
                          background: "none",
                          border: "1px solid rgba(220, 38, 38, 0.3)",
                          color: "var(--crit, #dc2626)",
                          borderRadius: 6,
                          padding: "5px 10px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(220, 38, 38, 0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none";
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>{isDeleting ? "Pruning…" : "Delete Image"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setConfirmDeleteModal(null)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 24,
              maxWidth: 460,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ background: "rgba(220, 38, 38, 0.1)", padding: 8, borderRadius: 10 }}>
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", margin: "0 0 4px" }}>
                  Delete Screenshot Attachment?
                </h3>
                <p style={{ fontSize: 12.5, color: "var(--text-dim)", margin: 0 }}>
                  This will remove the image file and reclaim{" "}
                  <strong>{(confirmDeleteModal.size / 1024).toFixed(1)} KB</strong> of storage.
                </p>
              </div>
            </div>

            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 14px",
                fontSize: 12,
                color: "var(--text)",
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              <div>• File: <strong>{confirmDeleteModal.filename}</strong></div>
              <div>• Attached to Issue: <strong>[{confirmDeleteModal.issueKey}] {confirmDeleteModal.issueTitle}</strong></div>
            </div>

            <div
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 11.5,
                color: "var(--ok, #16a34a)",
                fontWeight: 600,
                marginBottom: 20,
              }}
            >
              🛡️ Safe Deletion: The issue, description, comments, and status will remain 100% untouched.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSingle(confirmDeleteModal)}
                disabled={Boolean(deletingId)}
                style={{
                  background: "var(--crit, #dc2626)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {deletingId ? "Deleting…" : "Confirm Delete Image"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setPreviewImage(null)}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "92vw",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                color: "#ffffff",
                marginBottom: 10,
                padding: "0 4px",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                [{previewImage.issueKey}] {previewImage.filename} ({(previewImage.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={previewImage.fileUrl}
              alt={previewImage.filename}
              style={{
                maxWidth: "90vw",
                maxHeight: "80vh",
                objectFit: "contain",
                borderRadius: 8,
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
