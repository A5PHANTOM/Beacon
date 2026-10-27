"use client";
import type { AssignableDeveloper } from "@/lib/project-assignees";
export type AssigneeChoices = { developers: AssignableDeveloper[]; mode: "beacon" | "github"; loading: boolean; error: string | null; refresh: () => Promise<void> };

export function AssigneeListNotice({ choices }: { choices: AssigneeChoices }) {
  return <div style={{ padding: "8px 10px", fontSize: 11, lineHeight: 1.6, color: choices.error ? "var(--crit)" : "var(--text-dim)" }}>
    <span role={choices.error ? "alert" : "status"}>{choices.loading ? "Checking developer access…" : choices.error || (choices.developers.length ? choices.mode === "github" ? "Verified in Beacon + GitHub" : "Beacon project developers" : choices.mode === "github" ? "No matching developers. They must sign in with GitHub and have access to this project and repository." : "No developers in this project.")}</span>
    <button type="button" disabled={choices.loading} onClick={event => { event.stopPropagation(); void choices.refresh(); }} style={{ display: "block", marginTop: 5, padding: 0, background: "none", border: 0, color: "var(--accent)", fontSize: 11, cursor: "pointer" }}>Refresh developers</button>
  </div>;
}

export function DeveloperAssigneeSelect({ choices, value, onChange }: { choices: AssigneeChoices; value: string; onChange: (id: string) => void }) {
  const valid = choices.developers.some(developer => developer.userId === value);
  return <>
    <select aria-label="Assign developer" required disabled={choices.loading || !!choices.error || choices.developers.length === 0} value={valid ? value : ""} onChange={event => onChange(event.target.value)} style={{ width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 10px", fontSize: 12, color: "var(--text)", outline: "none" }}>
      <option value="" disabled>{choices.loading ? "Checking access…" : "Select a developer"}</option>
      {choices.developers.map(developer => <option key={developer.userId} value={developer.userId}>{developer.name}{developer.githubLogin && choices.mode === "github" ? ` · @${developer.githubLogin}` : ""}</option>)}
    </select>
    <AssigneeListNotice choices={choices} />
  </>;
}
