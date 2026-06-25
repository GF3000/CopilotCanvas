# 🎬 Canvas for Copilot — Presentation Video

This folder contains everything needed to **recreate the hackathon presentation
video** for Canvas for Copilot. It's a self-contained [Remotion](https://www.remotion.dev)
project (videos built with React), plus the written script.

Anyone on the team can render the exact same video — no design tools required.

---

## 📁 What's in here

| Path | What it is |
|------|------------|
| `SCRIPT.md` | The full production script (scenes, on-screen text, voiceover, timing) |
| `Canvas-for-Copilot-Video-Script.docx` | Word export of the script (for sharing / SharePoint) |
| `src/CanvasForCopilot.tsx` | The whole video — all scenes, animations, and the team outro |
| `src/Root.tsx` | Registers the compositions |
| `public/music-pro.mp3` | Background music ("Evolution" — Bensound.com) |
| `public/clips/` | Drop real screen recordings here (see below) |
| `public/avatars/` | Drop team avatar photos here (see below) |

There are **two compositions**:
- **`CanvasForCopilotFull`** — the main video (~1:43): animation interleaved with
  real demo clips, plus how-to-download, future work, and the team outro.
- **`CanvasForCopilot`** — a shorter, animation-only cut (~60 s, no demo clips).

---

## ▶️ Quick start (recreate the video)

> Prerequisite: **Node.js 18+**. Remotion downloads its own headless Chrome +
> FFmpeg on first render — nothing else to install.

```bash
cd video-presentation
npm install

# Open the visual editor (live preview, scrub, tweak):
npm run dev          # → http://localhost:3000  → pick "CanvasForCopilotFull"

# Or render straight to an mp4:
npx remotion render CanvasForCopilotFull out/canvas-full.mp4
```

The rendered file lands in `out/` (git-ignored).

---

## 🎥 Add the real demo clips (optional but recommended)

The video has slots for real screen recordings of the extension. Until you add
them, those scenes show a labeled placeholder, so it always renders.

1. Record three short clips (~5–10 s each) of the extension in VS Code:
   - `clip-visualize.mp4` — ask Copilot to diagram a flow; the canvas tab opens
   - `clip-interact.mp4` — click a node; "explain this node" / "expand this node"
   - `clip-modify.mp4` — select a node; "add an endpoint"; code + diagram update
2. Drop them in `public/clips/`.
3. In `src/CanvasForCopilot.tsx`, set the `CLIP_SOURCES` map near the top:
   ```ts
   const CLIP_SOURCES = {
     visualize: "clips/clip-visualize.mp4",
     interact:  "clips/clip-interact.mp4",
     modify:    "clips/clip-modify.mp4",
   };
   ```
4. Re-render.

---

## 🧑‍🤝‍🧑 Add team avatar photos (optional)

The outro shows 5 circular avatars (initials by default). To use photos:

1. Add square images to `public/avatars/` (e.g. `avatar-1.png` … `avatar-5.png`).
2. In `src/CanvasForCopilot.tsx`, set each member's `img` in the `TEAM` array, e.g.
   `{ name: "Ashley Torres Perez", initials: "AT", color: C.pink, img: "avatars/avatar-1.png" }`.

---

## 🤖 Working with AI agents (Remotion skill)

This project follows the [Remotion Agent Skills](https://www.remotion.dev/docs/ai/skills)
best practices. If you use Claude Code / Codex / Cursor / Copilot CLI, install the
skill so the agent knows Remotion conventions:

```bash
npx skills add remotion-dev/skills
```

Then you can ask the agent to tweak scenes, timing, text, or colors and re-render.

---

## ✏️ Editing tips

- All scenes live in `src/CanvasForCopilot.tsx`. Each scene is a small React
  component; the timeline is at the bottom in `CanvasForCopilotFull`.
- Colors are in the `C` object; fonts in `FONT` / `MONO`.
- The frame rate is **30 fps**, so `90` frames = 3 seconds.
- Keep the script (`SCRIPT.md`) and the video in sync when you change wording.

---

## 📝 Credits & licensing

- Music: **"Evolution" by [Bensound.com](https://www.bensound.com)** — free license
  requires crediting Bensound (already shown in the outro); register a free license
  code at bensound.com for submission.
- Built with [Remotion](https://www.remotion.dev) (review their license for your use case).
