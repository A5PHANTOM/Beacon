#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

const BEACON_BASE_URL =
  process.env.BEACON_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
const BEACON_API_KEY =
  process.env.BEACON_API_KEY || "beacon-mcp-secret-key-2026";
const BEACON_USER_EMAIL = process.env.BEACON_USER_EMAIL;

async function requestBeacon(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const url = `${BEACON_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${BEACON_API_KEY}`,
    "Content-Type": "application/json",
  };

  if (BEACON_USER_EMAIL) {
    headers["x-beacon-user-email"] = BEACON_USER_EMAIL;
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

  if (!response.ok) {
    const errorMsg =
      (typeof data?.error === "string" ? data.error : null) ||
      `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`Beacon API Error: ${errorMsg}`);
  }

  return data;
}

const TOOLS: Tool[] = [
  {
    name: "list_beacon_projects",
    description:
      "List all active projects in the Beacon QA Issue Tracker with issue counts and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of projects to return (default: 50).",
        },
      },
    },
  },
  {
    name: "list_beacon_issues",
    description:
      "List QA issues and bug reports from Beacon. Supports filtering by project (ID or key), status, severity, or priority.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description:
            "Filter issues by project ID or project key (e.g., 'BCN' or 'TEST' or 'cmukx2jw40001js04w1blt7sa').",
        },
        status: {
          type: "string",
          description:
            "Filter by issue status (e.g., 'REPORTED', 'IN_PROGRESS', 'FIXED', 'VERIFIED', 'CLOSED').",
        },
        severity: {
          type: "string",
          description:
            "Filter by severity ('UI', 'BACKEND', 'AI', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL').",
        },
        priority: {
          type: "string",
          description: "Filter by priority ('LOW', 'MEDIUM', 'HIGH', 'URGENT').",
        },
        limit: {
          type: "number",
          description: "Maximum number of issues to return (default: 50, max: 100).",
        },
      },
    },
  },
  {
    name: "get_beacon_issue_details",
    description:
      "Retrieve full details of a specific Beacon issue, including title, description, reproduction steps, expected vs actual behavior, environment, comments, screenshots/attachments, and audit history.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "The unique CUID of the issue (e.g. 'cmtzgmxui0006w166pzx1e275').",
        },
        projectKey: {
          type: "string",
          description:
            "The project key (e.g. 'BCN') if looking up by issue number instead of issue ID.",
        },
        issueNumber: {
          type: "number",
          description:
            "The issue number within the project (e.g. 1 for 'BCN-1'). Requires projectKey.",
        },
      },
    },
  },
  {
    name: "search_beacon_issues",
    description:
      "Search Beacon QA issues across titles, descriptions, and reproduction steps.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query term or phrase.",
        },
        projectId: {
          type: "string",
          description: "Optional project ID or key to narrow search scope.",
        },
        limit: {
          type: "number",
          description: "Maximum search results to return (default: 20).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_issue_attachments",
    description:
      "Retrieve all attachments and screenshots associated with a specific Beacon issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "The unique ID of the issue to retrieve attachments for.",
        },
      },
      required: ["issueId"],
    },
  },
  {
    name: "update_beacon_issue_status",
    description:
      "Safely update an issue's workflow status. Validates against Beacon's state machine, logs an audit history entry, and appends resolution notes as a comment.",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "The unique ID of the issue to update.",
        },
        status: {
          type: "string",
          description:
            "Target status (e.g., 'IN_PROGRESS', 'DEV_REVIEW', 'FIXED', 'VERIFIED', 'CLOSED', 'REJECTED').",
        },
        notes: {
          type: "string",
          description:
            "Optional developer note or rationale for why the status is changing.",
        },
      },
      required: ["issueId", "status"],
    },
  },
  {
    name: "attach_fix_summary",
    description:
      "Attach an AI or developer fix summary to a Beacon issue as a structured comment, with an optional workflow status update (e.g. to 'FIXED' or 'DEV_COMPLETED').",
    inputSchema: {
      type: "object",
      properties: {
        issueId: {
          type: "string",
          description: "The unique ID of the issue.",
        },
        summary: {
          type: "string",
          description:
            "Detailed fix summary: root cause, files modified, changes implemented, and testing notes.",
        },
        updateStatusTo: {
          type: "string",
          description:
            "Optional status to transition the issue to (e.g. 'FIXED' or 'DEV_COMPLETED').",
        },
      },
      required: ["issueId", "summary"],
    },
  },
];

async function main() {
  const server = new Server(
    {
      name: "beacon-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args || {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "list_beacon_projects": {
          const limit = toolArgs.limit ? `&limit=${encodeURIComponent(String(toolArgs.limit))}` : "";
          const result = await requestBeacon(`/api/mcp?action=projects${limit}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "list_beacon_issues": {
          const params = new URLSearchParams({ action: "issues" });
          if (toolArgs.projectId) params.set("projectId", String(toolArgs.projectId));
          if (toolArgs.status) params.set("status", String(toolArgs.status));
          if (toolArgs.severity) params.set("severity", String(toolArgs.severity));
          if (toolArgs.priority) params.set("priority", String(toolArgs.priority));
          if (toolArgs.limit) params.set("limit", String(toolArgs.limit));

          const result = await requestBeacon(`/api/mcp?${params.toString()}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_beacon_issue_details": {
          const params = new URLSearchParams({ action: "issue" });
          if (toolArgs.issueId) {
            params.set("issueId", String(toolArgs.issueId));
          } else if (toolArgs.projectKey && toolArgs.issueNumber) {
            params.set("projectKey", String(toolArgs.projectKey));
            params.set("issueNumber", String(toolArgs.issueNumber));
          } else {
            throw new Error(
              "Either issueId or both projectKey and issueNumber must be provided."
            );
          }

          const result = await requestBeacon(`/api/mcp?${params.toString()}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "search_beacon_issues": {
          if (!toolArgs.query) {
            throw new Error("Query parameter is required for search_beacon_issues.");
          }
          const params = new URLSearchParams({
            action: "search",
            query: String(toolArgs.query),
          });
          if (toolArgs.projectId) params.set("projectId", String(toolArgs.projectId));
          if (toolArgs.limit) params.set("limit", String(toolArgs.limit));

          const result = await requestBeacon(`/api/mcp?${params.toString()}`);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_issue_attachments": {
          if (!toolArgs.issueId) {
            throw new Error("issueId parameter is required for get_issue_attachments.");
          }
          const result = await requestBeacon(
            `/api/mcp?action=attachments&issueId=${encodeURIComponent(String(toolArgs.issueId))}`
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "update_beacon_issue_status": {
          if (!toolArgs.issueId || !toolArgs.status) {
            throw new Error("issueId and status are required.");
          }
          const result = await requestBeacon("/api/mcp", {
            method: "POST",
            body: {
              action: "update_status",
              issueId: String(toolArgs.issueId),
              status: String(toolArgs.status),
              notes: toolArgs.notes ? String(toolArgs.notes) : undefined,
            },
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "attach_fix_summary": {
          if (!toolArgs.issueId || !toolArgs.summary) {
            throw new Error("issueId and summary are required.");
          }
          const result = await requestBeacon("/api/mcp", {
            method: "POST",
            body: {
              action: "attach_fix_summary",
              issueId: String(toolArgs.issueId),
              summary: String(toolArgs.summary),
              updateStatusTo: toolArgs.updateStatusTo
                ? String(toolArgs.updateStatusTo)
                : undefined,
            },
          });
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool name: ${name}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error executing ${name}: ${message}`,
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Beacon MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error starting Beacon MCP Server:", err);
  process.exit(1);
});
