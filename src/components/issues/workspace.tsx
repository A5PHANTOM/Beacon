"use client";

import React, { FormEvent, useMemo, useState, useEffect } from "react";
import type { IssueStatus } from "@/lib/workflow";
import { allowedTransitions } from "@/lib/workflow";
import {
  createIssueAction,
  updateIssueStatusAction,
  updateIssueDetailsAction,
  addCommentAction,
  getIssueAuditHistoryAction,
} from "@/app/(dashboard)/projects/[id]/actions";
import { useRouter } from "next/navigation";

export type WorkspaceIssue = {
  id: string;
  projectId: string;
  number: number;
  key: string;
  title: string;
  description: string | null;
  stepsToReproduce: string | null;
  expected: string | null;
  actual: string | null;
  environment: string | null;
  status: IssueStatus;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  assigneeId: string | null;
  assigneeName: string;
  reporterName: string;
  updatedAt: string;
  createdAt?: string;
  commentsCount: number;
  attachmentsCount?: number;
};

export type IssueAttachmentItem = {
  id: string;
  filename: string;
  fileUrl: string;
  size: number;
  uploadedAt: string;
};

export type ProjectMemberItem = {
  userId: string;
  name: string;
  email: string;
  roleInProject: string;
};

const columnDefs: {
  status: IssueStatus;
  name: string;
  dotColor: string;
  emptyPrompt: string;
  emptyAction?: string;
}[] = [
  {
    status: "OPEN",
    name: "Open",
    dotColor: "#3B82F6",
    emptyPrompt: "No open issues",
    emptyAction: "Report an issue",
  },
  {
    status: "READY_FOR_DEV",
    name: "Ready for Dev",
    dotColor: "#06B6D4",
    emptyPrompt: "No issues ready for dev",
  },
  {
    status: "DEV_IN_PROGRESS",
    name: "Dev In Progress",
    dotColor: "#6366F1",
    emptyPrompt: "No active developer work",
    emptyAction: "Pick up a task",
  },
  {
    status: "DEV_REVIEW",
    name: "Dev Review",
    dotColor: "#8B5CF6",
    emptyPrompt: "No issues under review",
  },
  {
    status: "DEV_COMPLETED",
    name: "Dev Completed",
    dotColor: "#10B981",
    emptyPrompt: "No completed dev tasks",
  },
  {
    status: "DEV_DEPLOYED",
    name: "Dev Deployed",
    dotColor: "#14B8A6",
    emptyPrompt: "No dev deployments",
  },
  {
    status: "QA_IN_PROGRESS",
    name: "QA In Progress",
    dotColor: "#F59E0B",
    emptyPrompt: "No QA testing in progress",
  },
  {
    status: "QA_DEPLOYED",
    name: "QA Deployed",
    dotColor: "#10B981",
    emptyPrompt: "No QA deployments",
  },
  {
    status: "READY_FOR_RELEASE",
    name: "Ready for Release",
    dotColor: "#EC4899",
    emptyPrompt: "No issues ready for release",
  },
  {
    status: "PROD_DEPLOYED",
    name: "Prod Deployed",
    dotColor: "#059669",
    emptyPrompt: "No prod deployments",
  },
  {
    status: "CLOSED",
    name: "Closed",
    dotColor: "#64748B",
    emptyPrompt: "Closed issues will land here",
  },
  {
    status: "INVALID",
    name: "Invalid",
    dotColor: "#EF4444",
    emptyPrompt: "No invalid issues",
  },
];

