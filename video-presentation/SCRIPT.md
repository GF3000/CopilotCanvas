# 🎬 Canvas for Copilot — Hackathon Video Script

> **Working production script (v3).** Restructured for a strong **cold-open hook**:
> Problem first (no logo/team), then the title reveal as the *payoff*. Team moved
> to the outro/credits. Edit freely — shared draft.

---

## 1. Overview

| Field | Value |
|-------|-------|
| **Title** | Canvas for Copilot — see your code, don't just read it |
| **Purpose** | Hackathon submission / demo video |
| **Runtime** | Up to **4 min** allowed · recommended **~2–2.5 min** (current draft ~90 s — expandable, see §8) |
| **Format** | 1920×1080, 30 fps, H.264 `.mp4` |
| **Audience** | Hackathon judges + developers |
| **Tone** | Authentic, confident, energetic — real intern story, precise product claims |
| **Music** | "Evolution" — Bensound.com |
| **Voiceover** | Optional — written to be narrated OR to stand alone as on-screen text |

### Hook strategy (read this first)
The first **3–5 seconds decide everything**. We **cold-open on the intern pain** —
shown, not told — and **delay the logo/team** so the title lands as the *answer*
to the tension. Rule of thumb: tension in the first sentence, payoff on the reveal.

### The core story
We're **5 software-engineering interns** — **2 in Redmond, 2 in Dublin, 1 in
India**. Every project starts the same way: a *huge* unfamiliar repo and only a
few weeks to understand it and ship something real. Copilot CLI explains the
codebase — but only in **walls of text**. **Canvas for Copilot** turns those
explanations into **live, interactive diagrams** inside VS Code: *see* a system,
click into it, and even change code through it.

### Three things every viewer must remember
1. **Problem:** new to a big codebase + no time = text explanations are too slow.
2. **Solution:** Canvas for Copilot = live, interactive diagrams from Copilot, inside VS Code.
3. **Magic:** a **bidirectional loop** — click, explain, expand/undo, and search the diagram, and Copilot acts on it; nodes and links even jump straight to the real code.

---

## 2. Timeline at a glance

| # | Scene | ~Time | Dur | Real clip? |
|---|-------|-------|-----|------------|
| 1 | 🪝 COLD-OPEN HOOK (the problem) | 0:00–0:06 | 6 s | — |
| 2 | Problem deepens (walls of text) | 0:06–0:16 | 10 s | — |
| 3 | TITLE REVEAL / Solution | 0:16–0:26 | 10 s | — |
| 4 | Feature 1 · Visualize + explain (anim) | 0:26–0:34 | 8 s | — |
| 5 | 🎥 Demo · Visualize + explain | 0:34–0:40 | 6 s | **clip-visualize.mp4** |
| 6 | Feature 2 · Expand + undo (anim) | 0:40–0:48 | 8 s | — |
| 7 | 🎥 Demo · Expand + undo | 0:48–0:54 | 6 s | **clip-expand.mp4** |
| 8 | Feature 3 · Search + code reference (anim) | 0:54–1:02 | 8 s | — |
| 9 | 🎥 Demo · Search + code reference | 1:02–1:08 | 6 s | **clip-search.mp4** |
| 10 | Feature 4 · Diagram types (anim) | 1:08–1:16 | 8 s | — |
| 11 | 🎥 Demo · Diagram types | 1:16–1:22 | 6 s | **clip-types.mp4** |
| 12 | How to download | 1:22–1:34 | 12 s | optional clip |
| 13 | Future work | 1:34–1:44 | 10 s | — |
| 14 | Outro · Team + CTA | 1:44–1:54 | 10 s | — |

---

## 3. Scene-by-scene script

Format per scene: **VISUAL** · **ON-SCREEN TEXT** · **VOICEOVER** · **NOTES**.

---

