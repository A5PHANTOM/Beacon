"use client";

import React, { useState, useEffect } from "react";
import {
  NotebookText,
  X,
  Plus,
  Trash2,
  Copy,
  Check,
  Users,
  FileText,
  Save,
  DownloadCloud,
  ChevronDown,
  Mail,
  Info,
  KeyRound,
  Eye,
  EyeOff,
  Dices,
  ExternalLink,
  Search,
  ShieldCheck,
  Lock,
} from "lucide-react";
import {
  getProjectNotesAction,
  saveProjectNotesAction,
  type ProjectContactItem,
  type ProjectCredentialItem,
  type ProjectNotesData,
} from "@/app/(dashboard)/projects/notes-actions";

type ProjectOption = {
  id: string;
  name: string;
  key: string;
};

const CREDENTIAL_CATEGORIES = [
  "Staging",
  "Production",
  "Database",
  "API Key",
  "Admin",
  "Service",
  "General",
];

function generateSecurePassword(length = 16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=";
  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export function ProjectNotesModal({
  isOpen,
  onClose,
  projects = [],
  currentProjectId,
  initialTab = "contacts",
  onToast,
}: {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  currentProjectId?: string;
  initialTab?: "contacts" | "passwords" | "notes";
  onToast?: (msg: string) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    currentProjectId || (projects[0]?.id ?? "")
  );
  const [activeTab, setActiveTab] = useState<"contacts" | "passwords" | "notes">(initialTab);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  const [notesData, setNotesData] = useState<ProjectNotesData | null>(null);
  const [contacts, setContacts] = useState<ProjectContactItem[]>([]);
  const [credentials, setCredentials] = useState<ProjectCredentialItem[]>([]);
  const [notesText, setNotesText] = useState<string>("");

  // Feedback states
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedUsernameId, setCopiedUsernameId] = useState<string | null>(null);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [credSearchQuery, setCredSearchQuery] = useState<string>("");

  // Sync selected project and initialTab when modal opens
  useEffect(() => {
    if (isOpen) {
      if (currentProjectId && currentProjectId !== selectedProjectId) {
        setSelectedProjectId(currentProjectId);
      }
      if (initialTab) {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, currentProjectId, initialTab]);

  // Load project notes and credentials whenever selectedProjectId changes or modal opens
  useEffect(() => {
    if (!isOpen || !selectedProjectId) return;

    let isMounted = true;
    setLoading(true);
    setHasUnsavedChanges(false);

    getProjectNotesAction(selectedProjectId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setNotesData(res.data);
          setContacts(res.data.contacts || []);
          setCredentials(res.data.credentials || []);
          setNotesText(res.data.notes || "");
        } else {
          onToast?.(res.error || "Failed to load project notes and passwords");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        onToast?.(err?.message || "Error loading notes");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedProjectId]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // ----------------- CONTACTS LOGIC -----------------
  const handleAddContact = () => {
    const newContact: ProjectContactItem = {
      id: `contact-${Date.now()}`,
      name: "",
      email: "",
      role: "Member",
      notes: "",
    };
    setContacts((prev) => [...prev, newContact]);
    setHasUnsavedChanges(true);
  };

  const handleUpdateContact = (id: string, field: keyof ProjectContactItem, value: string) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
    setHasUnsavedChanges(true);
  };

  const handleRemoveContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setHasUnsavedChanges(true);
  };

  const handleSyncProjectMembers = () => {
    if (!notesData?.members || notesData.members.length === 0) {
      onToast?.("No registered project members found to import.");
      return;
    }

    const existingEmails = new Set(
      contacts.map((c) => c.email.toLowerCase().trim()).filter(Boolean)
    );

    let addedCount = 0;
    const newItems: ProjectContactItem[] = [];

    for (const mem of notesData.members) {
      if (!existingEmails.has(mem.email.toLowerCase().trim())) {
        newItems.push({
          id: `member-${mem.userId}-${Date.now()}`,
          name: mem.name,
          email: mem.email,
          role: mem.roleInProject || "Member",
          notes: "Imported from Beacon members",
        });
        existingEmails.add(mem.email.toLowerCase().trim());
        addedCount++;
      }
    }

    if (addedCount > 0) {
      setContacts((prev) => [...prev, ...newItems]);
      setHasUnsavedChanges(true);
      onToast?.(`Imported ${addedCount} project member(s) into directory!`);
    } else {
      onToast?.("All project members are already in the directory.");
    }
  };

  const handleCopyEmail = (email: string, id: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    onToast?.(`Copied ${email} to clipboard!`);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const handleCopyAllEmails = () => {
    const validEmails = contacts
      .map((c) => c.email.trim())
      .filter((e) => e.length > 0);

    if (validEmails.length === 0) {
      onToast?.("No emails available to copy.");
      return;
    }

    const text = validEmails.join(", ");
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    onToast?.(`Copied ${validEmails.length} email(s) to clipboard!`);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  // ----------------- PASSWORD MANAGER LOGIC -----------------
  const handleAddCredential = () => {
    const newCred: ProjectCredentialItem = {
      id: `cred-${Date.now()}`,
      title: "",
      url: "",
      username: "",
      password: "",
      category: "Staging",
      notes: "",
      updatedAt: new Date().toISOString(),
    };
    setCredentials((prev) => [newCred, ...prev]);
    setHasUnsavedChanges(true);
  };

  const handleUpdateCredential = (
    id: string,
    field: keyof ProjectCredentialItem,
    value: string
  ) => {
    setCredentials((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, [field]: value, updatedAt: new Date().toISOString() } : c
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleRemoveCredential = (id: string) => {
    setCredentials((prev) => prev.filter((c) => c.id !== id));
    setHasUnsavedChanges(true);
  };

  const handleCopyUsername = (username: string, id: string) => {
    if (!username) return;
    navigator.clipboard.writeText(username);
    setCopiedUsernameId(id);
    onToast?.(`Copied username "${username}"!`);
    setTimeout(() => setCopiedUsernameId(null), 2000);
  };

  const handleCopyPassword = (password: string, id: string) => {
    if (!password) {
      onToast?.("No password entered yet to copy.");
      return;
    }
    navigator.clipboard.writeText(password);
    setCopiedPasswordId(id);
    onToast?.("Password copied to clipboard! ✓");
    setTimeout(() => setCopiedPasswordId(null), 2000);
  };

  const handleToggleRevealPassword = (id: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleGeneratePasswordForCred = (id: string) => {
    const newPass = generateSecurePassword(16);
    handleUpdateCredential(id, "password", newPass);
    setRevealedPasswords((prev) => ({ ...prev, [id]: true }));
    onToast?.("Generated new strong password!");
  };

  // ----------------- NOTES TEMPLATES -----------------
  const handleInsertTemplate = (templateType: "credentials" | "meeting" | "links") => {
    let snippet = "";
    if (templateType === "credentials") {
      snippet = `\n\n### 🔐 Environment & Credentials\n- **Staging URL**: https://staging.example.com\n- **Admin Email**: admin@example.com\n- **Password**: [Redacted / Stored in Password Manager tab]\n- **VPN / Server**: internal-gateway.example.com\n`;
    } else if (templateType === "meeting") {
      const today = new Date().toISOString().split("T")[0];
      snippet = `\n\n### 🗓️ Meeting Notes (${today})\n- **Attendees**: \n- **Agenda**: \n- **Key Decisions**: \n- **Next Action Items**: \n  - [ ] Task 1 (Assignee: )\n  - [ ] Task 2 (Assignee: )\n`;
    } else if (templateType === "links") {
      snippet = `\n\n### 🔗 Key Links & Documentation\n- **Production**: https://\n- **Staging / QA**: https://\n- **GitHub / Repo**: https://github.com/\n- **Figma / Design**: https://figma.com/\n- **API Docs**: https://\n`;
    }

    setNotesText((prev) => prev.trim() + snippet);
    setHasUnsavedChanges(true);
  };

  // ----------------- SAVE LOGIC -----------------
  const handleSave = async () => {
    if (!selectedProjectId) return;
    setSaving(true);

    try {
      const res = await saveProjectNotesAction({
        projectId: selectedProjectId,
        notes: notesText,
        contacts: JSON.stringify(contacts),
        credentials: JSON.stringify(credentials),
      });

      if (res.success) {
        setHasUnsavedChanges(false);
        onToast?.("Project notes, emails & passwords saved successfully! ✓");
      } else {
        onToast?.(res.error || "Failed to save data");
      }
    } catch (err: any) {
      onToast?.(err?.message || "Error saving notes");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentProjObj =
    projects.find((p) => p.id === selectedProjectId) || projects[0];

  // Filtered credentials for search
  const filteredCredentials = credentials.filter((c) => {
    if (!credSearchQuery.trim()) return true;
    const q = credSearchQuery.toLowerCase();
    return (
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.url && c.url.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--overlay)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
        animation: "fadeIn .15s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 860,
          maxWidth: "100%",
          maxHeight: "92vh",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--accent-soft)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid var(--accent-soft-2)",
              }}
            >
              <NotebookText size={19} />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    margin: 0,
                    color: "var(--text)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Project Notes & Credentials Vault
                </h2>

                {/* Project Selector */}
                {projects.length > 1 ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <select
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      style={{
                        appearance: "none",
                        WebkitAppearance: "none",
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "3px 24px 3px 8px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--accent)",
                        cursor: "pointer",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.key})
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={12}
                      style={{
                        position: "absolute",
                        right: 7,
                        top: "50%",
                        transform: "translateY(-50%)",
                        pointerEvents: "none",
                        color: "var(--text-faint)",
                      }}
                    />
                  </div>
                ) : (
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      padding: "2px 7px",
                      borderRadius: 5,
                    }}
                  >
                    {currentProjObj?.name} • {currentProjObj?.key}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: "2px 0 0",
                  fontSize: 12,
                  color: "var(--text-dim)",
                }}
              >
                Shared team directory, password manager, and workspace notes for {currentProjObj?.name || "this project"}.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {hasUnsavedChanges && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--warn)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  borderRadius: 6,
                  background: "var(--warn-soft)",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--warn)",
                  }}
                />
                Unsaved
              </span>
            )}

            <button
              type="button"
              onClick={onClose}
              className="icon-btn"
              title="Close (Esc)"
              style={{ width: 28, height: 28 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 3-TAB CONTROLS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 20px",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Tab 1: Contacts */}
            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                border: "1px solid",
                borderColor:
                  activeTab === "contacts" ? "var(--accent)" : "transparent",
                background:
                  activeTab === "contacts" ? "var(--accent-soft)" : "transparent",
                color:
                  activeTab === "contacts" ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
                transition: "all .12s",
              }}
            >
              <Users size={14} />
              <span>Users & Emails</span>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontSize: 10.5,
                  fontFamily: "monospace",
                  background:
                    activeTab === "contacts"
                      ? "var(--accent-soft-2)"
                      : "var(--surface-2)",
                  color:
                    activeTab === "contacts"
                      ? "var(--accent)"
                      : "var(--text-faint)",
                }}
              >
                {contacts.length}
              </span>
            </button>

            {/* Tab 2: Password Manager */}
            <button
              type="button"
              onClick={() => setActiveTab("passwords")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                border: "1px solid",
                borderColor:
                  activeTab === "passwords" ? "var(--accent)" : "transparent",
                background:
                  activeTab === "passwords" ? "var(--accent-soft)" : "transparent",
                color:
                  activeTab === "passwords" ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
                transition: "all .12s",
              }}
            >
              <KeyRound size={14} />
              <span>Password Manager</span>
              <span
                style={{
                  padding: "1px 6px",
                  borderRadius: 10,
                  fontSize: 10.5,
                  fontFamily: "monospace",
                  background:
                    activeTab === "passwords"
                      ? "var(--accent-soft-2)"
                      : "var(--surface-2)",
                  color:
                    activeTab === "passwords"
                      ? "var(--accent)"
                      : "var(--text-faint)",
                }}
              >
                {credentials.length}
              </span>
            </button>

            {/* Tab 3: Notes */}
            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 600,
                border: "1px solid",
                borderColor:
                  activeTab === "notes" ? "var(--accent)" : "transparent",
                background:
                  activeTab === "notes" ? "var(--accent-soft)" : "transparent",
                color:
                  activeTab === "notes" ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
                transition: "all .12s",
              }}
            >
              <FileText size={14} />
              <span>Important Notes</span>
              {notesText.trim() && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }}
                />
              )}
            </button>
          </div>

          {/* Quick Header Actions based on Active Tab */}
          {activeTab === "contacts" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {contacts.length > 0 && (
                <button
                  type="button"
                  onClick={handleCopyAllEmails}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text-dim)",
                    cursor: "pointer",
                  }}
                  title="Copy comma-separated list of all emails"
                >
                  {copiedAll ? <Check size={12} style={{ color: "var(--ok)" }} /> : <Copy size={12} />}
                  <span>{copiedAll ? "Emails Copied!" : "Copy All Emails"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSyncProjectMembers}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
                title="Pull registered project members into this directory"
              >
                <DownloadCloud size={12} />
                <span>Sync Project Members</span>
              </button>

              <button
                type="button"
                onClick={handleAddContact}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                  cursor: "pointer",
                }}
              >
                <Plus size={13} />
                <span>Add User</span>
              </button>
            </div>
          ) : activeTab === "passwords" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* Search filter for credentials */}
              {credentials.length > 1 && (
                <div style={{ position: "relative", width: 180 }}>
                  <Search
                    size={13}
                    style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-faint)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search passwords…"
                    value={credSearchQuery}
                    onChange={(e) => setCredSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "5px 8px 5px 26px",
                      fontSize: 11.5,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 6,
                      color: "var(--text)",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleAddCredential}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--accent-ink)",
                  cursor: "pointer",
                }}
              >
                <Plus size={13} />
                <span>Add Password</span>
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 500 }}>
                Insert Template:
              </span>
              <button
                type="button"
                onClick={() => handleInsertTemplate("credentials")}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                🔐 Credentials
              </button>
              <button
                type="button"
                onClick={() => handleInsertTemplate("meeting")}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                🗓️ Meeting
              </button>
              <button
                type="button"
                onClick={() => handleInsertTemplate("links")}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                }}
              >
                🔗 Links
              </button>
            </div>
          )}
        </div>

        {/* MODAL BODY */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 20px",
            minHeight: 340,
            maxHeight: "calc(92vh - 190px)",
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "60px 0",
                color: "var(--text-faint)",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  border: "2px solid var(--accent-soft)",
                  borderTopColor: "var(--accent)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                Loading vault & directory for {currentProjObj?.name}…
              </span>
            </div>
          ) : activeTab === "passwords" ? (
            /* PASSWORD MANAGER TAB */
            <div>
              {credentials.length === 0 ? (
                <div
                  style={{
                    padding: "44px 20px",
                    textAlign: "center",
                    border: "1px dashed var(--border)",
                    borderRadius: 12,
                    background: "var(--surface-2)",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 12px",
                      border: "1px solid var(--accent-soft-2)",
                    }}
                  >
                    <KeyRound size={24} />
                  </div>
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--text)",
                      margin: "0 0 6px",
                    }}
                  >
                    No Passwords Stored Yet
                  </h3>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-dim)",
                      maxWidth: 440,
                      margin: "0 auto 16px",
                      lineHeight: 1.5,
                    }}
                  >
                    Keep all project passwords, staging logins, database credentials, and
                    API keys for <b>{currentProjObj?.name}</b> secure with instant 1-click copying.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddCredential}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 18px",
                      borderRadius: 8,
                      background: "var(--accent)",
                      color: "var(--accent-ink)",
                      fontWeight: 600,
                      fontSize: 12.5,
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <Plus size={14} />
                    Add First Password
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {filteredCredentials.map((cred) => {
                    const isRevealed = Boolean(revealedPasswords[cred.id]);
                    const isCopiedPass = copiedPasswordId === cred.id;
                    const isCopiedUser = copiedUsernameId === cred.id;

                    return (
                      <div
                        key={cred.id}
                        style={{
                          background: "var(--surface-2)",
                          border: "1px solid var(--border)",
                          borderRadius: 12,
                          padding: "14px 16px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          transition: "border-color .15s, box-shadow .15s",
                        }}
                      >
                        {/* Credential Top Row: Title, Category, Delete */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <input
                              type="text"
                              placeholder="Service / Title (e.g. Staging Web Portal, Postgres DB)"
                              value={cred.title}
                              onChange={(e) =>
                                handleUpdateCredential(cred.id, "title", e.target.value)
                              }
                              style={{
                                flex: 1,
                                minWidth: 160,
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                padding: "6px 10px",
                                fontSize: 13,
                                fontWeight: 700,
                                color: "var(--text)",
                                outline: "none",
                              }}
                            />

                            {/* Category Selector */}
                            <select
                              value={cred.category || "General"}
                              onChange={(e) =>
                                handleUpdateCredential(cred.id, "category", e.target.value)
                              }
                              style={{
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                padding: "6px 8px",
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: "var(--accent)",
                                outline: "none",
                                cursor: "pointer",
                              }}
                            >
                              {CREDENTIAL_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveCredential(cred.id)}
                            style={{
                              padding: "6px 8px",
                              border: "none",
                              background: "transparent",
                              color: "var(--crit)",
                              cursor: "pointer",
                              borderRadius: 6,
                              opacity: 0.8,
                            }}
                            title="Delete credential"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Credential Main Fields: Username, Password, URL */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                          }}
                        >
                          {/* Username / Login */}
                          <div>
                            <label
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "var(--text-faint)",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                marginBottom: 4,
                              }}
                            >
                              Username / Login
                            </label>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <input
                                type="text"
                                placeholder="admin@example.com / root"
                                value={cred.username || ""}
                                onChange={(e) =>
                                  handleUpdateCredential(cred.id, "username", e.target.value)
                                }
                                style={{
                                  flex: 1,
                                  background: "var(--surface)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 6,
                                  padding: "7px 9px",
                                  fontSize: 12,
                                  color: "var(--text)",
                                  outline: "none",
                                  fontFamily: "monospace",
                                }}
                              />
                              {cred.username && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyUsername(cred.username!, cred.id)}
                                  style={{
                                    padding: "7px 10px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border)",
                                    background: isCopiedUser ? "var(--ok-soft)" : "var(--surface)",
                                    color: isCopiedUser ? "var(--ok)" : "var(--text-dim)",
                                    cursor: "pointer",
                                    fontSize: 11.5,
                                    fontWeight: 600,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    flexShrink: 0,
                                  }}
                                  title="Copy username"
                                >
                                  {isCopiedUser ? <Check size={13} /> : <Copy size={13} />}
                                  <span>{isCopiedUser ? "Copied" : "Copy"}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Password & Easy Copy Button */}
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: 4,
                              }}
                            >
                              <label
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "var(--text-faint)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                }}
                              >
                                Password / Secret
                              </label>
                              <button
                                type="button"
                                onClick={() => handleGeneratePasswordForCred(cred.id)}
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 600,
                                  color: "var(--accent)",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 3,
                                  padding: 0,
                                }}
                                title="Generate strong random password"
                              >
                                <Dices size={11} />
                                <span>Generate</span>
                              </button>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div
                                style={{
                                  position: "relative",
                                  flex: 1,
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <input
                                  type={isRevealed ? "text" : "password"}
                                  placeholder="Password"
                                  value={cred.password || ""}
                                  onChange={(e) =>
                                    handleUpdateCredential(cred.id, "password", e.target.value)
                                  }
                                  style={{
                                    width: "100%",
                                    background: "var(--surface)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 6,
                                    padding: "7px 30px 7px 9px",
                                    fontSize: 12,
                                    color: "var(--text)",
                                    outline: "none",
                                    fontFamily: "monospace",
                                    letterSpacing: isRevealed ? "normal" : "0.15em",
                                  }}
                                />

                                {/* Toggle reveal button inside input */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleRevealPassword(cred.id)}
                                  style={{
                                    position: "absolute",
                                    right: 6,
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-faint)",
                                    cursor: "pointer",
                                    padding: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                  title={isRevealed ? "Hide password" : "Show password"}
                                >
                                  {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>

                              {/* PROMINENT COPY PASSWORD BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleCopyPassword(cred.password || "", cred.id)}
                                style={{
                                  padding: "7px 12px",
                                  borderRadius: 6,
                                  border: isCopiedPass ? "1px solid var(--ok)" : "none",
                                  background: isCopiedPass ? "var(--ok-soft)" : "var(--accent)",
                                  color: isCopiedPass ? "var(--ok)" : "var(--accent-ink)",
                                  cursor: "pointer",
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 5,
                                  flexShrink: 0,
                                  transition: "all .12s",
                                }}
                                title="Copy password to clipboard"
                              >
                                {isCopiedPass ? <Check size={13} /> : <Copy size={13} />}
                                <span>{isCopiedPass ? "Copied! ✓" : "Copy Password"}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Credential Secondary Fields: URL & Notes */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 10,
                          }}
                        >
                          {/* URL */}
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="text"
                              placeholder="URL: https://staging.example.com"
                              value={cred.url || ""}
                              onChange={(e) =>
                                handleUpdateCredential(cred.id, "url", e.target.value)
                              }
                              style={{
                                flex: 1,
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                padding: "5px 8px",
                                fontSize: 11.5,
                                color: "var(--text-dim)",
                                outline: "none",
                              }}
                            />
                            {cred.url && (
                              <a
                                href={cred.url.startsWith("http") ? cred.url : `https://${cred.url}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  padding: "5px 8px",
                                  borderRadius: 6,
                                  border: "1px solid var(--border)",
                                  background: "var(--surface)",
                                  color: "var(--text-faint)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  textDecoration: "none",
                                }}
                                title="Open URL in new tab"
                              >
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>

                          {/* Notes */}
                          <div>
                            <input
                              type="text"
                              placeholder="Extra info / 2FA note / test account details"
                              value={cred.notes || ""}
                              onChange={(e) =>
                                handleUpdateCredential(cred.id, "notes", e.target.value)
                              }
                              style={{
                                width: "100%",
                                background: "var(--surface)",
                                border: "1px solid var(--border)",
                                borderRadius: 6,
                                padding: "5px 8px",
                                fontSize: 11.5,
                                color: "var(--text-dim)",
                                outline: "none",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={handleAddCredential}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "var(--surface-2)",
                        border: "1px dashed var(--border-strong)",
                        color: "var(--accent)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                      Add another password / credential
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "contacts" ? (
            /* USERS & EMAILS TAB */
            <div>
              {contacts.length === 0 ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    border: "1px dashed var(--border)",
                    borderRadius: 12,
                    background: "var(--surface-2)",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 12px",
                    }}
                  >
                    <Users size={22} />
                  </div>
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text)",
                      margin: "0 0 6px",
                    }}
                  >
                    No Users or Emails Added Yet
                  </h3>
                  <p
                    style={{
                      fontSize: 12.5,
                      color: "var(--text-dim)",
                      maxWidth: 440,
                      margin: "0 auto 16px",
                      lineHeight: 1.5,
                    }}
                  >
                    Store all important user names, emails, credentials, and stakeholder
                    contacts for <b>{currentProjObj?.name}</b> in one common place.
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={handleAddContact}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "var(--accent)",
                        color: "var(--accent-ink)",
                        fontWeight: 600,
                        fontSize: 12,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                      Add First User
                    </button>
                    {notesData?.members && notesData.members.length > 0 && (
                      <button
                        type="button"
                        onClick={handleSyncProjectMembers}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "8px 16px",
                          borderRadius: 8,
                          background: "var(--surface)",
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        <DownloadCloud size={14} />
                        Import {notesData.members.length} Project Member(s)
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Table Header */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "170px 220px 140px 1fr 40px",
                      gap: 10,
                      padding: "6px 12px",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-faint)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span>User Name</span>
                    <span>Email Address</span>
                    <span>Role / Tag</span>
                    <span>Notes / Access Details</span>
                    <span style={{ textAlign: "right" }} />
                  </div>

                  {/* Rows */}
                  {contacts.map((contact, index) => (
                    <div
                      key={contact.id || index}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "170px 220px 140px 1fr 40px",
                        gap: 10,
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        transition: "border-color .15s",
                      }}
                    >
                      {/* Name Input */}
                      <div>
                        <input
                          type="text"
                          placeholder="e.g. Arjun"
                          value={contact.name}
                          onChange={(e) =>
                            handleUpdateContact(contact.id, "name", e.target.value)
                          }
                          style={{
                            width: "100%",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 12.5,
                            color: "var(--text)",
                            fontWeight: 600,
                            outline: "none",
                          }}
                        />
                      </div>

                      {/* Email Input + Copy Button */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input
                          type="email"
                          placeholder="user@example.com"
                          value={contact.email}
                          onChange={(e) =>
                            handleUpdateContact(contact.id, "email", e.target.value)
                          }
                          style={{
                            width: "100%",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 12,
                            color: "var(--text)",
                            outline: "none",
                            fontFamily: "monospace",
                          }}
                        />
                        {contact.email && (
                          <button
                            type="button"
                            onClick={() => handleCopyEmail(contact.email, contact.id)}
                            style={{
                              padding: "6px",
                              border: "1px solid var(--border)",
                              background: "var(--surface)",
                              color:
                                copiedEmailId === contact.id
                                  ? "var(--ok)"
                                  : "var(--text-faint)",
                              borderRadius: 6,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                            title="Copy email"
                          >
                            {copiedEmailId === contact.id ? (
                              <Check size={13} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Role / Tag Input */}
                      <div>
                        <input
                          type="text"
                          placeholder="e.g. QA / Client"
                          value={contact.role || ""}
                          onChange={(e) =>
                            handleUpdateContact(contact.id, "role", e.target.value)
                          }
                          style={{
                            width: "100%",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 11.5,
                            color: "var(--text)",
                            outline: "none",
                          }}
                        />
                      </div>

                      {/* Notes / Details */}
                      <div>
                        <input
                          type="text"
                          placeholder="e.g. Staging credentials / Telegram @user"
                          value={contact.notes || ""}
                          onChange={(e) =>
                            handleUpdateContact(contact.id, "notes", e.target.value)
                          }
                          style={{
                            width: "100%",
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 11.5,
                            color: "var(--text-dim)",
                            outline: "none",
                          }}
                        />
                      </div>

                      {/* Delete Button */}
                      <div style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveContact(contact.id)}
                          style={{
                            padding: "6px",
                            border: "none",
                            background: "transparent",
                            color: "var(--crit)",
                            cursor: "pointer",
                            borderRadius: 6,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: 0.8,
                          }}
                          title="Remove user row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      onClick={handleAddContact}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "var(--surface-2)",
                        border: "1px dashed var(--border-strong)",
                        color: "var(--accent)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Plus size={14} />
                      Add another user / contact row
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* IMPORTANT NOTES TAB */
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Info size={13} style={{ color: "var(--text-faint)" }} />
                  <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                    Markdown formatted notes, server links, staging credentials, and checklists.
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--text-faint)",
                    fontFamily: "monospace",
                  }}
                >
                  {notesText.length} chars • {notesText.trim() ? notesText.trim().split(/\s+/).length : 0} words
                </span>
              </div>

              <textarea
                value={notesText}
                onChange={(e) => {
                  setNotesText(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                placeholder={`Type important notes for ${currentProjObj?.name} here...
• Staging & Production URLs
• Test account credentials & access keys
• Client communication notes & deadlines
• Deployment checklists`}
                rows={14}
                style={{
                  width: "100%",
                  minHeight: 280,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: "var(--text)",
                  fontFamily: "'Inter', monospace",
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Project: <b style={{ color: "var(--text-dim)" }}>{currentProjObj?.name}</b>
            </span>
            <span style={{ color: "var(--border)" }}>•</span>
            <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
              {credentials.length} password(s) • {contacts.length} contact(s)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-dim)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 20px",
                borderRadius: 8,
                background: "var(--accent)",
                color: "var(--accent-ink)",
                fontSize: 12.5,
                fontWeight: 700,
                border: "none",
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.7 : 1,
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <Save size={14} />
              <span>{saving ? "Saving…" : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