export function IssueWorkspace({
  project,
  initialIssues,
  members,
  currentUser,
}: {
  project: {
    id: string;
    name: string;
    key: string;
    description: string | null;
    createdAt?: string;
  };
  initialIssues: WorkspaceIssue[];
  members: ProjectMemberItem[];
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleInProject: string;
  };
}) {
  const router = useRouter();
  const [issues, setIssues] = useState<WorkspaceIssue[]>(initialIssues);
  const [selected, setSelected] = useState<WorkspaceIssue | null>(null);

  // Filters & Sorting
  const [filterSeverity, setFilterSeverity] = useState<string>("ALL");
  const [filterAssignee, setFilterAssignee] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("RATING_DESC");
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  // Row dropdown & animation state
  const [openRowStatusId, setOpenRowStatusId] = useState<string | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);

  // Drawer custom dropdowns
  const [drawerStatusOpen, setDrawerStatusOpen] = useState(false);
  const [drawerPriOpen, setDrawerPriOpen] = useState(false);
  const [drawerAssigneeOpen, setDrawerAssigneeOpen] = useState(false);

  // Developer Status Change Modal with Optional Notes
  const [statusNoteModal, setStatusNoteModal] = useState<{
    issueId: string;
    issueKey: string;
    issueTitle: string;
    targetStatus: IssueStatus;
  } | null>(null);
  const [statusNoteText, setStatusNoteText] = useState("");

  // New Issue modal
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newSteps, setNewSteps] = useState("");
  const [newExpected, setNewExpected] = useState("");
  const [newActual, setNewActual] = useState("");
  const [newEnv, setNewEnv] = useState("");
  const [newSev, setNewSev] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [newPri, setNewPri] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newImage, setNewImage] = useState<{
    filename: string;
    fileUrl: string;
    size: number;
  } | null>(null);

  // Drawer details & audit
  const [auditHistory, setAuditHistory] = useState<
    {
      id: string;
      fieldChanged: string;
      oldValue?: string | null;
      newValue?: string | null;
      changedAt: string;
      userName: string;
    }[]
  >([]);
  const [comments, setComments] = useState<
    {
      id: string;
      body: string;
      createdAt: string;
      user: { id: string; name: string; email: string };
    }[]
  >([]);
  const [attachments, setAttachments] = useState<IssueAttachmentItem[]>([]);
  const [previewImage, setPreviewImage] = useState<{ url: string; filename: string } | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [transitionLoading, setTransitionLoading] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  function showToast(text: string) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2800);
  }

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside() {
      setOpenRowStatusId(null);
      setDrawerStatusOpen(false);
      setDrawerPriOpen(false);
      setDrawerAssigneeOpen(false);
    }
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Synchronize state on revalidation
  useEffect(() => {
    setIssues(initialIssues);
    if (selected) {
      const refreshed = initialIssues.find((i) => i.id === selected.id);
      if (refreshed) setSelected(refreshed);
    }
  }, [initialIssues]);

  // Load audit history, comments & attachments when drawer opens
  useEffect(() => {
    if (selected) {
      getIssueAuditHistoryAction(selected.id).then((res) => {
        if (res.success && res.data) {
          setAuditHistory(res.data.history);
          setComments(res.data.comments);
          setAttachments(res.data.attachments || []);
        }
      });
    }
  }, [selected?.id]);

  // Roles: Tester can only raise issues & check status; Developer manages In Progress, Fixed, Rejected
  const isTester = currentUser.roleInProject === "QA" && currentUser.role !== "ADMIN";
  const isQA = isTester;
  const isDev = currentUser.roleInProject === "DEVELOPER" && currentUser.role !== "ADMIN";
  const isLeadOrAdmin = currentUser.role === "ADMIN" || currentUser.roleInProject === "LEAD";

  // Developers strictly filtered (roleInProject === 'DEVELOPER')
  const developers = useMemo(
    () => members.filter((m) => m.roleInProject === "DEVELOPER"),
    [members]
  );

  // Helper to compute allowed transitions for any issue based on user role
  function getTransitionsForIssue(issue: WorkspaceIssue) {
    // Tester login can only raise issues and check status of raised issues — CANNOT update status
    if (isTester) {
      return [];
    }
    // Pipeline statuses from workflow
    const allPipelineStatuses: IssueStatus[] = [
      "OPEN",
      "READY_FOR_DEV",
      "DEV_IN_PROGRESS",
      "DEV_REVIEW",
      "DEV_COMPLETED",
      "DEV_DEPLOYED",
      "QA_IN_PROGRESS",
      "QA_DEPLOYED",
      "READY_FOR_RELEASE",
      "PROD_DEPLOYED",
      "CLOSED",
      "INVALID",
    ];

    return allPipelineStatuses.filter((target) => {
      if (target === issue.status) return false;
      if (issue.status === "REPORTED" && target === "OPEN") return false;
      if (issue.status === "IN_PROGRESS" && target === "DEV_IN_PROGRESS") return false;
      if (issue.status === "FIXED" && target === "DEV_COMPLETED") return false;
      if (issue.status === "REJECTED" && target === "INVALID") return false;
      return true;
    });
  }

  // Status display label helper
  function getStatusLabel(status: string) {
    switch (status) {
      case "OPEN":
      case "REPORTED":
        return "Open";
      case "READY_FOR_DEV":
      case "TRIAGED":
        return "Ready for Dev";
      case "DEV_IN_PROGRESS":
      case "IN_PROGRESS":
        return "Dev In Progress";
      case "DEV_REVIEW":
        return "Dev Review";
      case "DEV_COMPLETED":
        return "Dev Completed";
      case "DEV_DEPLOYED":
        return "Dev Deployed";
      case "QA_IN_PROGRESS":
        return "QA In Progress";
      case "QA_DEPLOYED":
      case "VERIFIED":
        return "QA Deployed";
      case "READY_FOR_RELEASE":
        return "Ready for Release";
      case "PROD_DEPLOYED":
        return "Prod Deployed";
      case "CLOSED":
        return "Closed";
      case "INVALID":
      case "REJECTED":
        return "Invalid";
      case "FIXED":
        return "Dev Completed";
      default:
        return status.replace(/_/g, " ");
    }
  }

  // Helper for priority color class
  function getPriClass(priority: string) {
    if (priority === "URGENT" || priority === "HIGH") return "crit";
    if (priority === "MEDIUM") return "warn";
    return "ok";
  }

  // Helper for status dot color
  function getStatusDotColor(status: IssueStatus | string) {
    switch (status) {
      case "OPEN":
      case "REPORTED":
        return "#3B82F6";
      case "READY_FOR_DEV":
      case "TRIAGED":
        return "#06B6D4";
      case "DEV_IN_PROGRESS":
      case "IN_PROGRESS":
        return "#6366F1";
      case "DEV_REVIEW":
        return "#8B5CF6";
      case "DEV_COMPLETED":
      case "FIXED":
        return "#10B981";
      case "DEV_DEPLOYED":
        return "#14B8A6";
      case "QA_IN_PROGRESS":
        return "#F59E0B";
      case "QA_DEPLOYED":
      case "VERIFIED":
        return "#10B981";
      case "READY_FOR_RELEASE":
        return "#EC4899";
      case "PROD_DEPLOYED":
        return "#059669";
      case "CLOSED":
        return "#64748B";
      case "INVALID":
      case "REJECTED":
        return "#EF4444";
      default:
        return "#8A93A6";
    }
  }

  // Helper for friendly relative timestamps (e.g. 2h ago, 1d ago)
  function formatTimeAgo(dateString?: string | null) {
    if (!dateString) return "Recently";
    if (dateString === "Just now") return "Just now";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Recently";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }


  // Helper for rating calculation (stars, score, level and styling)
  function getRating(issue: WorkspaceIssue) {
    const pri = (issue.priority || "MEDIUM").toUpperCase();
    const sev = (issue.severity || "MEDIUM").toUpperCase();

    if (pri === "URGENT" || pri === "CRITICAL" || sev === "CRITICAL") {
      return { score: "5.0", stars: "★★★★★", label: "Critical", level: "P1", className: "crit" };
    }
    if (pri === "HIGH" || sev === "HIGH") {
      return { score: "4.0", stars: "★★★★☆", label: "High", level: "P2", className: "warn" };
    }
    if (pri === "MEDIUM" || sev === "MEDIUM") {
      return { score: "3.0", stars: "★★★☆☆", label: "Medium", level: "P3", className: "medium" };
    }
    return { score: "2.0", stars: "★★☆☆☆", label: "Low", level: "P4", className: "ok" };
  }

  // Filter visible issues
  const visibleIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesSeverity = filterSeverity === "ALL" || issue.severity === filterSeverity;
      const matchesAssignee =
        filterAssignee === "ALL" ||
        (filterAssignee === "UNASSIGNED" ? !issue.assigneeId : issue.assigneeId === filterAssignee);
      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "OPEN"
          ? ["OPEN", "REPORTED", "READY_FOR_DEV"].includes(issue.status)
          : filterStatus === "DEV_IN_PROGRESS"
          ? ["DEV_IN_PROGRESS", "IN_PROGRESS"].includes(issue.status)
          : filterStatus === "DEV_COMPLETED"
          ? ["DEV_COMPLETED", "FIXED"].includes(issue.status)
          : filterStatus === "QA_DEPLOYED"
          ? ["QA_DEPLOYED", "VERIFIED"].includes(issue.status)
          : filterStatus === "INVALID"
          ? ["INVALID", "REJECTED"].includes(issue.status)
          : filterStatus === "RESOLVED"
          ? ["FIXED", "DEV_COMPLETED", "DEV_DEPLOYED", "QA_DEPLOYED", "READY_FOR_RELEASE", "PROD_DEPLOYED", "VERIFIED", "CLOSED"].includes(issue.status)
          : issue.status === filterStatus);
      const matchesMyTasks = !myTasksOnly || issue.assigneeId === currentUser.id;

      return matchesSeverity && matchesAssignee && matchesStatus && matchesMyTasks;
    });
  }, [issues, filterSeverity, filterAssignee, filterStatus, myTasksOnly, currentUser.id]);

  // Sort issues
  const sortedIssues = useMemo(() => {
    const list = [...visibleIssues];
    if (sortBy === "RATING_DESC") {
      const rank: Record<string, number> = { CRITICAL: 4, URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      list.sort((a, b) => {
        const rA = Math.max(rank[a.priority] || 0, rank[a.severity] || 0);
        const rB = Math.max(rank[b.priority] || 0, rank[b.severity] || 0);
        return rB - rA;
      });
    } else if (sortBy === "NEWEST") {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sortBy === "OLDEST") {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else if (sortBy === "KEY") {
      list.sort((a, b) => a.number - b.number);
    }
    return list;
  }, [visibleIssues, sortBy]);

  // Metrics
  const totalIssuesCount = issues.length;
  const openIssuesCount = issues.filter(
    (i) => !["CLOSED", "INVALID", "REJECTED", "PROD_DEPLOYED", "FIXED", "VERIFIED"].includes(i.status)
  ).length;
  const criticalIssuesCount = issues.filter((i) => i.severity === "CRITICAL").length;
  const inProgressCount = issues.filter(
    (i) => ["DEV_IN_PROGRESS", "IN_PROGRESS", "DEV_REVIEW", "QA_IN_PROGRESS"].includes(i.status)
  ).length;
  const resolvedCount = issues.filter((i) =>
    ["FIXED", "VERIFIED", "DEV_COMPLETED", "DEV_DEPLOYED", "QA_DEPLOYED", "READY_FOR_RELEASE", "PROD_DEPLOYED", "CLOSED"].includes(i.status)
  ).length;
  const solveRate =
    totalIssuesCount > 0 ? Math.round((resolvedCount / totalIssuesCount) * 100) : 0;

  // Greeting & Date
  const dateFormatted = useMemo(() => {
    return new Date()
      .toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
      .toUpperCase();
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Critical items needing attention (e.g. Critical or Urgent that are unaddressed)
  const attentionItems = useMemo(() => {
    return issues
      .filter(
        (i) =>
          (i.severity === "CRITICAL" || i.priority === "URGENT") &&
          !["VERIFIED", "CLOSED"].includes(i.status)
      )
      .slice(0, 3);
  }, [issues]);

  // Image upload handler with client-side compression
  function handleImageUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      setCreateError("Please upload a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setCreateError("Image size exceeds 8MB. Please select a smaller file.");
      return;
    }

    setCreateError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.8);
          setNewImage({
            filename: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
            fileUrl: compressed,
            size: Math.round(compressed.length * 0.75),
          });
        } else {
          setNewImage({
            filename: file.name,
            fileUrl: dataUrl,
            size: file.size,
          });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  // Handlers
  async function handleCreateIssue(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError("Please provide an issue title.");
      return;
    }
    if (!newAssigneeId) {
      setCreateError("Assigning a developer is mandatory. Please select an active developer.");
      return;
    }

    setCreateError(null);
    setCreateLoading(true);

    const res = await createIssueAction({
      projectId: project.id,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      stepsToReproduce: newSteps.trim() || undefined,
      expected: newExpected.trim() || undefined,
      actual: newActual.trim() || undefined,
      environment: newEnv.trim() || undefined,
      severity: newSev,
      priority: newPri,
      assigneeId: newAssigneeId,
      image: newImage || undefined,
    });

    setCreateLoading(false);

    if (!res.success) {
      setCreateError(res.error || "Failed to create issue");
    } else {
      setIsNewOpen(false);
      setNewTitle("");
      setNewDesc("");
      setNewSteps("");
      setNewExpected("");
      setNewActual("");
      setNewEnv("");
      setNewImage(null);
      setNewAssigneeId(developers[0]?.userId || "");
      showToast("Draft issue created");
      router.refresh();
    }
  }

  function requestStatusChange(
    issueId: string,
    issueKey: string,
    issueTitle: string,
    targetStatus: IssueStatus
  ) {
    setStatusNoteText("");
    setStatusNoteModal({ issueId, issueKey, issueTitle, targetStatus });
  }

  async function handleTransition(
    issueId: string,
    nextStatus: IssueStatus,
    notes?: string
  ) {
    setTransitionLoading(true);
    const res = await updateIssueStatusAction(issueId, nextStatus, notes);
    setTransitionLoading(false);

    if (!res.success) {
      showToast(res.error || "Status update failed");
    } else {
      setLandedId(issueId);
      setTimeout(() => setLandedId(null), 600);

      setIssues((prev) =>
        prev.map((i) =>
          i.id === issueId ? { ...i, status: nextStatus, updatedAt: "Just now" } : i
        )
      );
      if (selected?.id === issueId) {
        setSelected((prev) => (prev ? { ...prev, status: nextStatus } : null));
        getIssueAuditHistoryAction(issueId).then((r) => {
          if (r.success && r.data) {
            setAuditHistory(r.data.history);
            setComments(r.data.comments);
          }
        });
      }
      showToast(`Status updated to ${getStatusLabel(nextStatus)}`);
      router.refresh();
    }
  }

  async function handleReassign(newAssigneeId: string) {
    if (!selected) return;
    const res = await updateIssueDetailsAction(selected.id, {
      assigneeId: newAssigneeId || null,
    });

    if (!res.success) {
      showToast(res.error || "Failed to reassign");
    } else {
      const assigned = members.find((m) => m.userId === newAssigneeId);
      const newName = assigned?.name || "Unassigned";
      setSelected((prev) =>
        prev ? { ...prev, assigneeId: newAssigneeId || null, assigneeName: newName } : null
      );
      setIssues((prev) =>
        prev.map((i) =>
          i.id === selected.id
            ? { ...i, assigneeId: newAssigneeId || null, assigneeName: newName }
            : i
        )
      );
      getIssueAuditHistoryAction(selected.id).then((r) => {
        if (r.success && r.data) setAuditHistory(r.data.history);
      });
      showToast(`Assigned to ${newName}`);
      router.refresh();
    }
  }

  async function handleUpdatePriority(newPriVal: "LOW" | "MEDIUM" | "HIGH" | "URGENT") {
    if (!selected) return;
    const res = await updateIssueDetailsAction(selected.id, {
      priority: newPriVal,
    });

    if (!res.success) {
      showToast(res.error || "Failed to update priority");
    } else {
      setSelected((prev) => (prev ? { ...prev, priority: newPriVal } : null));
      setIssues((prev) =>
        prev.map((i) => (i.id === selected.id ? { ...i, priority: newPriVal } : i))
      );
      getIssueAuditHistoryAction(selected.id).then((r) => {
        if (r.success && r.data) setAuditHistory(r.data.history);
      });
      showToast(`Priority set to ${newPriVal}`);
      router.refresh();
    }
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!selected || !newComment.trim()) return;

    setCommentLoading(true);
    const res = await addCommentAction(selected.id, newComment);
    setCommentLoading(false);

    if (!res.success) {
      showToast(res.error || "Failed to post comment");
    } else if (res.data) {
      setComments((prev) => [...prev, res.data!]);
      setNewComment("");
      setIssues((prev) =>
        prev.map((i) =>
          i.id === selected.id ? { ...i, commentsCount: i.commentsCount + 1 } : i
        )
      );
      showToast("Comment posted");
    }
  }

  return (
    <div className="page">
      {/* DASHBOARD HEADER */}
      <div className="dash-head">
        <div className="date">{dateFormatted}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1>
            {greeting}, {currentUser.name?.split(" ")[0] || "User"}
          </h1>
          {isDev && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--info)",
                background: "var(--info-soft)",
                padding: "3px 8px",
                borderRadius: 6,
                letterSpacing: "0.02em",
              }}
            >
              DEVELOPER WORKSPACE
            </span>
          )}
          {isQA && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--warn)",
                background: "var(--warn-soft)",
                padding: "3px 8px",
                borderRadius: 6,
                letterSpacing: "0.02em",
              }}
            >
              TESTER / QA WORKSPACE
            </span>
          )}
        </div>
        <p>
          {isDev
            ? "Here are the engineering issues assigned to you for code implementation and fixing."
            : isQA
            ? "Raise new issues, log bug reports, and check the status of reported defects."
            : `Here's what's happening across ${project.name} (${project.key}).`}
        </p>
      </div>

      {/* 4 METRICS CARDS (Interactive Filter Controls) */}
      <div className="metrics">
        <div
          className={`metric ${filterStatus === "OPEN" ? "active-metric" : ""}`}
          onClick={() => {
            setFilterStatus("OPEN");
            setFilterSeverity("ALL");
            showToast(`Filtering ${openIssuesCount} open issues`);
            document.getElementById("boardAnchor")?.scrollIntoView({ behavior: "smooth" });
          }}
          title="Click to view all open issues"
        >
          <div className="mlabel">
            <span>Open issues</span>
          </div>
          <div className="mnum">{openIssuesCount}</div>
          <div
            className="mtrend down"
            onClick={(e) => {
              e.stopPropagation();
              setFilterStatus("ALL");
              setFilterSeverity("ALL");
              showToast(`Showing all ${totalIssuesCount} issues raised till now`);
              document.getElementById("boardAnchor")?.scrollIntoView({ behavior: "smooth" });
            }}
            title="Click to view all issues raised till now"
          >
            <svg className="spark" width="34" height="14" viewBox="0 0 34 14">
              <polyline points="0,4 6,7 12,3 18,9 24,6 34,12" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>
              {totalIssuesCount} total logged
            </span>
          </div>
          <div className="mfoot">
            <span className="mperiod">Since project creation</span>
            <span className="mlink">View {openIssuesCount} open →</span>
          </div>
        </div>

        <div
          className={`metric ${filterSeverity === "CRITICAL" ? "active-metric" : ""}`}
          onClick={() => {
            setFilterSeverity("CRITICAL");
            setFilterStatus("ALL");
            showToast(`Filtering ${criticalIssuesCount} critical issues`);
            document.getElementById("boardAnchor")?.scrollIntoView({ behavior: "smooth" });
          }}
          title="Click to view critical issues"
        >
          <div className="mlabel">
            <span>Critical issues</span>
          </div>
          <div className="mnum" style={{ color: "var(--crit)" }}>
            {criticalIssuesCount}
          </div>
          <div className="mtrend up">
            <svg className="spark" width="34" height="14" viewBox="0 0 34 14">
              <polyline points="0,10 6,9 12,11 18,4 24,6 34,2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {criticalIssuesCount > 0 ? "Requires immediate triage" : "No critical bugs"}
          </div>
          <div className="mfoot">
            <span className="mperiod">High priority impact</span>
            <span className="mlink">View critical →</span>
          </div>
        </div>

        <div
          className={`metric ${filterStatus === "IN_PROGRESS" ? "active-metric" : ""}`}
          onClick={() => {
            setFilterStatus("IN_PROGRESS");
            setFilterSeverity("ALL");
            showToast(`Filtering ${inProgressCount} in-progress issues`);
            document.getElementById("boardAnchor")?.scrollIntoView({ behavior: "smooth" });
          }}
          title="Click to view in-progress issues"
        >
          <div className="mlabel">
            <span>In progress</span>
          </div>
          <div className="mnum">{inProgressCount}</div>
          <div className="mtrend flat">
            <svg className="spark" width="34" height="14" viewBox="0 0 34 14">
              <polyline points="0,7 6,7 12,6 18,8 24,7 34,7" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            Active coding
          </div>
          <div className="mfoot">
            <span className="mperiod">Developer sprint</span>
            <span className="mlink">View in progress →</span>
          </div>
        </div>

        <div
          className={`metric ${filterStatus === "RESOLVED" ? "active-metric" : ""}`}
          onClick={() => {
            setFilterStatus("RESOLVED");
            setFilterSeverity("ALL");
            showToast(`Showing all ${resolvedCount} issues covered & resolved`);
            document.getElementById("boardAnchor")?.scrollIntoView({ behavior: "smooth" });
          }}
          title="Click to view all covered/solved issues"
        >
          <div className="mlabel">
            <span>Resolved</span>
          </div>
          <div className="mnum" style={{ color: "var(--ok)" }}>
            {resolvedCount}
          </div>
          <div className="mtrend down">
            <svg className="spark" width="34" height="14" viewBox="0 0 34 14">
              <polyline points="0,11 6,9 12,10 18,6 24,4 34,1" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {solveRate}% resolution rate
          </div>
          <div className="mfoot">
            <span className="mperiod">Fixed, verified & closed</span>
            <span className="mlink">View covered ({resolvedCount}) →</span>
          </div>
        </div>
      </div>

      {/* NEEDS ATTENTION SECTION */}
      {attentionItems.length > 0 && (
        <>
          <div className="sec-head">
            <h2>Needs attention</h2>
            <span className="see-all" onClick={() => setFilterSeverity("CRITICAL")}>
              View all
            </span>
          </div>
          <div className="attn">
            {attentionItems.map((item) => (
              <div
                key={item.id}
                className="attn-row"
                onClick={() => setSelected(item)}
              >
                <div className="sev-dot" />
                <div className="attn-id">{item.key}</div>
                <div className="attn-title">{item.title}</div>
                <div className="attn-tag">{item.severity.toLowerCase()}</div>
                <div className="attn-time">
                  {formatTimeAgo(item.updatedAt)}
                </div>
                <div className="attn-status status-reported">
                  {item.status.replace("_", " ")}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ISSUES SECTION HEADING & QUICK COVERAGE TABS */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
            Issues
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "'IBM Plex Mono', monospace" }}>
            Showing {visibleIssues.length} of {totalIssuesCount} total
          </span>
        </div>

        {/* Quick View Segmented Tabs: All Raised vs Open vs Covered/Solved */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            background: "var(--surface-2)",
            padding: 3,
            borderRadius: 9,
            border: "1px solid var(--border)",
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setFilterStatus("ALL");
              setFilterSeverity("ALL");
              showToast(`Showing all ${totalIssuesCount} issues raised till now`);
            }}
            style={{
              padding: "5px 11px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background:
                filterStatus === "ALL" && filterSeverity === "ALL"
                  ? "var(--surface)"
                  : "transparent",
              color:
                filterStatus === "ALL" && filterSeverity === "ALL"
                  ? "var(--text)"
                  : "var(--text-dim)",
              boxShadow:
                filterStatus === "ALL" && filterSeverity === "ALL"
                  ? "var(--shadow-xs)"
                  : "none",
              transition: "all 0.15s ease",
            }}
          >
            All Raised ({totalIssuesCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterStatus("OPEN");
              setFilterSeverity("ALL");
              showToast(`Showing ${openIssuesCount} open issues`);
            }}
            style={{
              padding: "5px 11px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: filterStatus === "OPEN" ? "var(--surface)" : "transparent",
              color: filterStatus === "OPEN" ? "var(--text)" : "var(--text-dim)",
              boxShadow: filterStatus === "OPEN" ? "var(--shadow-xs)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Open ({openIssuesCount})
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterStatus("RESOLVED");
              setFilterSeverity("ALL");
              showToast(`Showing all ${resolvedCount} issues covered & resolved`);
            }}
            style={{
              padding: "5px 11px",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: filterStatus === "RESOLVED" ? "var(--surface)" : "transparent",
              color: filterStatus === "RESOLVED" ? "var(--ok)" : "var(--text-dim)",
              boxShadow: filterStatus === "RESOLVED" ? "var(--shadow-xs)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            ✓ Covered / Solved ({resolvedCount})
          </button>
        </div>
      </div>

      {/* BOARD TOOLBAR */}
      <div className="board-toolbar" id="boardAnchor">
        {/* Severity Filter */}
        <div className="filter-chip">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
          >
            <option value="ALL">All severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Developer Assignees Filter (strictly developers) */}
        <div className="filter-chip">
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
          >
            <option value="ALL">All assignees</option>
            <option value="UNASSIGNED">Unassigned</option>
            {developers.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.name}
              </option>
            ))}
          </select>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Status Filter */}
        <div className="filter-chip">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="ALL">All Status ({totalIssuesCount})</option>
            <option value="OPEN">Open</option>
            <option value="READY_FOR_DEV">Ready for Dev</option>
            <option value="DEV_IN_PROGRESS">Dev In Progress</option>
            <option value="DEV_REVIEW">Dev Review</option>
            <option value="DEV_COMPLETED">Dev Completed</option>
            <option value="DEV_DEPLOYED">Dev Deployed</option>
            <option value="QA_IN_PROGRESS">QA In Progress</option>
            <option value="QA_DEPLOYED">QA Deployed</option>
            <option value="READY_FOR_RELEASE">Ready for Release</option>
            <option value="PROD_DEPLOYED">Prod Deployed</option>
            <option value="CLOSED">Closed</option>
            <option value="INVALID">Invalid</option>
          </select>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Sort Filter */}
        <div className="filter-chip">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="RATING_DESC">Rating (Highest)</option>
            <option value="NEWEST">Newest</option>
            <option value="OLDEST">Oldest</option>
            <option value="KEY">Key</option>
          </select>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>

        {/* Developer Quick Toggle: My Tasks Only */}
        {isDev && (
          <button
            type="button"
            className="filter-chip"
            style={{
              background: myTasksOnly ? "var(--accent-soft)" : "var(--surface)",
              color: myTasksOnly ? "var(--accent)" : "var(--text-dim)",
              borderColor: myTasksOnly ? "var(--accent)" : "var(--border)",
              fontWeight: myTasksOnly ? 700 : 500,
            }}
            onClick={() => setMyTasksOnly(!myTasksOnly)}
          >
            {myTasksOnly ? "✓ My Work Only" : "My Work"}
          </button>
        )}

        {/* New Issue Button */}
        <button
          type="button"
          className="btn-primary"
          id="newIssueBtn"
          onClick={() => {
            if (!newAssigneeId && developers.length > 0) {
              setNewAssigneeId(developers[0].userId);
            }
            setIsNewOpen(true);
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New issue
        </button>
      </div>

      {/* UNIFIED SINGLE ISSUE LIST WITH RATINGS */}
      <div className="issue-list" id="issueList">
        {/* Table Column Headers */}
        <div className="issue-list-head">
          <span style={{ width: 4 }} />
          <span>Rating</span>
          <span>Key</span>
          <span>Issue Title</span>
          <span>Tag</span>
          <span>Assignee</span>
          <span>Updated</span>
          <span>Status</span>
          <span className="th-actions">Actions</span>
        </div>

        {sortedIssues.length === 0 ? (
          <div className="empty-group" style={{ padding: "48px 20px" }}>
            No issues found matching your filters.{" "}
            <a
              onClick={() => {
                setFilterSeverity("ALL");
                setFilterAssignee("ALL");
                setFilterStatus("ALL");
                setMyTasksOnly(false);
              }}
            >
              Reset filters
            </a>
          </div>
        ) : (
          sortedIssues.map((issue) => {
            const rating = getRating(issue);
            const priClass = getPriClass(issue.priority);
            const isLanded = landedId === issue.id;
            const isMenuOpen = openRowStatusId === issue.id;
            const allowedTransitionsForThis = getTransitionsForIssue(issue);

            return (
              <div
                key={issue.id}
                className={`issue-row ${isLanded ? "landed" : ""} ${isMenuOpen ? "menu-open" : ""}`}
                data-issue={issue.key}
                onClick={() => setSelected(issue)}
              >
                {/* Priority indicator bar */}
                <span
                  className={`row-pri ${priClass}`}
                  title={`${issue.priority} Priority`}
                />

                {/* Rating Badge */}
                <div
                  className={`row-rating ${rating.className}`}
                  title={`Rating: ${rating.score} / 5.0 • ${rating.label}`}
                >
                  <span className="rating-stars">{rating.stars}</span>
                  <span className="rating-level">{rating.level}</span>
                </div>

                {/* Issue Key */}
                <span className="row-id mono">{issue.key}</span>

                {/* Issue Title */}
                <span className="row-title" title={issue.title} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span>{issue.title}</span>
                  {Boolean(issue.attachmentsCount && issue.attachmentsCount > 0) && (
                    <span
                      title={`${issue.attachmentsCount} attachment(s)`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 2,
                        fontSize: 10,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "var(--surface-hover)",
                        color: "var(--text-dim)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      📎 {issue.attachmentsCount}
                    </span>
                  )}
                </span>

                {/* Tag / Environment */}
                <span className="row-tag mono">
                  {issue.environment || project.key.toLowerCase()}
                </span>

                {/* Assignee (Avatar + Name) */}
                <div
                  className={`row-assignee ${issue.assigneeName === "Unassigned" ? "unassigned" : ""}`}
                  title={`Assignee: ${issue.assigneeName}`}
                >
                  <div
                    className="mini-avatar"
                    style={{
                      background:
                        issue.assigneeName === "Unassigned"
                          ? "var(--text-faint)"
                          : "#0F7A73",
                    }}
                  >
                    {issue.assigneeName.charAt(0)}
                  </div>
                  <span className="row-assignee-name">
                    {issue.assigneeName}
                  </span>
                </div>

                {/* Updated Relative Time */}
                <span className="row-time">{formatTimeAgo(issue.updatedAt)}</span>

                {/* Status: Read-only for QA / Tester, dropdown for Developer */}
                {isTester ? (
                  <div className="row-status">
                    <div
                      className="row-status-btn"
                      style={{ cursor: "default", opacity: 0.95 }}
                      title="Status (Read-only for QA/Testers)"
                    >
                      <span
                        className="dd-dot"
                        style={{ background: getStatusDotColor(issue.status) }}
                      />
                      <span className="status-text">
                        {getStatusLabel(issue.status)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`row-status ${isMenuOpen ? "open" : ""}`}
                    data-dd="row"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div
                      className="row-status-btn"
                      data-status-trigger
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenRowStatusId(isMenuOpen ? null : issue.id);
                      }}
                    >
                      <span
                        className="dd-dot"
                        style={{ background: getStatusDotColor(issue.status) }}
                      />
                      <span className="status-text">
                        {getStatusLabel(issue.status)}
                      </span>
                      <svg
                        width="8"
                        height="8"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        style={{ opacity: 0.6 }}
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </div>

                    {/* Developer Status Options: In Progress, Fixed, Rejected */}
                    {isMenuOpen && (
                      <div className="dd-menu">
                        {allowedTransitionsForThis.length === 0 ? (
                          <div
                            style={{
                              padding: "6px 8px",
                              fontSize: 11,
                              color: "var(--text-faint)",
                            }}
                          >
                            No actions available
                          </div>
                        ) : (
                          allowedTransitionsForThis.map((target) => (
                            <div
                              key={target}
                              className="dd-item"
                              onClick={() => {
                                setOpenRowStatusId(null);
                                requestStatusChange(
                                  issue.id,
                                  issue.key,
                                  issue.title,
                                  target
                                );
                              }}
                            >
                              <span
                                className="dd-dot"
                                style={{ background: getStatusDotColor(target) }}
                              />
                              <span>{getStatusLabel(target)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                  {!isTester && (
                    <button
                      type="button"
                      title="Assign Developer"
                      className="row-assign-btn"
                      onClick={() => {
                        setSelected(issue);
                        setDrawerAssigneeOpen(true);
                      }}
                    >
                      👤
                    </button>
                  )}
                  <button
                    type="button"
                    title="View details"
                    onClick={() => setSelected(issue)}
                  >
                    ⋯
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SLIDE-OVER DRAWER (Template Structure) */}
      <div
        className={`drawer-overlay ${selected ? "open" : ""}`}
        id="drawerOverlay"
        onClick={() => setSelected(null)}
      />

      <div className={`drawer ${selected ? "open" : ""}`} id="drawer">
        {selected && (
          <>
            <div className="drawer-head">
              <div className="top-row">
                <span className="drawer-id mono" id="drawerId">
                  {selected.key}
                </span>
                <button
                  type="button"
                  className="close-btn"
                  id="drawerClose"
                  onClick={() => setSelected(null)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h3 id="drawerTitle">{selected.title}</h3>
            </div>

            <div className="drawer-body">
              {/* Meta Grid with Dropdowns */}
              <div className="meta-grid">
                {/* Status: Read-only for QA / Tester, dropdown for Developer */}
                <div className={`meta-item ${drawerStatusOpen ? "open" : ""}`} id="statusDD" onClick={(e) => e.stopPropagation()}>
                  <div className="ml">Status</div>
                  {isTester ? (
                    <div className="meta-select" style={{ cursor: "default" }}>
                      <span
                        className="dd-dot"
                        style={{ background: getStatusDotColor(selected.status) }}
                      />
                      <span id="statusLabel">{getStatusLabel(selected.status)}</span>
                    </div>
                  ) : (
                    <>
                      <div
                        className="meta-select"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDrawerStatusOpen(!drawerStatusOpen);
                          setDrawerPriOpen(false);
                          setDrawerAssigneeOpen(false);
                        }}
                      >
                        <span
                          className="dd-dot"
                          style={{ background: getStatusDotColor(selected.status) }}
                        />
                        <span id="statusLabel">{getStatusLabel(selected.status)}</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>

                      {drawerStatusOpen && (
                        <div className="dd-menu">
                          {getTransitionsForIssue(selected).length === 0 ? (
                            <div style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-faint)" }}>
                              No allowed transitions
                            </div>
                          ) : (
                            getTransitionsForIssue(selected).map((target) => (
                              <div
                                key={target}
                                className="dd-item"
                                onClick={() => {
                                  setDrawerStatusOpen(false);
                                  requestStatusChange(
                                    selected.id,
                                    selected.key,
                                    selected.title,
                                    target
                                  );
                                }}
                              >
                                <span className="dd-dot" style={{ background: getStatusDotColor(target) }} />
                                <span>{getStatusLabel(target)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Priority Dropdown */}
                <div className={`meta-item ${drawerPriOpen ? "open" : ""}`} id="priorityDD" onClick={(e) => e.stopPropagation()}>
                  <div className="ml">Priority</div>
                  <div
                    className="meta-select"
                    style={{
                      color:
                        selected.priority === "URGENT" || selected.priority === "HIGH"
                          ? "var(--crit)"
                          : selected.priority === "MEDIUM"
                          ? "var(--warn)"
                          : "var(--ok)",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrawerPriOpen(!drawerPriOpen);
                      setDrawerStatusOpen(false);
                      setDrawerAssigneeOpen(false);
                    }}
                  >
                    <span id="priorityLabel">{selected.priority}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>

                  {drawerPriOpen && (
                    <div className="dd-menu">
                      <div className="dd-item" style={{ color: "var(--ok)" }} onClick={() => { setDrawerPriOpen(false); handleUpdatePriority("LOW"); }}>
                        Low
                      </div>
                      <div className="dd-item" style={{ color: "var(--warn)" }} onClick={() => { setDrawerPriOpen(false); handleUpdatePriority("MEDIUM"); }}>
                        Medium
                      </div>
                      <div className="dd-item" style={{ color: "var(--warn)" }} onClick={() => { setDrawerPriOpen(false); handleUpdatePriority("HIGH"); }}>
                        High
                      </div>
                      <div className="dd-item" style={{ color: "var(--crit)" }} onClick={() => { setDrawerPriOpen(false); handleUpdatePriority("URGENT"); }}>
                        Critical / Urgent
                      </div>
                    </div>
                  )}
                </div>

                {/* Assignee Dropdown (strictly developers) */}
                <div className={`meta-item ${drawerAssigneeOpen ? "open" : ""}`} id="assigneeDD" onClick={(e) => e.stopPropagation()}>
                  <div className="ml">Assignee (Developer)</div>
                  <div
                    className="meta-select"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDrawerAssigneeOpen(!drawerAssigneeOpen);
                      setDrawerStatusOpen(false);
                      setDrawerPriOpen(false);
                    }}
                  >
                    <div
                      className="mini-avatar"
                      style={{
                        background:
                          selected.assigneeName === "Unassigned"
                            ? "var(--text-faint)"
                            : "#0F7A73",
                      }}
                    >
                      {selected.assigneeName.charAt(0)}
                    </div>
                    <span id="assigneeLabel">{selected.assigneeName}</span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>

                  {drawerAssigneeOpen && (
                    <div className="dd-menu">
                      <div
                        className="dd-item"
                        onClick={() => {
                          setDrawerAssigneeOpen(false);
                          handleReassign("");
                        }}
                      >
                        <div className="mini-avatar" style={{ background: "var(--text-faint)", width: 16, height: 16, fontSize: 7 }}>
                          –
                        </div>
                        Unassigned
                      </div>
                      {developers.map((d) => (
                        <div
                          key={d.userId}
                          className="dd-item"
                          onClick={() => {
                            setDrawerAssigneeOpen(false);
                            handleReassign(d.userId);
                          }}
                        >
                          <div className="mini-avatar" style={{ background: "#0F7A73", width: 16, height: 16, fontSize: 7 }}>
                            {d.name.charAt(0)}
                          </div>
                          {d.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="meta-item">
                  <div className="ml">Reporter</div>
                  <div className="meta-select" style={{ cursor: "default" }}>
                    <div className="mini-avatar" style={{ background: "#3E8FE0" }}>
                      {selected.reporterName.charAt(0)}
                    </div>
                    {selected.reporterName}
                  </div>
                </div>

                <div className="meta-item">
                  <div className="ml">Created</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {selected.createdAt
                      ? new Date(selected.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "Recently"}
                  </div>
                </div>

                <div className="meta-item">
                  <div className="ml">Tags</div>
                  <div className="tags-row">
                    <span className="attn-tag">{selected.environment || project.key.toLowerCase()}</span>
                    <span className="attn-tag">{selected.severity.toLowerCase()}</span>
                  </div>
                </div>
              </div>

              {/* Role-Specific status notice */}
              {isDev && selected.status === "FIXED" && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ok)",
                    background: "var(--ok-soft)",
                    padding: "8px 12px",
                    borderRadius: 8,
                    marginBottom: 16,
                    fontWeight: 600,
                  }}
                >
                  ✓ Code marked as Fixed. Awaiting QA / Tester verification.
                </div>
              )}

              {isQA && selected.status === "IN_PROGRESS" && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--info)",
                    background: "var(--info-soft)",
                    padding: "8px 12px",
                    borderRadius: 8,
                    marginBottom: 16,
                    fontWeight: 600,
                  }}
                >
                  ⚙ Developer is actively working on the fix.
                </div>
              )}

              {/* Description */}
              <div className="sec-title">Description</div>
              <p className="desc">
                {selected.description || "No description provided for this issue."}
              </p>

              {/* Steps to Reproduce */}
              {selected.stepsToReproduce && (
                <>
                  <div className="sec-title">Steps to Reproduce</div>
                  <pre
                    className="mono"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      padding: 10,
                      borderRadius: 8,
                      fontSize: 12,
                      whiteSpace: "pre-wrap",
                      margin: 0,
                    }}
                  >
                    {selected.stepsToReproduce}
                  </pre>
                </>
              )}

              {/* Expected & Actual */}
              {(selected.expected || selected.actual) && (
                <div style={{ display: "grid", gridTemplateColumns: selected.expected && selected.actual ? "1fr 1fr" : "1fr", gap: 10, marginTop: 14 }}>
                  {selected.expected && (
                    <div style={{ background: "var(--ok-soft)", border: "1px solid var(--ok-bd, rgba(52, 211, 153, 0.2))", padding: 12, borderRadius: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: "var(--ok)", textTransform: "uppercase" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Expected Result
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{selected.expected}</div>
                    </div>
                  )}
                  {selected.actual && (
                    <div style={{ background: "var(--crit-soft)", border: "1px solid var(--crit-bd, rgba(239, 68, 68, 0.2))", padding: 12, borderRadius: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 700, color: "var(--crit)", textTransform: "uppercase" }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="15" y1="9" x2="9" y2="15" />
                          <line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                        Actual Result
                      </div>
                      <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{selected.actual}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Attachments & Screenshots */}
              {attachments.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div className="sec-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Attachments & Screenshots ({attachments.length})</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginTop: 8 }}>
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        onClick={() => setPreviewImage({ url: att.fileUrl, filename: att.filename })}
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          overflow: "hidden",
                          cursor: "pointer",
                          transition: "transform 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.borderColor = "var(--accent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "none";
                          e.currentTarget.style.borderColor = "var(--border)";
                        }}
                      >
                        <div style={{ width: "100%", height: 85, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          <img
                            src={att.fileUrl}
                            alt={att.filename}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </div>
                        <div style={{ padding: "6px 8px" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {att.filename}
                          </div>
                          <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>
                            {(att.size / 1024).toFixed(0)} KB · Click to enlarge
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity / Audit Timeline */}
              <div className="sec-title">Activity</div>
              <div className="timeline" id="drawerTimeline">
                {auditHistory.map((h) => (
                  <div key={h.id} className="tl-item">
                    <div className="tl-dot" />
                    <div>
                      <div className="tl-text">
                        <b>{h.userName}</b> changed <b>{h.fieldChanged}</b>
                        {h.oldValue && <> from <s>{h.oldValue}</s></>}
                        {h.newValue && <> to <b>{h.newValue}</b></>}
                      </div>
                      <div className="tl-time">
                        {new Date(h.changedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
                {auditHistory.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                    No audit records yet.
                  </div>
                )}
              </div>

              {/* Discussion / Comments */}
              <div className="sec-title">Discussion ({comments.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
                {comments.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      padding: 10,
                      borderRadius: 8,
                      fontSize: 12.5,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{c.user.name}</span>
                      <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ color: "var(--text-dim)", whiteSpace: "pre-wrap" }}>{c.body}</div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="comment-box">
                <div
                  className="mini-avatar"
                  style={{ background: "#0F7A73", width: 24, height: 24, fontSize: 10 }}
                >
                  {currentUser.name?.charAt(0) || "U"}
                </div>
                <div style={{ flex: 1 }}>
                  <textarea
                    className="comment-input"
                    rows={2}
                    placeholder="Add a comment…"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                    <button
                      type="submit"
                      disabled={commentLoading || !newComment.trim()}
                      className="btn-primary"
                      style={{ fontSize: 11.5, padding: "6px 12px" }}
                    >
                      {commentLoading ? "Posting…" : "Comment"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* DRAWER FOOTER */}
            <div className="drawer-footer">
              {isTester ? (
                <div
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--text-faint)",
                    padding: "6px 0",
                  }}
                >
                  Status is managed by developers. Testers can check status or post comments above.
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    id="footerAssign"
                    onClick={() => setDrawerAssigneeOpen(!drawerAssigneeOpen)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 21v-1a7 7 0 0 1 14 0v1" />
                    </svg>
                    Assign
                  </button>

                  <button
                    type="button"
                    className="btn-primary"
                    id="footerStatus"
                    onClick={() => setDrawerStatusOpen(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Change status
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* CREATE NEW ISSUE MODAL */}
      {isNewOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            overflowY: "auto",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewOpen(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "var(--shadow-lg)",
              maxHeight: "min(90vh, 780px)",
              display: "flex",
              flexDirection: "column",
              margin: "auto",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Docked Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 22px 14px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
                background: "var(--surface)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                  Report New Issue in [{project.key}]
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
                  Document defect or task with actionable reproduction steps.
                </p>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setIsNewOpen(false)}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div
              style={{
                padding: "18px 22px",
                overflowY: "auto",
                flex: 1,
              }}
            >
              {createError && (
                <div style={{ background: "var(--crit-soft)", border: "1px solid var(--crit-bd)", color: "var(--crit)", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                  {createError}
                </div>
              )}

              <form id="createIssueForm" onSubmit={handleCreateIssue} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment webhook drops contractor payouts over ₹50k"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
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
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Severity
                  </label>
                  <select
                    value={newSev}
                    onChange={(e) => setNewSev(e.target.value as any)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}
                  >
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Priority
                  </label>
                  <select
                    value={newPri}
                    onChange={(e) => setNewPri(e.target.value as any)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Assign Developer <span style={{ color: "var(--crit)" }}>*</span>
                  </label>
                  <select
                    required
                    value={newAssigneeId}
                    onChange={(e) => setNewAssigneeId(e.target.value)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}
                  >
                    <option value="" disabled>
                      {developers.length === 0 ? "No active developers in project" : "Select a developer *"}
                    </option>
                    {developers.map((d) => (
                      <option key={d.userId} value={d.userId}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of defect or behavior…"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text)", outline: "none", resize: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Steps to Reproduce
                </label>
                <textarea
                  rows={3}
                  placeholder="1. Trigger action&#10;2. Observe failure"
                  value={newSteps}
                  onChange={(e) => setNewSteps(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", outline: "none", fontFamily: "'IBM Plex Mono', monospace" }}
                />
              </div>

              {/* Expected & Actual Results */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ok)",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Expected Result
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What should have happened? (e.g. Success banner displays with confirmation ID)"
                    value={newExpected}
                    onChange={(e) => setNewExpected(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "9px 12px",
                      fontSize: 12,
                      color: "var(--text)",
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--crit)",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Actual Result
                  </label>
                  <textarea
                    rows={3}
                    placeholder="What actually happened instead? (e.g. Spinner froze and unhandled error logged)"
                    value={newActual}
                    onChange={(e) => setNewActual(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "9px 12px",
                      fontSize: 12,
                      color: "var(--text)",
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* Environment (Optional) */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Environment <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chrome 128 / macOS, Staging v2.1"
                  value={newEnv}
                  onChange={(e) => setNewEnv(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "9px 12px",
                    fontSize: 12.5,
                    color: "var(--text)",
                    outline: "none",
                  }}
                />
              </div>

              {/* Optional Screenshot / Proof Attachment */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Screenshot / Image Proof <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional)</span>
                  </label>
                  {newImage && (
                    <button
                      type="button"
                      onClick={() => setNewImage(null)}
                      style={{ background: "none", border: "none", color: "var(--crit)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                    >
                      Remove image
                    </button>
                  )}
                </div>

                {!newImage ? (
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      padding: "16px 14px",
                      border: "1.5px dashed var(--border)",
                      borderRadius: 8,
                      background: "var(--surface-2)",
                      cursor: "pointer",
                      transition: "border-color 0.15s, background 0.15s",
                      textAlign: "center",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                    }}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <span>Upload Bug Screenshot</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                      PNG, JPG, WebP up to 8MB · Click to browse
                    </div>
                  </label>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 8,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                  >
                    <img
                      src={newImage.fileUrl}
                      alt={newImage.filename}
                      style={{
                        width: 52,
                        height: 52,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {newImage.filename}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        {(newImage.size / 1024).toFixed(1)} KB · Ready to attach
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewImage(null)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-dim)",
                        cursor: "pointer",
                        padding: 6,
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Remove image"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

                </form>
            </div>

            {/* Docked Footer Actions */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 10,
                padding: "12px 22px",
                borderTop: "1px solid var(--border)",
                background: "var(--surface)",
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setIsNewOpen(false)}
                style={{ background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, color: "var(--text-dim)", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="createIssueForm"
                disabled={createLoading}
                className="btn-primary"
                style={{ margin: 0 }}
              >
                {createLoading ? "Creating…" : "Create Issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEVELOPER STATUS CHANGE MODAL WITH OPTIONAL NOTES */}
      {statusNoteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--overlay)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 80,
            padding: "24px 16px",
            overflowY: "auto",
          }}
          onClick={() => setStatusNoteModal(null)}
        >
          <div
            style={{
              width: 500,
              maxWidth: "100%",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "var(--shadow-lg)",
              padding: "22px 24px",
              margin: "auto",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="row-id mono" style={{ fontSize: 13, fontWeight: 700 }}>
                  {statusNoteModal.issueKey}
                </span>
                <span style={{ color: "var(--text-faint)" }}>→</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: 6,
                    background:
                      statusNoteModal.targetStatus === "REJECTED"
                        ? "var(--crit-soft)"
                        : statusNoteModal.targetStatus === "FIXED"
                        ? "var(--ok-soft)"
                        : "var(--accent-soft)",
                    color:
                      statusNoteModal.targetStatus === "REJECTED"
                        ? "var(--crit)"
                        : statusNoteModal.targetStatus === "FIXED"
                        ? "var(--ok)"
                        : "var(--accent)",
                    border: `1px solid ${
                      statusNoteModal.targetStatus === "REJECTED"
                        ? "var(--crit-bd)"
                        : "transparent"
                    }`,
                  }}
                >
                  <span
                    className="dd-dot"
                    style={{ background: getStatusDotColor(statusNoteModal.targetStatus) }}
                  />
                  {getStatusLabel(statusNoteModal.targetStatus)}
                </span>
              </div>
              <button
                type="button"
                className="close-btn"
                onClick={() => setStatusNoteModal(null)}
              >
                ✕
              </button>
            </div>

            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: "0 0 16px",
                lineHeight: 1.4,
              }}
            >
              {statusNoteModal.issueTitle}
            </h3>

            {/* Optional Notes Input */}
            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-dim)",
                  marginBottom: 6,
                }}
              >
                Resolution Notes (Optional)
              </label>
              <textarea
                value={statusNoteText}
                onChange={(e) => setStatusNoteText(e.target.value)}
                placeholder={
                  statusNoteModal.targetStatus === "REJECTED"
                    ? "Explain why the issue could not be reproduced or found (e.g. unable to reproduce on production environment, verified with latest build)..."
                    : statusNoteModal.targetStatus === "FIXED"
                    ? "Add notes on the fix or commit details (e.g. patched null check in webhook handler)..."
                    : "Add optional developer notes on work in progress..."
                }
                rows={3}
                className="comment-input"
                style={{ width: "100%", boxSizing: "border-box" }}
                autoFocus
              />
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="btn-ghost"
                style={{ flex: "none", padding: "8px 16px" }}
                onClick={() => setStatusNoteModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={transitionLoading}
                style={{
                  margin: 0,
                  background:
                    statusNoteModal.targetStatus === "REJECTED"
                      ? "var(--crit)"
                      : statusNoteModal.targetStatus === "FIXED"
                      ? "var(--ok)"
                      : "var(--accent)",
                }}
                onClick={() => {
                  handleTransition(
                    statusNoteModal.issueId,
                    statusNoteModal.targetStatus,
                    statusNoteText
                  );
                  setStatusNoteModal(null);
                }}
              >
                {transitionLoading ? "Saving…" : "Confirm Status Change"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      {previewImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
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
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                color: "#FFFFFF",
                marginBottom: 10,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span>{previewImage.filename}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  color: "#FFFFFF",
                  borderRadius: 6,
                  padding: "5px 12px",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Close ✕
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.filename}
              style={{
                maxWidth: "100%",
                maxHeight: "82vh",
                objectFit: "contain",
                borderRadius: 8,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
              }}
            />
          </div>
        </div>
      )}

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
