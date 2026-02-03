# Task System Design

## Current State (Problems)

### Problem 1: Session Targeting
- Task dispatch hardcodes `gateway.chatSend('agent:main', ...)`
- User might be chatting via different session (webchat creates its own sessions)
- Agent never sees the task message in the actual conversation

### Problem 2: Status Update Mechanism
- Relies on agent responding with exact format: `[TASK #abc123 STATUS:in_progress]`
- Agent has no context about this convention
- Fragile regex parsing

### Problem 3: No Feedback Loop
- User doesn't see if task was delivered
- User doesn't see agent's response
- Kanban feels disconnected from chat

---

## Architecture Analysis

### How Sessions Work
```
ClawTabs → WebSocket → OpenClaw Gateway → Sessions
                                           ├── agent:main (primary)
                                           ├── webchat-xxx (from ClawTabs)
                                           ├── telegram-xxx
                                           └── ...
```

When Brian chats via ClawTabs:
- ClawTabs creates/uses a session (likely `webchat-*` or mapped to existing)
- Messages go to THAT session
- Agent (me) responds in THAT session

When task is assigned:
- Current code sends to `agent:main`
- That's a DIFFERENT session
- Agent might respond there, but user isn't viewing it

### Key Insight
The agent doesn't have separate "inboxes" per session. All sessions feed into the same agent context. But RESPONSES go back to the originating session.

If task goes to `agent:main` and agent responds, the response stays in `agent:main`. User viewing `webchat-xxx` never sees it.

---

## Design Options

### Option A: Send to Active Session (Quick Fix)
Send task to whatever session user is currently viewing for that agent.

**Pros:** Simple, user sees the conversation
**Cons:** What if user has no session open for that agent?

### Option B: Dedicated Task Channel
Create a special "Tasks" channel that all agents monitor.

**Pros:** Centralized, clear separation
**Cons:** Adds complexity, agents need to be "subscribed"

### Option C: Task as Notification + Manual Tracking
Don't try to auto-update status. Just:
1. Send notification to agent
2. User drags cards manually
3. Agent can optionally send status updates

**Pros:** Robust, no fragile parsing
**Cons:** Less automation

### Option D: Hybrid (Recommended)
1. Send task to agent's main session
2. Switch UI to show that session after sending
3. Include clear instructions in the message
4. Parse status updates if present, but don't require them
5. User can always drag cards manually

---

## Recommended Implementation

### 1. Task Message Delivery
```typescript
// Find or create appropriate session
const targetSession = findAgentSession(task.assignedAgentId) || 'agent:main'

// Send with clear instructions
const message = `📋 **New Task Assigned**
**Task:** ${task.title}
**ID:** #${task.id.slice(-6)}
**Priority:** ${task.priority}

${task.description || ''}

---
When you start: \`[TASK #${task.id.slice(-6)} ACTIVE]\`
When done: \`[TASK #${task.id.slice(-6)} DONE]\`
(Or the user can drag the card in Kanban)`
```

### 2. UI Feedback
After sending task:
- Show toast: "Task sent to {agent} in {session}"
- Optionally auto-switch to that session
- Highlight the task card briefly

### 3. Status Update Parsing
Keep current parsing but make it more lenient:
- `[TASK #xxx ACTIVE]` or `[TASK #xxx STATUS:active]`
- `[TASK #xxx DONE]` or `[TASK #xxx COMPLETE]`
- `[TASK #xxx REVIEW]`
- Case insensitive

### 4. Fallback
User can ALWAYS drag cards between columns. This is the manual override.

### 5. Session Discovery
```typescript
function findAgentSession(agentId: string): string | null {
  // 1. Check if user is currently viewing a session for this agent
  const activeSession = sessions.find(s => s.id === activeSessionId)
  if (activeSession?.gatewayId === agentId) {
    return activeSession.id
  }
  
  // 2. Find first session for this agent
  const agentSession = sessions.find(s => s.gatewayId === agentId)
  if (agentSession) {
    return agentSession.id
  }
  
  // 3. Default to agent:main
  return 'agent:main'
}
```

---

## Implementation Checklist

- [x] Update `handleCreateTask` to use proper session targeting
- [x] Update `handleUpdateTask` for same session logic
- [x] Improve task message format with clear instructions
- [x] Add activity feed events for success/failure
- [x] Auto-switch to session after task dispatch
- [ ] Add "View conversation" button on task card
- [ ] Test with real multi-session scenario
- [ ] Add toast notifications (visual feedback)
- [ ] Document the expected agent response format

## What Was Implemented (2026-02-03)

### Session Targeting Logic
```typescript
// 1. If user is viewing a session for this agent, use that
// 2. Otherwise, prefer agent:main
// 3. Fall back to first available session
const currentSession = sessions.find(s => s.id === activeSessionId)
if (currentSession?.gatewayId === task.assignedAgentId) {
  targetSessionId = activeSessionId
} else {
  const mainSession = agentSessions.find(s => s.id === 'agent:main')
  targetSessionId = mainSession?.id || agentSessions[0]?.id || 'agent:main'
}
```

### Improved Task Message Format
```
📋 **New Task Assigned**

**Task:** {title}
**ID:** #{6-char-id}
**Priority:** 🔴/🟡/🟢 {priority}
**Tags:** {tags}

{description}

---
Update status with:
• `[TASK #{id} ACTIVE]` — when you start
• `[TASK #{id} DONE]` — when complete
• `[TASK #{id} REVIEW]` — if needs review

Or I can drag the card manually in Kanban.
```

### Auto View Switch
After sending task, automatically switches to:
- The target session (so user sees the message)
- Sessions view mode (if not already there)

---

## Questions to Resolve

1. Should task assignment auto-switch to that session? (Might be disruptive)
2. What if agent is offline when task assigned? (Queue? Retry?)
3. Should there be a "resend task" button?
