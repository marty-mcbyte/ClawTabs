<p align="center">
  <img src="docs/mascot.jpg" width="120" alt="ClawTabs mascot" />
</p>

<h1 align="center">⚡ ClawTabs</h1>

<p align="center">
  <strong>A cyberpunk terminal-style chat UI for AI agents.</strong><br/>
  Multi-session. Local-first. Browser-based. Beautifully dystopian.
</p>

<p align="center">
  <a href="https://github.com/marty-mcbyte/ClawTabs/stargazers"><img src="https://img.shields.io/github/stars/marty-mcbyte/ClawTabs?style=flat-square&color=00ff88&labelColor=0a0a0a" alt="Stars"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/marty-mcbyte/ClawTabs?style=flat-square&color=00ff88&labelColor=0a0a0a" alt="License"></a>
  <img src="https://img.shields.io/badge/made%20with-%E2%9D%A4%EF%B8%8F%20%2B%20caffeine-00ff88?style=flat-square&labelColor=0a0a0a" alt="Made with love">
  <img src="https://img.shields.io/badge/aesthetic-cyberpunk-00ff88?style=flat-square&labelColor=0a0a0a" alt="Cyberpunk">
</p>

---

<p align="center">
  <img src="docs/screenshot.png" alt="ClawTabs in action — cyberpunk terminal chat UI" width="900" />
</p>

<!-- 🎬 GIF PLACEHOLDER: Record a ~15s GIF showing tab creation, message send, and sidebar search.
     Tools: LICEcap, ShareX, or `ffmpeg -i screen.mp4 -vf "fps=12,scale=900:-1" docs/demo.gif`
     Replace this comment with: ![ClawTabs Demo](docs/demo.gif) -->

---

## 🚀 Quick Start

```bash
git clone https://github.com/marty-mcbyte/ClawTabs.git
cd ClawTabs
npm install
npm run build
npx serve dist -p 8088
```

Open **http://localhost:8088** → you're in.

### Development

```bash
npm run dev    # Vite dev server with hot reload
```

---

## ✨ Features

| | |
|---|---|
| 🗂️ **Multi-session tabs** | Run parallel conversations — switch with `Ctrl+Tab` |
| 📡 **Transmission sidebar** | Browse, search, and manage all sessions at a glance |
| 🌃 **Cyberpunk terminal aesthetic** | Dark theme, scanline overlay, green-on-black, JetBrains Mono |
| 📝 **Full markdown rendering** | Code blocks, tables, inline code — all styled |
| ⌨️ **Keyboard-first** | `Ctrl+N` new · `Ctrl+W` close · `Ctrl+1-9` jump |
| 📊 **OPS panel** | System monitoring tab with connection status |
| 🔒 **100% local** | No cloud, no tracking, no external dependencies |
| ⚡ **Blazing fast** | React 19 + Vite — sub-second builds |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New session |
| `Ctrl+W` | Close current session |
| `Ctrl+Tab` | Next session |
| `Ctrl+Shift+Tab` | Previous session |
| `Ctrl+1-9` | Jump to session by number |
| `Enter` | Send message |
| `Shift+Enter` | New line |

---

## 🛠️ Tech Stack

- **React 19** + TypeScript
- **Vite 7** — instant HMR
- **react-markdown** + remark-gfm + rehype-highlight
- **JetBrains Mono** — the only acceptable monospace font

---

## 🗺️ Roadmap

- [ ] Wire up to [OpenClaw](https://github.com/openclaw/openclaw) gateway WebSocket
- [ ] Session persistence (localStorage / file-based)
- [ ] Drag-to-reorder sessions
- [ ] Export/import sessions as markdown/JSON
- [ ] Search across all session histories
- [ ] OPS tab with live system monitoring

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
