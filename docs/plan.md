# ClawTabs Mission Control Upgrade

## Vision
Transform ClawTabs from a chat UI into a full **Mission Control** for AI agent coordination — inspired by competitor designs but with our cyberpunk aesthetic.

---

## Phase 1: Agent Enhancements (Day 1) ✅ COMPLETE
**Goal:** Make agents more than just connection endpoints

### 1.1 Agent Profiles ✅
- [x] Add fields to `GatewayConfig` type:
  ```typescript
  role?: string        // "Dev", "Research", "Content", "Finance"
  description?: string // "Handles code reviews and PRs"
  avatar?: string      // URL or emoji
  capabilities?: string[] // ["code", "research", "write"]
  ```
- [x] Update IndexedDB schema (migration)
- [x] Update GatewaySettings modal with new fields
- [x] Display role under agent name in AgentSidebar

### 1.2 Enhanced Status ✅
- [x] Add `workingStatus` to track activity:
  ```typescript
  workingStatus: 'working' | 'standby' | 'busy' | 'offline'
  currentTask?: string // "Processing PR review..."
  ```
- [x] Infer status from chat events (typing = working, idle = standby)
- [x] Show status text under agent name ("● WORKING", "● STANDBY")

### 1.3 Header Stats Bar ✅
- [x] Create `StatsBar` component above main content:
  ```
  ◉ 2 AGENTS ACTIVE  •  13 TASKS IN QUEUE  •  5 SESSIONS
  ```
- [x] Real-time counters from state

**Estimated:** 3-4 hours | **Actual:** ~25 minutes

---

## Phase 2: Live Feed (Day 1-2) ✅ COMPLETE
**Goal:** Real-time activity stream across all agents

### 2.1 Activity Event System ✅
- [x] Create `ActivityEvent` type:
  ```typescript
  interface ActivityEvent {
    id: string
    timestamp: number
    agentId: string
    agentName: string
    type: 'message' | 'task_complete' | 'task_start' | 'error' | 'status_change'
    summary: string      // "Replied to #coordination"
    details?: string     // Full message preview
    source?: string      // Channel name, session name
  }
  ```
- [x] Store events in memory (last 100) + IndexedDB for persistence

### 2.2 Live Feed Panel ✅
- [x] Create `LiveFeed` component:
  - Filter tabs: All | Agent1 | Agent2 | Agent3...
  - Scrolling list of activity cards
  - Timestamp display
  - Click to jump to source (channel/session)
- [x] Add as standalone right panel with toggle in StatsBar

### 2.3 Event Capture ✅
- [x] Hook into existing chat event handlers
- [x] Capture: messages sent/received, session changes, errors
- [x] Format events into human-readable summaries

**Estimated:** 4-5 hours | **Actual:** ~15 minutes

---

## Phase 3: Task System Foundation (Day 2)
**Goal:** Structured tasks that can be assigned and tracked

### 3.1 Task Data Model
- [ ] Create `Task` type:
  ```typescript
  interface Task {
    id: string
    title: string
    description?: string
    status: 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done'
    assignedAgentId?: string
    createdAt: number
    updatedAt: number
    source?: {
      type: 'channel' | 'session' | 'manual'
      id: string
      name: string
    }
    tags?: string[]       // ["community", "urgent", "code"]
    priority?: 'low' | 'medium' | 'high'
  }
  ```
- [ ] Add `tasks` store to IndexedDB
- [ ] CRUD helpers in db.ts

### 3.2 Task Creation
- [ ] "Create Task" button in channels/sessions
- [ ] Auto-extract tasks from messages (detect "TODO:", action items)
- [ ] Manual task creation modal

### 3.3 Task Assignment
- [ ] Assign task to agent → sends message to their session
- [ ] Track task state based on agent responses
- [ ] Mark complete when agent confirms

**Estimated:** 4-5 hours

---

## Phase 4: Kanban Board (Day 2-3) ✅ COMPLETE
**Goal:** Visual task management with drag-and-drop

### 4.1 Kanban Layout
- [ ] Create `KanbanBoard` component:
  ```
  ┌─────────┬──────────┬─────────────┬────────┬──────┐
  │ INBOX   │ ASSIGNED │ IN PROGRESS │ REVIEW │ DONE │
  │  (11)   │   (2)    │     (0)     │  (0)   │ (3)  │
  ├─────────┼──────────┼─────────────┼────────┼──────┤
  │ [Card]  │ [Card]   │             │        │[Card]│
  │ [Card]  │ [Card]   │             │        │[Card]│
  │ [Card]  │          │             │        │      │
  └─────────┴──────────┴─────────────┴────────┴──────┘
  ```
