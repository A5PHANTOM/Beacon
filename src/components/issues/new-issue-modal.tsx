"use client";

import React, { useState, useEffect, useRef } from "react";
import { DeveloperAssigneeSelect, type AssigneeChoices } from "./developer-assignees";
import { createPortal } from "react-dom";
import { createIssueAction, analyzeIssueWithAIAction } from "@/app/(dashboard)/projects/[id]/actions";
import type { WorkspaceIssue, ProjectMemberItem } from "@/components/issues/workspace";
import type { IssueStatus } from "@/lib/workflow";
import type { AIIssueAnalysis } from "@/lib/ai";

export type ImageUploadItem = {
  id: string;
  filename: string;
  fileUrl: string;
  size: number;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  project: {
    id: string;
    key: string;
    name: string;
  };
  members: ProjectMemberItem[];
  assigneeChoices: AssigneeChoices;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    roleInProject: string;
  };
  onIssueCreated: (createdIssue: WorkspaceIssue) => void;
  showToast: (msg: string) => void;
  onPreviewImage?: (preview: { url: string; filename: string }) => void;
};

// Canvas-based client-side image compression (up to 1280px, 0.82 JPEG quality, max 8MB limit)
async function compressImageFile(file: File): Promise<ImageUploadItem> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      return reject(new Error(`"${file.name}" is not a valid image file.`));
    }
    if (file.size > 8 * 1024 * 1024) {
      return reject(new Error(`"${file.name}" exceeds 8MB limit. Please select a smaller photo.`));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read "${file.name}"`));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return reject(new Error(`Failed to load "${file.name}"`));

      const img = new Image();
      img.onerror = () => reject(new Error(`Failed to process "${file.name}"`));
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
          const compressed = canvas.toDataURL("image/jpeg", 0.82);
          resolve({
            id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            filename: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
            fileUrl: compressed,
            size: Math.round(compressed.length * 0.75),
          });
        } else {
          resolve({
            id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
            filename: file.name,
            fileUrl: dataUrl,
            size: file.size,
          });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function NewIssueModal({
  isOpen,
  onClose,
  project,
  members,
  assigneeChoices,
  currentUser,
  onIssueCreated,
  showToast,
  onPreviewImage,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const developers = assigneeChoices.developers;

  // Mode Selection: "manual" vs "ai"
  const [mode, setMode] = useState<"manual" | "ai">("manual");
  const [aiStage, setAiStage] = useState<"input" | "review">("input");

  // Shared Issue Form State (preserved across mode switches)
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [env, setEnv] = useState("");
  const [category, setCategory] = useState<"UI" | "BACKEND" | "AI">("UI");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [images, setImages] = useState<ImageUploadItem[]>([]);

  // AI Assistant Specific State
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AIIssueAnalysis | null>(null);
  const [apiKeyOverride, setApiKeyOverride] = useState("");
  const [showConfigPanel, setShowConfigPanel] = useState(false);

  // Common submission & compression state
  const [isCompressing, setIsCompressing] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !createLoading && !isAnalyzing) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, createLoading, isAnalyzing, onClose]);

  // Handle Clipboard Paste for screenshots (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleBatchImageUpload(imageFiles);
      }
    }
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, images]);

  // Image Upload Handler
  async function handleBatchImageUpload(files: FileList | File[]) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    if (images.length + fileArray.length > 10) {
      setCreateError(`Maximum 10 photos allowed per issue (${images.length} already attached).`);
      return;
    }

    setCreateError(null);
    setAnalysisError(null);
    setIsCompressing(true);

    try {
      const results: ImageUploadItem[] = [];
      for (const file of fileArray) {
        const item = await compressImageFile(file);
        results.push(item);
      }
      setImages((prev) => [...prev, ...results]);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to process photo(s)");
    } finally {
      setIsCompressing(false);
    }
  }

  function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }

  // AI Analysis Execution
  async function handleRunAIAnalysis(overridePrompt?: string) {
    const promptToUse = (overridePrompt !== undefined ? overridePrompt : aiPrompt).trim();
    if (!promptToUse && images.length === 0) {
      setAnalysisError("Please provide either a bug description or upload at least one screenshot for the AI to analyze.");
      return;
    }

    setAnalysisError(null);
    setIsAnalyzing(true);

    try {
      const res = await analyzeIssueWithAIAction({
        projectId: project.id,
        description: promptToUse || (desc.trim() ? desc.trim() : "Please inspect the attached screenshot(s) and generate a detailed defect report."),
        images: images.map(({ filename, fileUrl, size }) => ({ filename, fileUrl, size })),
        apiKeyOverride: apiKeyOverride.trim() || undefined,
      });

      if (!res.success || !res.data) {
        setAnalysisError(res.error || "AI analysis failed. Please check your AI API key or configuration.");
        setIsAnalyzing(false);
        return;
      }

      const report = res.data;
      setAnalysisResult(report);

      // Populate editable fields with AI generated values
      setTitle(report.title || title);
      setCategory(report.category || category);
      setPriority(report.priority || priority);
      setDesc(report.description || desc);
      setSteps(report.stepsToReproduce || steps);
      setExpected(report.expected || expected);
      setActual(report.actual || actual);
      setEnv(report.environment || env);

      // Switch to review view
      setAiStage("review");
      showToast("Report generated by AI. Review and edit before submitting.");
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : "An unexpected error occurred during AI analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Final Issue Submission (shared between Manual & AI review modes)
  async function handleSubmitIssue(e?: React.FormEvent) {
    if (e) e.preventDefault();

    if (!title.trim() || title.trim().length < 3) {
      setCreateError("Title must be at least 3 characters.");
      return;
    }
    if (assigneeChoices.loading || assigneeChoices.error || !developers.some(developer => developer.userId === assigneeId)) {
      setCreateError("Refresh the developer list and select an eligible developer before creating the issue.");
      return;
    }
    if (!assigneeId) {
      setCreateError("Assigning a developer is mandatory. Please select an active developer.");
      return;
    }

    setCreateError(null);
    setCreateLoading(true);

    try {
      const res = await createIssueAction({
        projectId: project.id,
        title: title.trim(),
        description: desc.trim() || undefined,
        stepsToReproduce: steps.trim() || undefined,
        expected: expected.trim() || undefined,
        actual: actual.trim() || undefined,
        environment: env.trim() || undefined,
        severity: category,
        priority,
        assigneeId,
        images: images.map(({ filename, fileUrl, size }) => ({ filename, fileUrl, size })),
      });

      setCreateLoading(false);

      if (!res.success || !res.data) {
        setCreateError(res.error || "Failed to create issue");
        return;
      }

      const created = res.data;
      const assigned = developers.find(developer => developer.userId === created.assigneeId) ?? members.find((m) => m.userId === created.assigneeId);

      const newItem: WorkspaceIssue = {
        id: created.id,
        projectId: created.projectId,
        number: created.number,
        key: `${project.key}-${created.number}`,
        title: created.title,
        description: created.description,
        stepsToReproduce: created.stepsToReproduce,
        expected: created.expected,
        actual: created.actual,
        environment: created.environment,
        status: created.status as IssueStatus,
        severity: created.severity as WorkspaceIssue["severity"],
        priority: created.priority as WorkspaceIssue["priority"],
        assigneeId: created.assigneeId,
        assigneeName: assigned?.name || "Unassigned",
        reporterId: currentUser.id,
        reporterName: currentUser.name,
        updatedAt: "Just now",
        createdAt: new Date().toISOString(),
        commentsCount: 0,
        attachmentsCount: images.length,
      };

      onIssueCreated(newItem);
      showToast(res.warning || `Issue [${project.key}-${created.number}] created successfully`);

      // Reset state and close modal
      resetModalState();
      onClose();
    } catch (err: unknown) {
      setCreateLoading(false);
      setCreateError(err instanceof Error ? err.message : "Failed to create issue");
    }
  }

  function resetModalState() {
    setTitle("");
    setDesc("");
    setSteps("");
    setExpected("");
    setActual("");
    setEnv("");
    setCategory("UI");
    setPriority("MEDIUM");
    setImages([]);
    setAiPrompt("");
    setAnalysisResult(null);
    setAiStage("input");
    setAnalysisError(null);
    setCreateError(null);
    setAssigneeId("");
  }

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-issue-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !createLoading && !isAnalyzing) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: 820,
          maxHeight: "92vh",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          boxShadow: "0 24px 48px -12px rgba(0, 0, 0, 0.45)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalFadeIn 0.18s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER & MODE SWITCHER */}
        <div
          style={{
            padding: "16px 22px 14px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h3 id="new-issue-modal-title" style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                Report New Issue in [{project.key}]
              </h3>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: "var(--surface-2)",
                  color: "var(--text-dim)",
                  border: "1px solid var(--border)",
                  fontWeight: 600,
                }}
              >
                {project.name}
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
              {mode === "manual"
                ? "Document defect or task with structured reproduction steps."
                : aiStage === "input"
                ? "Describe defects in conversational plain language and attach screenshots for Vision AI analysis."
                : "Review and edit the AI-generated defect report before final submission."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Mode Toggle Switch */}
            <div
              style={{
                display: "flex",
                background: "var(--surface-2)",
                padding: "3px",
                borderRadius: 8,
                border: "1px solid var(--border)",
              }}
            >
              <button
                type="button"
                onClick={() => setMode("manual")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: mode === "manual" ? 700 : 500,
                  color: mode === "manual" ? "var(--text)" : "var(--text-dim)",
                  background: mode === "manual" ? "var(--surface)" : "transparent",
                  border: mode === "manual" ? "1px solid var(--border)" : "none",
                  boxShadow: mode === "manual" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Manual Report
              </button>

              <button
                type="button"
                onClick={() => setMode("ai")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: mode === "ai" ? 700 : 500,
                  color: mode === "ai" ? "#6366f1" : "var(--text-dim)",
                  background: mode === "ai" ? "var(--surface)" : "transparent",
                  border: mode === "ai" ? "1px solid var(--border)" : "none",
                  boxShadow: mode === "ai" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                AI Assistant
              </button>
            </div>

            <button
              type="button"
              className="close-btn"
              onClick={onClose}
              disabled={createLoading || isAnalyzing}
              aria-label="Close modal"
              style={{
                background: "none",
                border: "none",
                fontSize: 16,
                cursor: "pointer",
                color: "var(--text-dim)",
                padding: "4px 8px",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Global Alert for Creation Error */}
          {createError && (
            <div
              style={{
                background: "var(--crit-soft)",
                border: "1px solid var(--crit-bd)",
                color: "var(--crit)",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>{createError}</span>
              <button
                type="button"
                onClick={() => setCreateError(null)}
                style={{ background: "none", border: "none", color: "var(--crit)", cursor: "pointer", fontSize: 13 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODE A: MANUAL REPORT FORM                                      */}
          {/* ============================================================== */}
          {mode === "manual" && (
            <form id="createIssueForm" onSubmit={handleSubmitIssue} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Title */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Title <span style={{ color: "var(--crit)" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment webhook drops contractor payouts over ₹50k"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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

              {/* Category, Priority & Developer Assignment */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Category <span style={{ color: "var(--crit)" }}>*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none", fontWeight: 600 }}
                  >
                    <option value="UI">UI</option>
                    <option value="BACKEND">Backend</option>
                    <option value="AI">AI</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
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
                  <DeveloperAssigneeSelect choices={assigneeChoices} value={assigneeId} onChange={setAssigneeId} />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of defect or behavior…"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text)", outline: "none", resize: "vertical" }}
                />
              </div>

              {/* Steps to Reproduce */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Steps to Reproduce
                </label>
                <textarea
                  rows={3}
                  placeholder="1. Trigger action&#10;2. Observe failure"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
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
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "9px 12px",
                      fontSize: 12,
                      color: "var(--text)",
                      outline: "none",
                      resize: "vertical",
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
                    value={actual}
                    onChange={(e) => setActual(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "9px 12px",
                      fontSize: 12,
                      color: "var(--text)",
                      outline: "none",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              </div>

              {/* Environment */}
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                  Environment <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chrome 128 / macOS, Staging v2.1"
                  value={env}
                  onChange={(e) => setEnv(e.target.value)}
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

              {/* Screenshots Upload Component */}
              <ScreenshotUploadSection
                images={images}
                isCompressing={isCompressing}
                onUpload={handleBatchImageUpload}
                onRemove={removeImage}
                onClearAll={() => setImages([])}
                onPreview={onPreviewImage}
              />
            </form>
          )}

          {/* ============================================================== */}
          {/* MODE B: AI ASSISTANT                                           */}
          {/* ============================================================== */}
          {mode === "ai" && aiStage === "input" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Introduction Card */}
              <div
                style={{
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "rgba(99, 102, 241, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#6366f1",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                      AI-Assisted Defect Reporting
                    </div>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("open-beacon-ai-settings"))}
                      style={{
                        background: "none",
                        border: "none",
                        fontSize: 11,
                        color: "#6366f1",
                        cursor: "pointer",
                        textDecoration: "underline",
                        fontWeight: 600,
                      }}
                    >
                      Configure AI Key ⚙️
                    </button>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>
                    Describe the bug in plain English or paste error snippets, and attach screenshots. Our Vision AI will inspect the interface, formulate clear reproduction steps, and generate an editable structured report conforming to Beacon’s schema.
                  </p>
                </div>
              </div>

              {/* Optional Inline AI API Key Configuration */}
              {showConfigPanel && (
                <div
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Custom AI API Key (Optional Override)
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="password"
                      placeholder="e.g. GEMINI_API_KEY or OPENAI_API_KEY (defaults to server env)"
                      value={apiKeyOverride}
                      onChange={(e) => setApiKeyOverride(e.target.value)}
                      style={{
                        flex: 1,
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "7px 10px",
                        fontSize: 12,
                        color: "var(--text)",
                        outline: "none",
                      }}
                    />
                    {apiKeyOverride && (
                      <button
                        type="button"
                        onClick={() => setApiKeyOverride("")}
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 6,
                          padding: "0 10px",
                          fontSize: 11,
                          color: "var(--text-dim)",
                          cursor: "pointer",
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                    Leave blank to use the backend's configured key (<code style={{ fontFamily: "monospace" }}>GEMINI_API_KEY</code>, <code style={{ fontFamily: "monospace" }}>OPENAI_API_KEY</code>, etc.).
                  </span>
                </div>
              )}

              {/* Error banner for AI failure */}
              {analysisError && (
                <div
                  style={{
                    background: "var(--crit-soft)",
                    border: "1px solid var(--crit-bd)",
                    color: "var(--crit)",
                    padding: "10px 14px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, lineHeight: 1.4 }}>
                    <strong>Analysis Failed:</strong> {analysisError}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnalysisError(null)}
                    style={{ background: "none", border: "none", color: "var(--crit)", cursor: "pointer", fontSize: 13 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Bug Description Chat Input */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    What happened? (Describe in plain language)
                  </label>
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                    Tip: You can paste screenshots directly (<kbd style={{ background: "var(--surface-2)", padding: "1px 4px", borderRadius: 4 }}>Ctrl+V</kbd>)
                  </span>
                </div>

                <textarea
                  rows={4}
                  placeholder="e.g. When clicking 'Submit Application' on the candidate page with an empty resume, the screen goes blank and an unhandled TypeError is logged in the console. Attached screenshot shows the blank state..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  style={{
                    width: "100%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "11px 13px",
                    fontSize: 13,
                    color: "var(--text)",
                    outline: "none",
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                />

                {/* Quick Suggestion Chips */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Try prompt starter:</span>
                  {[
                    "Checkout modal freezes when switching currencies",
                    "Profile image upload fails on mobile viewport",
                    "Table pagination shows duplicate records on page 2",
                  ].map((starter, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAiPrompt(starter)}
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 999,
                        padding: "3px 10px",
                        fontSize: 11,
                        color: "var(--text-dim)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Screenshots Attachment Area */}
              <ScreenshotUploadSection
                images={images}
                isCompressing={isCompressing}
                onUpload={handleBatchImageUpload}
                onRemove={removeImage}
                onClearAll={() => setImages([])}
                onPreview={onPreviewImage}
              />

              {/* Developer Assignment Preference */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Assign Developer <span style={{ color: "var(--crit)" }}>*</span>
                  </label>
                  <DeveloperAssigneeSelect choices={assigneeChoices} value={assigneeId} onChange={setAssigneeId} />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Default Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}
                  >
                    <option value="UI">UI (AI will refine if backend/AI defect)</option>
                    <option value="BACKEND">Backend</option>
                    <option value="AI">AI</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODE B (STAGE 2): AI REVIEW & EDIT FORM                        */}
          {/* ============================================================== */}
          {mode === "ai" && aiStage === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* AI Discrepancies & Follow-up Inspection Box */}
              {analysisResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Discrepancies */}
                  {analysisResult.discrepancies && analysisResult.discrepancies.length > 0 && (
                    <div
                      style={{
                        background: "var(--warn-soft, rgba(234, 179, 8, 0.12))",
                        border: "1px solid var(--warn-bd, rgba(234, 179, 8, 0.35))",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--warn, #ca8a04)",
                      }}
                    >
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span>Discrepancy Detected between text and screenshot evidence:</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {analysisResult.discrepancies.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Missing information & follow up questions */}
                  {analysisResult.missingInformation && analysisResult.missingInformation.length > 0 && (
                    <div
                      style={{
                        background: "rgba(59, 130, 246, 0.08)",
                        border: "1px solid rgba(59, 130, 246, 0.25)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        fontSize: 12,
                        color: "var(--accent, #3b82f6)",
                      }}
                    >
                      <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>Missing Information to Consider:</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {analysisResult.missingInformation.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                      {analysisResult.followUpQuestions && analysisResult.followUpQuestions.length > 0 && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed rgba(59, 130, 246, 0.2)" }}>
                          <strong>Recommended checks:</strong>
                          <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                            {analysisResult.followUpQuestions.map((q, i) => (
                              <li key={i}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Assumptions */}
                  {analysisResult.assumptions && analysisResult.assumptions.length > 0 && (
                    <div
                      style={{
                        background: "rgba(168, 85, 247, 0.08)",
                        border: "1px solid rgba(168, 85, 247, 0.25)",
                        borderRadius: 8,
                        padding: "8px 12px",
                        fontSize: 11.5,
                        color: "#9333ea",
                      }}
                    >
                      <strong>Assumptions Made:</strong> {analysisResult.assumptions.join("; ")}
                    </div>
                  )}
                </div>
              )}

              {/* Editable Structured Fields */}
              <form id="createIssueForm" onSubmit={handleSubmitIssue} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Title */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                      Title <span style={{ color: "var(--crit)" }}>*</span>
                    </label>
                    <span
                      style={{
                        fontSize: 10,
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "#6366f1",
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontWeight: 700,
                      }}
                    >
                      AI Generated · Editable
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
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

                {/* Category, Priority, Assignee */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                        Category *
                      </label>
                      {analysisResult?.inferredFields?.includes("category") && (
                        <span style={{ fontSize: 9.5, color: "#6366f1", fontWeight: 700 }}>Inferred</span>
                      )}
                    </div>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "var(--text)", outline: "none", fontWeight: 600 }}
                    >
                      <option value="UI">UI</option>
                      <option value="BACKEND">Backend</option>
                      <option value="AI">AI</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                        Priority
                      </label>
                      {analysisResult?.inferredFields?.includes("priority") && (
                        <span style={{ fontSize: 9.5, color: "#6366f1", fontWeight: 700 }}>Inferred</span>
                      )}
                    </div>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
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
                    <DeveloperAssigneeSelect choices={assigneeChoices} value={assigneeId} onChange={setAssigneeId} />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text)", outline: "none", resize: "vertical" }}
                  />
                </div>

                {/* Steps to Reproduce */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Steps to Reproduce
                  </label>
                  <textarea
                    rows={4}
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", outline: "none", fontFamily: "'IBM Plex Mono', monospace" }}
                  />
                </div>

                {/* Expected & Actual */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--ok)", textTransform: "uppercase", marginBottom: 4 }}>
                      Expected Result
                    </label>
                    <textarea
                      rows={3}
                      value={expected}
                      onChange={(e) => setExpected(e.target.value)}
                      style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", outline: "none", resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--crit)", textTransform: "uppercase", marginBottom: 4 }}>
                      Actual Result
                    </label>
                    <textarea
                      rows={3}
                      value={actual}
                      onChange={(e) => setActual(e.target.value)}
                      style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "var(--text)", outline: "none", resize: "vertical" }}
                    />
                  </div>
                </div>

                {/* Environment */}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                    Environment
                  </label>
                  <input
                    type="text"
                    value={env}
                    onChange={(e) => setEnv(e.target.value)}
                    placeholder="e.g. Chrome 128 / macOS, Staging v2.1"
                    style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: "var(--text)", outline: "none" }}
                  />
                </div>

                {/* Retained Screenshots */}
                <ScreenshotUploadSection
                  images={images}
                  isCompressing={isCompressing}
                  onUpload={handleBatchImageUpload}
                  onRemove={removeImage}
                  onClearAll={() => setImages([])}
                  onPreview={onPreviewImage}
                />
              </form>
            </div>
          )}
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 22px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            flexShrink: 0,
          }}
        >
          {/* Left Footer Action */}
          <div>
            {mode === "ai" && aiStage === "review" ? (
              <button
                type="button"
                onClick={() => setAiStage("input")}
                disabled={createLoading || isAnalyzing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 13px",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to AI Assistant
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={createLoading || isAnalyzing}
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
            )}
          </div>

          {/* Right Footer Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {mode === "manual" && (
              <button
                type="submit"
                form="createIssueForm"
                disabled={createLoading || assigneeChoices.loading || !!assigneeChoices.error || !developers.some(developer => developer.userId === assigneeId)}
                className="btn-primary"
                style={{ margin: 0 }}
              >
                {createLoading ? "Creating…" : "Create Issue"}
              </button>
            )}

            {mode === "ai" && aiStage === "input" && (
              <button
                type="button"
                onClick={() => handleRunAIAnalysis()}
                disabled={isAnalyzing || isCompressing || (!aiPrompt.trim() && images.length === 0)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 18px",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#ffffff",
                  background: isAnalyzing ? "#4f46e5" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  border: "none",
                  boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
                  cursor: isAnalyzing ? "wait" : "pointer",
                  opacity: (!aiPrompt.trim() && images.length === 0) ? 0.6 : 1,
                  transition: "all 0.15s ease",
                }}
              >
                {isAnalyzing ? (
                  <>
                    <div className="spinner-small" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    <span>Analyzing Evidence…</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span>Analyze & Generate Report</span>
                  </>
                )}
              </button>
            )}

            {mode === "ai" && aiStage === "review" && (
              <>
                <button
                  type="button"
                  onClick={() => handleRunAIAnalysis(aiPrompt || desc)}
                  disabled={isAnalyzing || createLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 13px",
                    fontSize: 12,
                    color: "var(--text-dim)",
                    cursor: "pointer",
                  }}
                  title="Re-run AI analysis on the current prompt and attachments"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                  {isAnalyzing ? "Regenerating…" : "Regenerate"}
                </button>

                <button
                  type="submit"
                  form="createIssueForm"
                  disabled={createLoading || assigneeChoices.loading || !!assigneeChoices.error || !developers.some(developer => developer.userId === assigneeId)}
                  className="btn-primary"
                  style={{ margin: 0 }}
                >
                  {createLoading ? "Creating…" : "Create Issue"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Reusable Screenshot Upload Component
function ScreenshotUploadSection({
  images,
  isCompressing,
  onUpload,
  onRemove,
  onClearAll,
  onPreview,
}: {
  images: ImageUploadItem[];
  isCompressing: boolean;
  onUpload: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onPreview?: (preview: { url: string; filename: string }) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
          <span>Screenshots / Photo Proof</span>
          <span style={{ fontWeight: 400, opacity: 0.7 }}>(Optional)</span>
          {images.length > 0 && (
            <span
              style={{
                background: "var(--accent-dim, rgba(59, 130, 246, 0.15))",
                color: "var(--accent)",
                padding: "1px 6px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {images.length}/10 photos
            </span>
          )}
        </label>
        {images.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            style={{ background: "none", border: "none", color: "var(--crit)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
          >
            Clear all photos
          </button>
        )}
      </div>

      {images.length === 0 ? (
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              onUpload(e.dataTransfer.files);
            }
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "18px 14px",
            border: `1.5px dashed ${isDragOver ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 8,
            background: isDragOver ? "rgba(99, 102, 241, 0.05)" : "var(--surface-2)",
            cursor: "pointer",
            transition: "border-color 0.15s, background 0.15s",
            textAlign: "center",
          }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--text)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>Upload Photos (Single or Multiple)</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
            PNG, JPG, WebP up to 8MB each · Select photos, drag & drop, or paste with Ctrl+V
          </div>
        </label>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 8,
              maxHeight: 210,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {images.map((img) => (
              <div
                key={img.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 8px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  position: "relative",
                }}
              >
                <img
                  src={img.fileUrl}
                  alt={img.filename}
                  onClick={() => onPreview && onPreview({ url: img.fileUrl, filename: img.filename })}
                  style={{
                    width: 44,
                    height: 44,
                    objectFit: "cover",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    flexShrink: 0,
                    cursor: onPreview ? "zoom-in" : "default",
                  }}
                  title="Click to preview"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "var(--text)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={img.filename}
                  >
                    {img.filename}
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2 }}>
                    {(img.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(img.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 4,
                  }}
                  title="Remove photo"
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--crit)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {images.length < 10 && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--accent)",
                cursor: "pointer",
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px dashed var(--border)",
                background: "var(--surface)",
                width: "fit-content",
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    onUpload(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add more photos...</span>
            </label>
          )}
        </div>
      )}

      {isCompressing && (
        <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <div className="spinner-small" style={{ width: 12, height: 12, borderWidth: 2 }} />
          <span>Compressing & optimizing photos...</span>
        </div>
      )}
    </div>
  );
}
