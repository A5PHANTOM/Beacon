# Beacon MCP Server

Model Context Protocol (MCP) server for integrating the **Beacon QA Issue Tracker** with **Google Antigravity**, Claude Code, or Cursor.

---

## 🛠 Available Tools

| Tool Name | Type | Description |
| :--- | :--- | :--- |
| `list_beacon_projects` | Read-only | Lists all active projects, keys, and issue statistics. |
| `list_beacon_issues` | Read-only | Lists QA issues with filters for `projectId`, `status`, `severity`, and `priority`. |
| `get_beacon_issue_details` | Read-only | Returns full issue details: reproduction steps, expected vs actual behavior, environment, comments, attachments, and audit history. Supports lookup by `issueId` or `projectKey` + `issueNumber` (e.g. `BCN-1`). |
| `search_beacon_issues` | Read-only | Keyword search across titles, descriptions, and reproduction steps. |
| `get_issue_attachments` | Read-only | Lists all attachments and screenshots uploaded for an issue. |
| `update_beacon_issue_status`| Write (Safe) | Safely updates an issue's status through Beacon's workflow state machine, recording an audit log and optional notes. |
| `attach_fix_summary` | Write (Safe) | Posts an AI fix summary comment and optionally transitions the workflow status (e.g., to `FIXED`). |

---

## ⚙️ Configuration in Antigravity (`mcp_config.json`)

To connect Antigravity to Beacon, configure your MCP server settings:

### Local Development Instance
```json
{
  "mcpServers": {
    "beacon": {
      "command": "node",
      "args": ["d:/projects/Beacon/mcp-server/dist/index.js"],
      "env": {
        "BEACON_BASE_URL": "http://localhost:3000",
        "BEACON_API_KEY": "beacon-mcp-secret-key-2026"
      }
    }
  }
}
```

### Production Vercel Instance
```json
{
  "mcpServers": {
    "beacon": {
      "command": "node",
      "args": ["d:/projects/Beacon/mcp-server/dist/index.js"],
      "env": {
        "BEACON_BASE_URL": "https://beacon-a5phantom.vercel.app",
        "BEACON_API_KEY": "<YOUR_BEACON_API_KEY_FROM_VERCEL>"
      }
    }
  }
}
```

---

## 🚀 Building & Running Locally

```bash
cd mcp-server
npm install
npm run build
npm start
```
