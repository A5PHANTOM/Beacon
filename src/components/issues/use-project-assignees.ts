"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getProjectAssigneesAction } from "@/app/(dashboard)/projects/[id]/assignee-actions";
import type { ProjectAssignees } from "@/lib/project-assignees";

export function useProjectAssignees(projectId: string, connectionKey: string) {
  const [state, setState] = useState<ProjectAssignees & { loading: boolean; error: string | null }>({ mode: "beacon", developers: [], loading: true, error: null });
  const request = useRef({ value: 0 });
  const refresh = useCallback(async () => {
    const id = ++request.current.value;
    setState(previous => ({ ...previous, developers: [], loading: true, error: null }));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        getProjectAssigneesAction({ projectId }),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Assignee request timed out")), 30000); }),
      ]);
      if (id !== request.current.value) return;
      setState(result.success ? { ...result.data, loading: false, error: null } : { mode: "github", developers: [], loading: false, error: result.error });
    } catch {
      if (id === request.current.value) setState({ mode: "github", developers: [], loading: false, error: "Could not load developers. Please retry." });
    } finally { clearTimeout(timeout); }
  }, [projectId]);
  useEffect(() => {
    const requests = request.current;
    const scheduled = setTimeout(() => { void refresh(); }, 0);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => { ++requests.value; clearTimeout(scheduled); window.removeEventListener("focus", onFocus); };
  }, [refresh, connectionKey]);
  return { ...state, refresh };
}