### Scene 1 — 🪝 COLD-OPEN HOOK · `0:00–0:06`
> No logo. No team. No product name yet. Pure tension.
- **VISUAL:** Smash cut to a **giant repo file-tree avalanche** flooding the screen (hundreds of files cascading) + a **ticking clock / countdown** in the corner. Slightly overwhelming on purpose.
- **ON-SCREEN TEXT:**
  - `POV: your first week as an intern 👀`
  - `understand this ENTIRE repo. ship real code.`
  - `⏳ you have 3 weeks.`
- **VOICEOVER:** *"Day one as an intern. Here's a massive codebase you've never seen — and a few weeks to understand it and ship something real."*
- **NOTES:** Music starts on the cut (a single hit/riser). This is the make-or-break moment — keep it punchy, a little stressful, no branding yet.

---

### Scene 2 — Problem deepens · `0:06–0:16`
- **VISUAL:** You "ask for help" — a fake terminal types `copilot explain this repo` and replies with an **endless wall of paragraphs** that keeps scrolling. Eyes-glaze-over energy.
- **ON-SCREEN TEXT:**
  - Terminal: `$ copilot explain this repo` → 6–8 lines of dense prose ("…depends on… which depends on…")
  - Punchline: `Copilot explains it… in walls of text. 🧱`
  - `Reading paragraphs ≠ understanding a system.`
- **VOICEOVER:** *"Copilot CLI can explain it — but everything comes back as text. And reading paragraph after paragraph is a painfully slow way to see how a whole system actually fits together."*
- **NOTES:** Let the scroll feel slightly too long — that *is* the point. Tension peaks here right before the reveal.

---

### Scene 3 — TITLE REVEAL / Solution · `0:16–0:26`
> The payoff. Logo arrives as the *answer* to the pain.
- **VISUAL:** Beat drop. The wall of text **collapses / morphs into** a clean interactive node-graph that draws itself (Client→Gateway→Auth/Orders/Users). Title slams in over it.
- **ON-SCREEN TEXT:**
  - Pill: `there's a better way ✨`
  - Title: `CANVAS for COPILOT`
  - Sub: `Copilot's explanations → live, interactive diagrams, right inside a VS Code tab. text → visual, instantly. 🪄`
- **VOICEOVER:** *"So we built Canvas for Copilot. It turns those text explanations into a live, interactive diagram — right inside a VS Code tab. Suddenly, you can see the system."*
- **NOTES:** Music swells. The text→diagram morph is the signature moment — give it room to breathe.

---

### Scene 4 — Feature 1 · Visualize + explain (animated) · `0:26–0:34`
- **VISUAL:** Left: `1 · Visualize + explain` + bullets reveal. Right: graph builds node by node, then a node glows and an explanation card slides out beside it.
- **ON-SCREEN TEXT:**
  - Heading: `1 · Visualize + explain`
  - `💬 Ask: "diagram the auth flow"`
  - `🪟 Canvas opens as a VS Code tab`
  - `🔍 Pan & zoom the live graph`
  - `🧐 Click a node → "explain this" → instant breakdown`
- **VOICEOVER:** *"Feature one — visualize and explain. Ask Copilot to diagram a flow and the canvas opens right in VS Code. Pan, zoom, then click any node and ask Copilot to explain it — an instant breakdown, no scrolling."*

---

### Scene 5 — 🎥 Demo · Visualize + explain · `0:34–0:40`
- **VISUAL:** Real recording in a VS Code-style window frame, subtle zoom, "REAL DEMO 👀" badge.
- **ON-SCREEN TEXT:** `…and here it is for real 👇` / caption `Copilot draws the graph, then explains any node you click`
- **VOICEOVER:** *"Here it is for real."*
- **🎬 RECORD → `clip-visualize.mp4`:** terminal `diagram the auth flow` → canvas tab opens → graph renders → pan/zoom → click a node → `explain this node` (show reply). ~5–8 s.

---

### Scene 6 — Feature 2 · Expand + undo (animated) · `0:40–0:48`
- **VISUAL:** Left: `2 · Expand + undo` + bullets. Right: the **Auth** node expands into a small subgraph; then an ↩️ undo collapses it back in place.
- **ON-SCREEN TEXT:**
  - Heading: `2 · Expand + undo`
  - `➕ "Expand this node" → grows new detail in place`
  - `🌳 Drill deeper into any part of the system`
  - `↩️ Undo to step back — instantly`
  - `🔁 Explore freely, never lose your place`
