# nocturne

nocturne is a human-directed local workspace for routing context, reviews, and decisions between multiple LLMs.

## MVP scope

- Local browser UI
- Node.js + Express backend
- Vanilla HTML/CSS/JS frontend
- Local JSON/Markdown file storage (no database)
- Inbox for pasted LLM outputs
- Prompt composer panel for selected inbox context
- Output/copy panel
- History/archive for tasks, reports, and decisions

## Project structure

- `/server.js` - Express server and REST API
- `/public` - frontend HTML/CSS/JS
- `/data` - local JSON + Markdown files used for inbox/history

## Basic REST API

- `GET /api/health` - health check
- `GET /api/inbox` - list inbox items
- `POST /api/inbox` - add inbox item (`source`, `content`)
- `DELETE /api/inbox/:id` - remove inbox item
- `POST /api/compose` - compose prompt from instruction + selected items
- `GET /api/history` - list history entries
- `POST /api/history` - save task/report/decision entry

## Run locally

```bash
npm install
npm run start
```

Open: <http://localhost:3000>

## Notes

Not implemented in this MVP:

- Authentication
- Cloud sync
- Autonomous agents
- LangGraph
- MCP
- Browser automation
- Direct Copilot internal API access
