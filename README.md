<p align="center">
  <img src="docs/mascot.jpg" width="120" alt="ClawTabs mascot" />
</p>

<h1 align="center">⚡ ClawTabs</h1>

<p align="center">
  <strong>A multi-agent command hub for AI coordination.</strong><br/>
  Connect multiple OpenClaw agents. Coordinate via channels. All local-first.
</p>

<p align="center">
  <a href="https://github.com/marty-mcbyte/ClawTabs/stargazers"><img src="https://img.shields.io/github/stars/marty-mcbyte/ClawTabs?style=flat-square&color=00ff88&labelColor=0a0a0a" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/marty-mcbyte/ClawTabs?style=flat-square&color=00ff88&labelColor=0a0a0a" alt="License"></a>
  <img src="https://img.shields.io/badge/made%20with-%E2%9D%A4%EF%B8%8F%20%2B%20caffeine-00ff88?style=flat-square&labelColor=0a0a0a" alt="Made with love">
  <img src="https://img.shields.io/badge/aesthetic-cyberpunk-00ff88?style=flat-square&labelColor=0a0a0a" alt="Cyberpunk">
</p>

---

## 🎯 What is ClawTabs?

ClawTabs is a **command hub** for coordinating multiple AI agents. Think Slack, but for your AI workforce.

- **Connect** multiple OpenClaw gateways (each gateway = one agent)
- **Coordinate** agents via channels — broadcast messages, get responses
- **Monitor** all sessions and agent activity in one place
- **100% local** — no servers, no accounts, just your browser

```
┌─────────────────────────────────────────────────────┐
│                    ClawTabs                         │
├──────────┬──────────────────────────────────────────┤
│ Agents   │  #coordination channel                   │
│ ● Marty  │  ──────────────────────────             │
│ ● Agent2 │  You: What's the status?                │
│ ● Agent3 │  Marty: All systems nominal.            │
│          │  Agent2: Processing queue is clear.     │
│ Channels │  Agent3: Ready for new tasks.           │
│ # coord  │                                          │
│ # tasks  │  [Type a message...]                    │
└──────────┴──────────────────────────────────────────┘
```

---

## 🚀 Quick Start

```bash
git clone https://github.com/marty-mcbyte/ClawTabs.git
cd ClawTabs
npm install
npm run dev
```

Open **http://localhost:5173** and add your first gateway.

### Connect to OpenClaw

1. Click the ⚙ gear icon (Gateway Settings)
2. Enter your OpenClaw gateway URL (e.g., `ws://localhost:18789`)
3. Enter your gateway token
4. Click "Test" then "Add Gateway"

---

## ✨ Features

### Multi-Agent Command Hub

| Feature | Description |
|---------|-------------|
| 🔌 **Multi-Gateway** | Connect to unlimited OpenClaw instances simultaneously |
| 👥 **Agent Sidebar** | See all agents with presence indicators (online/busy/offline) |
| 🎨 **Color-Coded** | Each agent gets a unique color throughout the UI |
| 📊 **Session Routing** | Sessions automatically route to the correct agent |

### Channel Coordination

| Feature | Description |
|---------|-------------|
| 📢 **Channels** | Create Slack-style channels for multi-agent coordination |
| 🎯 **@mentions** | Target specific agents with `@AgentName message` |
| 💬 **Responses** | Agent responses automatically appear in the channel |
| ⌨️ **Typing** | See which agents are typing in real-time |
| 🔔 **Unread** | Badge counts for unread messages per channel |
| 🔊 **Notifications** | Browser notifications when tab is not focused |

### Session Management

| Feature | Description |
|---------|-------------|
| 🗂️ **Multi-Session** | Parallel conversations with any agent |
| 🔀 **Split View** | View two sessions side-by-side (`Ctrl+\`) |
| 🔍 **Search** | Search across all sessions |
| 📊 **OPS Panel** | Monitor sub-agents and background sessions |

### Local-First

- **IndexedDB Storage** — Gateways, channels, messages all persist locally
- **No Accounts** — Just open the page and start using
- **No Server** — ClawTabs is just a static site
- **Export/Import** — (Coming soon) Backup and restore your data

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command palette |
| `Ctrl+N` | New session |
| `Ctrl+W` | Close current session |
| `Ctrl+\` | Toggle split view |
| `Ctrl+Tab` | Next session |
| `Ctrl+Shift+Tab` | Previous session |
| `Ctrl+1-9` | Jump to session by number |
| `Enter` | Send message |
| `Shift+Enter` | New line |

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                      ClawTabs                          │
│                   (Browser App)                        │
├────────────────────────────────────────────────────────┤
│  IndexedDB                                             │
│  ├── gateways (connection configs)                     │
│  ├── channels (workspaces)                            │
│  └── messages (channel history)                       │
├────────────────────────────────────────────────────────┤
│  GatewayManager                                        │
│  ├── WebSocket connections to N gateways              │
│  ├── Event routing (chat events → channels)           │
│  └── Session management per gateway                   │
└────────────────────────────────────────────────────────┘
        │           │           │
        ▼           ▼           ▼
   Gateway A   Gateway B   Gateway C
   (Agent 1)   (Agent 2)   (Agent 3)
```

---

## 🛠️ Tech Stack

- **React 19** + TypeScript
- **Vite 7** — instant HMR
- **IndexedDB** — local persistence
- **WebSocket** — real-time gateway communication
- **JetBrains Mono** — the only acceptable monospace font

---

## 🗺️ Roadmap

- [x] Multi-gateway connections
- [x] Agent presence indicators
- [x] Channel system with multi-agent coordination
- [x] @mention targeting
- [x] Response routing to channels
- [x] Typing indicators
- [x] Unread counts and notifications
- [ ] Task handoff workflows ("pass to Agent B when done")
- [ ] Export/import configuration
- [ ] Channel history pagination
- [ ] Audio notifications (optional)
- [ ] Mobile-responsive layout

---

## 🤝 Contributing

Contributions welcome! Fork it, hack it, PR it.

1. Fork the repo
2. Create your branch (`git checkout -b feature/sick-feature`)
3. Commit (`git commit -m 'Add sick feature'`)
4. Push (`git push origin feature/sick-feature`)
5. Open a Pull Request

---

## 📄 License

MIT — do whatever you want.

---

<p align="center">
  <sub>Built for <a href="https://github.com/openclaw/openclaw">OpenClaw</a> · by <a href="https://github.com/marty-mcbyte">marty-mcbyte</a></sub>
</p>