- **VOICEOVER:** *"Feature two — expand and undo. Ask Copilot to expand any node and the diagram grows new detail in place. Go too deep? One undo steps you right back — so you can explore fearlessly."*

---

### Scene 7 — 🎥 Demo · Expand + undo · `0:48–0:54`
- **VISUAL:** Real recording in the VS Code frame.
- **ON-SCREEN TEXT:** `expand → undo 🪄` / caption `Grow the diagram in place, then step back with undo`
- **VOICEOVER:** *"Expand, undo, repeat."*
- **🎬 RECORD → `clip-expand.mp4`:** select a node → `expand this node` (subgraph appears) → undo (it collapses back). ~5–8 s.

---

### Scene 8 — Feature 3 · Search + code reference (animated) · `0:54–1:02`
- **VISUAL:** Left: `3 · Search + code reference` + bullets. Right: a search box filters/highlights matching nodes; a node shows a 🔗 code badge; clicking it opens a source file at a specific line.
- **ON-SCREEN TEXT:**
  - Heading: `3 · Search + code reference`
  - `🔎 Search the diagram — jump to any node fast`
  - `🔗 Nodes & links carry real code references`
  - `📂 Click a reference → open the exact file & line`
  - `🧵 Diagram and codebase stay connected`
- **VOICEOVER:** *"Feature three — search and code references. Search to find any node in a big diagram instantly. And because nodes and links map to real code, one click jumps you straight to the exact file and line."*
- **NOTES:** This is the "it's wired to your real repo" moment — make the file open land clearly.

---

### Scene 9 — 🎥 Demo · Search + code reference · `1:02–1:08`
- **VISUAL:** Real recording in the VS Code frame.
- **ON-SCREEN TEXT:** `search → jump to code 🤯` / caption `A node or link opens the exact source file & line`
- **VOICEOVER:** *"Search it, then jump straight to the code."*
- **🎬 RECORD → `clip-search.mp4`:** search/highlight a node → right-click a node or link → open its code reference → source file opens at the line. ~6–10 s.

---

### Scene 10 — Feature 4 · Diagram types (animated) · `1:08–1:16`
- **VISUAL:** Left: `4 · Diagram types` + bullets. Right: the canvas morphs through a quick carousel — flowchart → dependency → state machine → UML class → ER.
- **ON-SCREEN TEXT:**
  - Heading: `4 · Diagram types`
  - `🧩 Not just node graphs`
  - `🌊 Flowcharts · 🧱 dependency · 🔄 state machines`
  - `🏛️ UML class · 🗂️ entity-relationship`
  - `🪄 Ask for a type, or let Copilot auto-detect`
- **VOICEOVER:** *"Feature four — diagram types. It's not just node graphs. Flowcharts, dependency graphs, state machines, UML class and ER diagrams — ask for the type you want, or let Copilot pick the right one."*

---

### Scene 11 — 🎥 Demo · Diagram types · `1:16–1:22`
- **VISUAL:** Real recording in the VS Code frame.
- **ON-SCREEN TEXT:** `one canvas, many diagrams 🎛️` / caption `Flowcharts, state machines, ER — on demand`
- **VOICEOVER:** *"The right diagram for the right question."*
- **🎬 RECORD → `clip-types.mp4`:** ask for a flowchart, then a state machine (or dependency graph) → each renders on the canvas. ~6–10 s.

---

### Scene 12 — How to download · `1:22–1:34`
- **VISUAL:** Clean "install" slide. VS Code Marketplace card mock + a terminal showing the MCP config / command. Numbered steps animate in.
- **ON-SCREEN TEXT:**
  - Heading: `Get it in 3 steps 🚀`
  - `1️⃣ Install the "Canvas for Copilot" VS Code extension`
  - `2️⃣ Add the Canvas MCP server to your Copilot CLI config`
  - `3️⃣ Run Copilot CLI in VS Code's terminal → ask for a diagram`
  - Footer: `Runs 100% locally · single VS Code window`
