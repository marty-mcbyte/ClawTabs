# Findings & Decisions

## Competitor Analysis (2026-02-03)

### "Mission Control" by @adithyashreshti

**What they have:**
- 5 named agents with roles (Coordinator, Dev, Marketing, Content, Finance)
- Status badges (LEAD, INT, SPC)
- Working/Standby status indicators
- Kanban board with 5 columns (Inbox → Assigned → In Progress → Review → Done)
- Task cards with tags and source references
- Live feed with agent filter tabs
- Header stats ("2 AGENTS ACTIVE • 13 TASKS IN QUEUE")

**What we already have that they don't:**
- Multi-gateway architecture (real agent connections, not just UI)
- Channels for multi-agent coordination
- @mention routing
- Response routing back to channels
- Typing indicators
- Unread counts
- Browser notifications
- Cyberpunk aesthetic

**Our advantages:**
- Actually connected to real OpenClaw agents
- Working chat/messaging system
- Local-first (IndexedDB) persistence
- No server required

---

## Design Decisions

### Layout
**Decision:** Start with tabbed layout, add Mission Control as new tab
**Rationale:** Easier to implement, doesn't break existing UI, can iterate

### Task Assignment
**Decision:** Send tasks to agent's main session with context prefix
**Format:** `[TASK #123] Title: Description`
**Rationale:** Works with existing chat infrastructure, agents can respond naturally

### Auto-task Detection
**Decision:** Manual only for v1
**Rationale:** Keep it simple, avoid false positives, add later

### Drag-and-Drop Library
**Decision:** @dnd-kit
**Rationale:** Modern, accessible, good React 18+ support, smaller than react-beautiful-dnd

---

## Technical Notes

### Task State Machine
```
inbox → assigned → in_progress → review → done
                ↘ inbox (unassigned)
                          ↘ inbox (rejected)
```

### Activity Event Sources
1. Chat events from GatewayManager
2. Task state changes
3. Agent status changes
4. Channel messages

### Performance Considerations
- Keep only last 100 activity events in memory
- Paginate task list (max 50 visible)
- Virtual scrolling for live feed if needed

---

## Alternatives Considered

### Full Rewrite
- Considered rebuilding from scratch with new layout
- Rejected: Too much existing functionality to preserve
- Decision: Incremental additions

### Electron App
- Considered for better notifications/system tray
- Rejected for v1: Web-first, add later
- Decision: Stay browser-based, use web notifications

### Task Backend
- Considered: Store tasks on gateway/server
- Rejected: Goes against local-first philosophy
- Decision: IndexedDB only, export/import for backup
