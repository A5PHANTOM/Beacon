"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  getUserAISettingsAction,
  updateUserAISettingsAction,
  removeUserAISettingsAction,
  testGeminiApiKeyAction,
  resetUserAIUsageCountAction,
  getAvailableGeminiModelsAction,
  DEFAULT_GEMINI_MODELS,
  type GeminiModelItem,
} from "@/app/(dashboard)/ai-settings-actions";

export type AISettingsData = {
  hasKey: boolean;
  hasCustomKey: boolean;
  hasServerFallback: boolean;
  maskedKey: string;
  geminiModel: string;
  aiUsageCount: number;
  aiUsageLimit: number;
};

function formatModelDisplayName(modelId: string) {
  const match = DEFAULT_GEMINI_MODELS.find((m) => m.id === modelId);
  if (match) return match.name;
  return modelId
    .replace(/^models\//, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Sidebar widget shown directly above the user profile in the navigation sidebar
 */
export function AISidebarWidget({
  collapsed,
  onOpenModal,
}: {
  collapsed: boolean;
  onOpenModal: () => void;
}) {
  const [settings, setSettings] = useState<AISettingsData | null>(null);

  useEffect(() => {
    getUserAISettingsAction().then((res) => {
      if (res.success && res.data) {
        setSettings(res.data);
      }
    });

    function handleSettingsUpdated() {
      getUserAISettingsAction().then((res) => {
        if (res.success && res.data) {
          setSettings(res.data);
        }
      });
    }

    window.addEventListener("beacon-ai-settings-updated", handleSettingsUpdated);
    return () => window.removeEventListener("beacon-ai-settings-updated", handleSettingsUpdated);
  }, []);

  const hasKey = settings?.hasKey;
  const count = settings?.aiUsageCount || 0;
  const limit = settings?.aiUsageLimit || 50;
  const activeModel = settings?.geminiModel || "gemini-2.5-flash";
  const shortModelName = activeModel
    .replace(/^gemini-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const pct = Math.min(100, Math.round((count / (limit || 1)) * 100));

  if (collapsed) {
    return (
      <div
        onClick={onOpenModal}
        title={`Gemini AI (${shortModelName}): ${hasKey ? "Active" : "Configure Key"} (${count}/${limit} calls)`}
        style={{
          margin: "0 8px 8px",
          padding: "8px",
          borderRadius: "8px",
          background: hasKey ? "rgba(99, 102, 241, 0.1)" : "var(--surface-2)",
          border: `1px solid ${hasKey ? "rgba(99, 102, 241, 0.25)" : "var(--border)"}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          transition: "all 0.15s ease",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasKey ? "#6366f1" : "var(--text-dim)"} strokeWidth="2.2">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: hasKey ? "#10b981" : "#f59e0b",
          }}
        />
      </div>
    );
  }

  return (
    <div
      onClick={onOpenModal}
      style={{
        margin: "0 12px 10px",
        padding: "10px 12px",
        borderRadius: "10px",
        background: hasKey
          ? "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.06) 100%)"
          : "var(--surface-2)",
        border: `1px solid ${hasKey ? "rgba(99, 102, 241, 0.25)" : "var(--border)"}`,
        cursor: "pointer",
        transition: "all 0.18s ease",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#6366f1";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.12)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = hasKey ? "rgba(99, 102, 241, 0.25)" : "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
      title="Click to configure Gemini API Key, Model and usage limits"
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "5px",
              background: hasKey ? "rgba(99, 102, 241, 0.2)" : "rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: hasKey ? "#6366f1" : "var(--text-dim)",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--text)", letterSpacing: "0.01em" }}>
            Gemini AI
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              padding: "1px 5px",
              borderRadius: 4,
              background: "rgba(99, 102, 241, 0.12)",
              color: "var(--accent, #6366f1)",
            }}
          >
            {shortModelName}
          </span>
        </div>

        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 999,
            background: hasKey ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
            color: hasKey ? "#059669" : "#d97706",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: hasKey ? "#10b981" : "#f59e0b",
            }}
          />
          {hasKey ? "Active" : "Setup"}
        </span>
      </div>

      {/* Usage & Limit Progress */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10, color: "var(--text-faint)" }}>
          <span>Usage limit</span>
          <span style={{ fontWeight: 600, color: "var(--text-dim)" }}>
            {count} / {limit} calls
          </span>
        </div>
        <div
          style={{
            width: "100%",
            height: 4,
            borderRadius: 999,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: 999,
              background: pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#6366f1",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Modal to view, test, save, and update the user's Gemini API key, model & usage limits
 */
export function AISettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [customModelInput, setCustomModelInput] = useState("");
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [usageLimit, setUsageLimit] = useState(50);
  const [showPassword, setShowPassword] = useState(false);
  const [currentSettings, setCurrentSettings] = useState<AISettingsData | null>(null);

  // Models list state
  const [availableModels, setAvailableModels] = useState<GeminiModelItem[]>(DEFAULT_GEMINI_MODELS);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelsSource, setModelsSource] = useState<"default" | "live">("default");

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch initial settings & models when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatusMessage(null);
      setIsLoading(true);

      // Check localStorage first for instant client response
      const localModel = typeof window !== "undefined" ? localStorage.getItem("beacon_gemini_model") : null;

      getUserAISettingsAction().then((res) => {
        setIsLoading(false);
        if (res.success && res.data) {
          setCurrentSettings(res.data);
          setUsageLimit(res.data.aiUsageLimit || 50);

          const modelToUse = res.data.geminiModel || localModel || "gemini-2.5-flash";
          setSelectedModel(modelToUse);

          const isStandard = DEFAULT_GEMINI_MODELS.some((m) => m.id === modelToUse);
          if (!isStandard) {
            setIsCustomModel(true);
            setCustomModelInput(modelToUse);
          } else {
            setIsCustomModel(false);
          }
        }
      });

      // Load available models for current user
      getAvailableGeminiModelsAction().then((res) => {
        if (res.success && res.data) {
          setAvailableModels(res.data);
          if (res.source === "live") setModelsSource("live");
        }
      });
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen && !isLoading && !isTesting) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, isTesting, onClose]);

  // Live browse models when user enters/pastes a key
  async function handleBrowseModels(keyToUse?: string) {
    const key = (keyToUse !== undefined ? keyToUse : apiKey).trim();
    setIsFetchingModels(true);
    try {
      const res = await getAvailableGeminiModelsAction(key);
      if (res.success && res.data && res.data.length > 0) {
        setAvailableModels(res.data);
        setModelsSource(res.source);
        if (res.source === "live") {
          setStatusMessage({
            type: "ok",
            text: `Discovered ${res.data.length} live Gemini models from your Google account.`,
          });
        }
      }
    } finally {
      setIsFetchingModels(false);
    }
  }

  // Test API key with Google
  async function handleTestKey() {
    const keyToTest = apiKey.trim();
    if (!keyToTest) {
      setStatusMessage({ type: "err", text: "Please enter an API key to test." });
      return;
    }
    setStatusMessage(null);
    setIsTesting(true);
    try {
      const res = await testGeminiApiKeyAction(keyToTest);
      if (res.success) {
        setStatusMessage({ type: "ok", text: res.message || "Key verified successfully with Google Gemini!" });
        if (res.models && res.models.length > 0) {
          setAvailableModels(res.models);
          setModelsSource("live");
        }
      } else {
        setStatusMessage({ type: "err", text: res.error || "Failed to verify key with Google." });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: "err", text: err instanceof Error ? err.message : "Error testing key" });
    } finally {
      setIsTesting(false);
    }
  }

  // Save or update key, model, & limit
  async function handleSaveSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const activeModelId = isCustomModel ? customModelInput.trim() : selectedModel;
    if (!activeModelId) {
      setStatusMessage({ type: "err", text: "Please select or enter a valid Gemini model ID." });
      return;
    }

    const keyToSave = apiKey.trim();

    // Check if key is needed
    if (!keyToSave && !currentSettings?.hasKey) {
      setStatusMessage({ type: "err", text: "Please enter your Gemini API key." });
      return;
    }

    setStatusMessage(null);
    setIsLoading(true);
    try {
      // Save client side
      if (typeof window !== "undefined") {
        localStorage.setItem("beacon_gemini_model", activeModelId);
        document.cookie = `beacon_gemini_model=${encodeURIComponent(activeModelId)}; path=/; max-age=31536000; SameSite=Lax`;
      }

      const res = await updateUserAISettingsAction({
        geminiApiKey: keyToSave,
        geminiModel: activeModelId,
        aiUsageLimit: Number(usageLimit) || 50,
      });

      if (res.success) {
        setStatusMessage({ type: "ok", text: res.message || "AI Settings saved successfully!" });
        setApiKey("");
        // Reload current settings
        const fresh = await getUserAISettingsAction();
        if (fresh.success && fresh.data) {
          setCurrentSettings(fresh.data);
          setSelectedModel(fresh.data.geminiModel);
        }
        window.dispatchEvent(new CustomEvent("beacon-ai-settings-updated"));
      } else {
        setStatusMessage({ type: "err", text: res.error || "Failed to save AI settings" });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: "err", text: err instanceof Error ? err.message : "Error saving settings" });
    } finally {
      setIsLoading(false);
    }
  }

  // Remove key
  async function handleRemoveKey() {
    if (!confirm("Are you sure you want to disconnect your Gemini API key from this account?")) return;
    setIsLoading(true);
    setStatusMessage(null);
    try {
      const res = await removeUserAISettingsAction();
      if (res.success) {
        setStatusMessage({ type: "ok", text: "API key removed." });
        const fresh = await getUserAISettingsAction();
        if (fresh.success && fresh.data) {
          setCurrentSettings(fresh.data);
        }
        window.dispatchEvent(new CustomEvent("beacon-ai-settings-updated"));
      } else {
        setStatusMessage({ type: "err", text: res.error || "Failed to remove key" });
      }
    } catch (err: unknown) {
      setStatusMessage({ type: "err", text: err instanceof Error ? err.message : "Error removing key" });
    } finally {
      setIsLoading(false);
    }
  }

  // Reset usage counter
  async function handleResetUsage() {
    setIsLoading(true);
    try {
      const res = await resetUserAIUsageCountAction();
      if (res.success) {
        const fresh = await getUserAISettingsAction();
        if (fresh.success && fresh.data) {
          setCurrentSettings(fresh.data);
        }
        window.dispatchEvent(new CustomEvent("beacon-ai-settings-updated"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  const activeModelId = isCustomModel ? customModelInput.trim() : selectedModel;
  const currentModelMeta =
    availableModels.find((m) => m.id === activeModelId) ||
    DEFAULT_GEMINI_MODELS.find((m) => m.id === activeModelId);

  // Check if anything has changed
  const hasKeyChanged = apiKey.trim().length > 0;
  const hasModelChanged = activeModelId !== currentSettings?.geminiModel;
  const hasLimitChanged = usageLimit !== currentSettings?.aiUsageLimit;
  const canSave = (hasKeyChanged || hasModelChanged || hasLimitChanged) && (currentSettings?.hasKey || hasKeyChanged);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading && !isTesting) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
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
        {/* Modal Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(99, 102, 241, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#6366f1",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>Configure Gemini API & Model</h3>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--text-faint)" }}>
                Personal API key, model selection & usage limits for Beacon AI
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading || isTesting}
            style={{
              background: "none",
              border: "none",
              fontSize: 16,
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "78vh", overflowY: "auto" }}>
          {/* Status Message */}
          {statusMessage && (
            <div
              style={{
                padding: "9px 12px",
                borderRadius: 8,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: statusMessage.type === "ok" ? "var(--ok-soft, rgba(16, 185, 129, 0.12))" : "var(--crit-soft, rgba(239, 68, 68, 0.12))",
                border: `1px solid ${statusMessage.type === "ok" ? "var(--ok-bd, rgba(16, 185, 129, 0.3))" : "var(--crit-bd, rgba(239, 68, 68, 0.3))"}`,
                color: statusMessage.type === "ok" ? "var(--ok, #059669)" : "var(--crit, #dc2626)",
              }}
            >
              <span>{statusMessage.text}</span>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 12 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Current Key & Model Status Card */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                Current Active Key & Model
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", fontFamily: "monospace" }}>
                  {currentSettings?.maskedKey || (currentSettings?.hasServerFallback ? "Server Environment (.env)" : "None configured")}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "1px 7px",
                    borderRadius: 5,
                    background: "rgba(99, 102, 241, 0.14)",
                    color: "var(--accent, #6366f1)",
                    border: "1px solid rgba(99, 102, 241, 0.25)",
                  }}
                >
                  {formatModelDisplayName(currentSettings?.geminiModel || "gemini-2.5-flash")}
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: "3px 8px",
                borderRadius: 999,
                background: currentSettings?.hasKey ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                color: currentSettings?.hasKey ? "#059669" : "#d97706",
              }}
            >
              {currentSettings?.hasCustomKey
                ? "Custom Key Saved"
                : currentSettings?.hasServerFallback
                ? "Server Fallback (.env)"
                : "No Key Set"}
            </span>
          </div>

          {/* Usage & Limit Meter */}
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                AI Analysis Usage
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  {currentSettings?.aiUsageCount || 0} / {currentSettings?.aiUsageLimit || 50} calls
                </span>
                <button
                  type="button"
                  onClick={handleResetUsage}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent, #6366f1)",
                    fontSize: 11,
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div
              style={{
                width: "100%",
                height: 6,
                borderRadius: 999,
                background: "var(--border)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.round(((currentSettings?.aiUsageCount || 0) / (currentSettings?.aiUsageLimit || 50)) * 100))}%`,
                  height: "100%",
                  borderRadius: 999,
                  background:
                    (currentSettings?.aiUsageCount || 0) >= (currentSettings?.aiUsageLimit || 50)
                      ? "#ef4444"
                      : "#6366f1",
                  transition: "width 0.3s ease",
                }}
              />
            </div>
            <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
              {activeModelId.includes("pro")
                ? "Google Gemini 2.5 Pro Free Tier includes 2 Requests/Min and 50 Requests/Day."
                : "Google Gemini 2.5 Flash Free Tier includes 15 Requests/Min and 1,500 Requests/Day."}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Enter / Update API Key */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                  {currentSettings?.hasCustomKey ? "Update Gemini API Key" : "Enter Gemini API Key"}
                </label>
                {(apiKey.trim() || currentSettings?.hasKey) && (
                  <button
                    type="button"
                    onClick={() => handleBrowseModels()}
                    disabled={isFetchingModels}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent, #6366f1)",
                      fontSize: 11,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 600,
                    }}
                  >
                    <span>{isFetchingModels ? "Browsing models…" : "Browse models 🔍"}</span>
                  </button>
                )}
              </div>

              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={currentSettings?.hasCustomKey ? "Enter new key to replace existing (or leave blank to keep)..." : "Paste your Gemini API key (AQ.Ab8...)"}
                  value={apiKey}
                  onChange={(e) => {
                    const val = e.target.value;
                    setApiKey(val);
                    if (val.trim().length >= 25 && !isFetchingModels) {
                      handleBrowseModels(val.trim());
                    }
                  }}
                  style={{
                    width: "100%",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "9px 38px 9px 12px",
                    fontSize: 12.5,
                    color: "var(--text)",
                    outline: "none",
                    fontFamily: "monospace",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                  title={showPassword ? "Hide key" : "Show key"}
                >
                  {showPassword ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* MODEL SUGGESTION & DROPDOWN SELECTION */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase" }}>
                    Select Gemini Model
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 1 }}>
                    Switch models anytime — your choice is saved for all bug analyses
                  </div>
                </div>

                {modelsSource === "live" && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#059669",
                    }}
                    title="Models queried live from Google API"
                  >
                    ● Live Models ({availableModels.length})
                  </span>
                )}
              </div>

              {/* Quick Model Suggestion Chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {DEFAULT_GEMINI_MODELS.map((m) => {
                  const isSelected = !isCustomModel && selectedModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedModel(m.id);
                        setIsCustomModel(false);
                      }}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 6,
                        border: isSelected ? "1.5px solid var(--accent, #6366f1)" : "1px solid var(--border)",
                        background: isSelected ? "rgba(99, 102, 241, 0.14)" : "var(--surface)",
                        color: isSelected ? "var(--accent, #6366f1)" : "var(--text)",
                        fontSize: 11.5,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{m.name}</span>
                      {m.tag && (
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 5px",
                            borderRadius: 4,
                            background: isSelected ? "var(--accent, #6366f1)" : "var(--border)",
                            color: isSelected ? "#fff" : "var(--text-dim)",
                          }}
                        >
                          {m.tag}
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setIsCustomModel(true)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: isCustomModel ? "1.5px solid var(--accent, #6366f1)" : "1px dashed var(--border)",
                    background: isCustomModel ? "rgba(99, 102, 241, 0.14)" : "transparent",
                    color: isCustomModel ? "var(--accent, #6366f1)" : "var(--text-dim)",
                    fontSize: 11.5,
                    fontWeight: isCustomModel ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  Custom Model ID…
                </button>
              </div>

              {/* Dropdown or Custom Input */}
              {isCustomModel ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 600 }}>Custom Model Identifier</span>
                    <button
                      type="button"
                      onClick={() => setIsCustomModel(false)}
                      style={{ background: "none", border: "none", color: "var(--accent, #6366f1)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline" }}
                    >
                      Pick from presets
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. gemini-2.5-flash-latest or gemini-2.5-pro"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    style={{
                      width: "100%",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "7px 10px",
                      fontSize: 12,
                      color: "var(--text)",
                      fontFamily: "monospace",
                      outline: "none",
                    }}
                  />
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10.5, color: "var(--text-dim)", fontWeight: 600 }}>
                    All Available Models (Dropdown)
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      if (e.target.value === "__custom__") {
                        setIsCustomModel(true);
                      } else {
                        setSelectedModel(e.target.value);
                        setIsCustomModel(false);
                      }
                    }}
                    style={{
                      width: "100%",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "var(--text)",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <optgroup label="Recommended Gemini Models">
                      {DEFAULT_GEMINI_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.tag || "Standard"} ({m.id})
                        </option>
                      ))}
                    </optgroup>

                    {availableModels.filter((m) => !DEFAULT_GEMINI_MODELS.some((d) => d.id === m.id)).length > 0 && (
                      <optgroup label="Discovered Google API Models">
                        {availableModels
                          .filter((m) => !DEFAULT_GEMINI_MODELS.some((d) => d.id === m.id))
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.displayName || m.name} ({m.id})
                            </option>
                          ))}
                      </optgroup>
                    )}

                    <option value="__custom__">+ Enter Custom Model Identifier…</option>
                  </select>
                </div>
              )}

              {/* Model Description Info Pill */}
              {currentModelMeta?.description && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-dim)",
                    background: "var(--surface)",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 6,
                    lineHeight: 1.45,
                  }}
                >
                  <span style={{ color: "var(--accent, #6366f1)", fontWeight: 700 }}>ℹ</span>
                  <span>{currentModelMeta.description}</span>
                </div>
              )}
            </div>

            {/* Configurable Usage Limit */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: 4 }}>
                Account AI Limit (Max Calls)
              </label>
              <input
                type="number"
                min={1}
                max={10000}
                value={usageLimit}
                onChange={(e) => setUsageLimit(Number(e.target.value))}
                style={{
                  width: "100%",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 12.5,
                  color: "var(--text)",
                  outline: "none",
                }}
              />
              <span style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 2, display: "block" }}>
                Soft limit cap for your account. You can increase or reset this anytime.
              </span>
            </div>

            {/* Helper link */}
            <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", alignItems: "center", gap: 6 }}>
              <span>Don't have a key?</span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#6366f1", textDecoration: "underline", fontWeight: 600 }}
              >
                Get a free key from Google AI Studio ↗
              </a>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4 }}>
              <div>
                {currentSettings?.hasCustomKey && (
                  <button
                    type="button"
                    onClick={handleRemoveKey}
                    disabled={isLoading}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--crit, #ef4444)",
                      fontSize: 11.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Disconnect Key
                  </button>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {apiKey.trim() && (
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isTesting || isLoading}
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      padding: "7px 12px",
                      fontSize: 12,
                      color: "var(--text)",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {isTesting ? "Testing…" : "Test Key"}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isLoading || isTesting || !canSave}
                  className="btn-primary"
                  style={{
                    margin: 0,
                    padding: "7px 14px",
                    fontSize: 12,
                    opacity: !canSave ? 0.6 : 1,
                  }}
                >
                  {isLoading
                    ? "Saving…"
                    : apiKey.trim()
                    ? (currentSettings?.hasCustomKey ? "Update Key & Model" : "Save Key & Model")
                    : hasModelChanged
                    ? "Update Model"
                    : "Save Settings"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