- **VOICEOVER:** *"Getting started is easy. Install the VS Code extension, add the Canvas MCP server to your Copilot config, then run Copilot in VS Code's terminal and ask for a diagram. It all runs locally."*
- **NOTES:** ✅ Confirm exact install steps / marketplace name before final render. Optional: replace the mock with a short real install clip.

---

### Scene 13 — Future work · `1:34–1:44`
- **VISUAL:** Three forward-looking "roadmap" cards slide in, each with an icon.
- **ON-SCREEN TEXT:**
  - Heading: `What's next 🔮`
  - `💾 Persistence — save & version your diagrams`
  - `🧩 Even more types — sequence diagrams & timelines`
  - `☁️ Cloud — shared canvases & team collaboration`
- **VOICEOVER:** *"And we're just getting started. Next up: saving and versioning diagrams, even more diagram types like sequence diagrams, and a cloud version for sharing canvases across a team."*
- **NOTES:** Maps to the brief's current "out of scope" list — honest framing as roadmap.

---

### Scene 14 — Outro · Team + CTA · `1:44–1:54`
> Team belongs HERE (credits), not at the open.
- **VISUAL:** Celebration emojis. Two-line kinetic payoff, then a row of **5 circular avatar slots** (equal size, evenly spaced) that pop in one by one, each with a name label beneath. Then the brand pill.
- **ON-SCREEN TEXT:**
  - `SEE your code.`
  - `don't just read it.`
  - Pill: `Canvas for Copilot 💜`
  - `built by 5 SWE interns · 2 Redmond · 2 Dublin · 1 India`
  - **5 avatar circles** with labels: `Ashley Torres Perez` · `Guillermo Franco Gimeno` · `Hadwik Payidiparthy` · `Nataliia Kulieshova` · `Oleksii Babii`
  - `a visual reasoning channel for Copilot CLI · hackathon 2026`
  - Credit: `Music: "Evolution" by Bensound.com`
- **VOICEOVER:** *"Built by five software-engineering interns — across Redmond, Dublin, and India. Canvas for Copilot — see your code, don't just read it."*
- **NOTES:** 5 equal circular avatars in a single row: Ashley Torres Perez, Guillermo Franco Gimeno, Hadwik Payidiparthy, Nataliia Kulieshova, Oleksii Babii. Drop each member's photo into `public/avatars/` (e.g. `avatar-1.png`…`avatar-5.png`); falls back to initials if no photo.

---

## 4. Full voiceover (clean read-through)

> ~110–120 s at a relaxed, energetic pace. ≈ 260 words.

1. Day one as an intern. Here's a massive codebase you've never seen — and a few weeks to understand it and ship something real.
2. Copilot CLI can explain it — but everything comes back as text. And reading paragraph after paragraph is a painfully slow way to see how a whole system actually fits together.
3. So we built **Canvas for Copilot**. It turns those text explanations into a live, interactive diagram — right inside a VS Code tab. Suddenly, you can *see* the system.
4. Feature one — **visualize and explain**. Ask Copilot to diagram a flow, and the canvas opens right in VS Code. Pan, zoom, then click any node and ask Copilot to explain it — an instant breakdown, no scrolling. *(Here it is for real.)*
5. Feature two — **expand and undo**. Expand any node and the diagram grows new detail in place; one undo steps you right back, so you can explore fearlessly. *(Expand, undo, repeat.)*
6. Feature three — **search and code references**. Search to find any node instantly, and because nodes and links map to real code, one click jumps straight to the exact file and line. *(Diagram, meet codebase.)*
7. Feature four — **diagram types**. Not just node graphs — flowcharts, dependency graphs, state machines, UML and ER — ask for the type you want, or let Copilot pick. *(The right diagram, every time.)*
8. Getting started is easy: install the VS Code extension, add the Canvas MCP server to your Copilot config, and ask for a diagram — all running locally.
9. And we're just getting started — persistence, even more diagram types, and a cloud version are next.
10. Built by five software-engineering interns, across Redmond, Dublin, and India. **Canvas for Copilot** — see your code, don't just read it.