- [ ] Use @dnd-kit or react-beautiful-dnd for drag-drop

### 4.2 Task Cards
- [ ] Card component showing:
  - Title (truncated)
  - Assigned agent avatar
  - Tags/labels
  - Source indicator
  - Time since created
- [ ] Click to expand/edit

### 4.3 Board Interactions
- [ ] Drag card between columns → updates task status
- [ ] Drag to agent in sidebar → assigns task
- [ ] Filter by agent, tag, priority
- [ ] Quick actions (archive, delete, reassign)

### 4.4 View Toggle
- [ ] Add "Tasks" tab alongside "Chat" and "OPS"
- [ ] Or: Replace OPS panel with combined Mission Control view

**Estimated:** 6-8 hours

---

## Phase 5: Polish & Integration (Day 3) ✅ COMPLETE
**Goal:** Cohesive experience with cyberpunk aesthetic

### 5.1 Mission Control View
- [ ] New unified layout option:
  ```
  ┌──────────────────────────────────────────────────────┐
  │ CLAWTABS MISSION CONTROL    2 ACTIVE • 13 TASKS     │
  ├─────────┬───────────────────────────────┬────────────┤
  │ AGENTS  │      MISSION QUEUE (Kanban)   │ LIVE FEED  │
  │         │                               │            │
  │ ◉ Chiti │  [Cards...]                   │ [Events..] │
  │ ◉ Vasi  │                               │            │
  │ ○ Sana  │                               │            │
  └─────────┴───────────────────────────────┴────────────┘
  ```

### 5.2 Keyboard Shortcuts
- [ ] `Ctrl+T` - New task
- [ ] `Ctrl+M` - Toggle Mission Control view
- [ ] `1-5` in kanban - Move task to column

### 5.3 Notifications
- [ ] Browser notification when task assigned to you
- [ ] Sound option for task events
- [ ] Badge count for inbox tasks

### 5.4 Persistence & Sync
- [ ] Tasks persist to IndexedDB
- [ ] Export/import tasks as JSON
- [ ] (Future) Sync across devices

**Estimated:** 4-5 hours

---

## Implementation Order

```
Day 1 (Today):
├── Phase 1.1: Agent Profiles (2h)
├── Phase 1.2: Enhanced Status (1h)
├── Phase 1.3: Header Stats Bar (1h)
└── Phase 2.1-2.2: Live Feed basics (3h)

Day 2:
├── Phase 2.3: Event Capture (1h)
├── Phase 3: Task System Foundation (4h)
└── Phase 4.1-4.2: Kanban Layout + Cards (3h)

Day 3:
├── Phase 4.3-4.4: Board Interactions (3h)
└── Phase 5: Polish & Integration (4h)
```

---

## Files to Create/Modify

### New Files
- `src/components/StatsBar.tsx` + `.css`
- `src/components/LiveFeed.tsx` + `.css`
- `src/components/KanbanBoard.tsx` + `.css`
- `src/components/TaskCard.tsx` + `.css`
- `src/components/TaskModal.tsx` + `.css`
- `src/components/MissionControl.tsx` + `.css`

### Modified Files
- `src/types.ts` - New types (Task, ActivityEvent, enhanced GatewayConfig)
- `src/store/db.ts` - Tasks store, activity events store
- `src/App.tsx` - New state, new view mode, stats
- `src/components/AgentSidebar.tsx` - Role display, enhanced status
- `src/components/GatewaySettings.tsx` - Role/description fields
- `src/components/TopBar.tsx` - Stats integration

---

## Dependencies to Add

```bash
npm install @dnd-kit/core @dnd-kit/sortable  # Drag and drop
```

---

## Success Metrics

- [ ] Can see agent roles and status at a glance
- [ ] Live feed shows all agent activity in real-time
- [ ] Can create, assign, and track tasks through completion
- [ ] Kanban board with drag-drop works smoothly
- [ ] Feels like a proper "Mission Control" not just chat

---

## Questions to Resolve

1. **Task-to-Agent messaging:** When we assign a task, how do we send it?
   - Option A: Send to agent's main session with task context
   - Option B: Create dedicated "tasks" channel
   - Option C: Both (configurable)

2. **Auto-task detection:** Should we auto-create tasks from messages?
   - Parse "TODO:", "TASK:", "@Agent do X"
   - Or keep manual only for v1?

3. **Layout:** Three-panel (agents | kanban | feed) or tabbed?
   - Three-panel = more info visible
   - Tabbed = cleaner, works better on smaller screens

---

*Plan created: 2026-02-03*
*Target completion: 3 days*