---

## 5. Product facts (keep claims accurate)

From `docs/PROJECT_BRIEF.md` + `docs/REQUIREMENTS.md`:

- Runs **locally**; Copilot CLI in **VS Code's integrated terminal** is the brain.
- A **thin VS Code extension** opens the canvas as a **webview tab** and bridges it to the CLI session over the **MCP Apps** `postMessage` channel.
- Diagrams are interactive **Cytoscape** graphs (pan, zoom, node selection).
- The novelty is the **bidirectional loop**, delivered in 3 tiers: **Visualize → Interact → Modify**.
- **Future work** (currently out of scope, honest as roadmap): persistence/versioning, non-graph formats (sequence/ER), cloud hosting + multi-user collaboration.
- ❗ Don't over-claim: today it's a **local, single-session, VS Code-first** dev tool.

---

## 6. Production checklist

- [ ] ~~Fill in real team names~~ ✅ done (Ashley, Guillermo, Hadwik, Nataliia, Oleksii)
- [ ] Add 5 avatar photos to `public/avatars/` (`avatar-1.png`…`avatar-5.png`)
- [ ] Confirm **exact install steps + marketplace name** (Scene 10)
- [ ] Record `clip-visualize.mp4`, `clip-expand.mp4`, `clip-search.mp4`, `clip-types.mp4` → `public/clips/`
- [ ] (Optional) record an install clip for Scene 10
- [ ] Set `CLIP_SOURCES` in `src/CanvasForCopilot.tsx`
- [ ] (Optional) record voiceover; add as `<Audio>`, drop music to ~25–30%
- [ ] Confirm Bensound credit / license code
- [ ] Build the new scenes in Remotion: **Cold-open hook**, **How to download**, **Future work**, **Team outro**
- [ ] Render: `npx remotion render CanvasForCopilotFull out/canvas-full.mp4`

---

## 7. Open questions / decisions

- Hook visual: file-tree avalanche, or a fast montage of confusing code? (Both test well — avalanche is simpler to build.)
- Team in outro: avatars/photos, or just names + locations?
- Voiceover: human, AI TTS, or text-only?
- Target length: ~90 s current; up to **4 min** allowed — how much to expand? (see §8)
- Install scene: animated mock, or a real screen recording?

---

## 8. Optional expansion modules (to use the 4-min allowance)

The current draft is a tight **~90 s**. You have up to **4 min**, so here are
drop-in modules you can add. **Recommendation: aim for ~2–2.5 min** — long enough
to show real depth, short enough to keep judges engaged. Don't pad to 4 min just
because you can.

| Module | Where | +Time | Why add it |
|--------|-------|-------|------------|
| **A. Real onboarding story** | after Scene 2 | +20 s | An intern voice: "my first repo had 800 files…" — makes the pain concrete & human |
| **B. How it works (architecture)** | after Scene 3 | +25 s | Show the loop: Copilot CLI ⇄ MCP server ⇄ VS Code webview (Cytoscape). Judges reward technical depth |
| **C. The bidirectional loop, explained** | after Feature 3 | +20 s | The real novelty — animate canvas→CLI and CLI→canvas arrows; the "second surface" idea |
| **D. Longer end-to-end demo** | replace one clip | +20–40 s | One uncut "wow" flow: ask → diagram → click → expand → modify → code changes, in a single take |
| **E. Before / after split-screen** | after Scene 2 | +15 s | Wall of text on the left, live diagram on the right — instant contrast |
| **F. Who it's for / use cases** | before Future work | +15 s | Onboarding, architecture reviews, navigating unfamiliar code |

**Suggested ~2.5 min cut:** base script **+ B (architecture) + C (the loop) + D (one
longer real demo)**. That keeps the strong hook, adds the technical credibility
judges look for, and lets one demo really breathe.

> Tell me which modules you want and I'll write them out as full scenes (visual /
> on-screen text / VO) and slot them into the timeline.
