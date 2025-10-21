# Nyx Felis & Lampyris

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![js13k](https://img.shields.io/badge/js13k-2025-orange.svg)](https://js13kgames.com/)
[![Submission](https://img.shields.io/badge/submission-12.5KB-brightgreen.svg)](#)
[![Enhanced](https://img.shields.io/badge/enhanced-22KB-blue.svg)](#)

> A timing-based firefly collector built in vanilla JavaScript for JS13k 2025. Guide fireflies, master shield timing, and keep Nyx Felis curious long enough to survive the night.

**Tech Stack**: Vanilla JS • Canvas 2D • Web Audio API • Roadroller • Firebase

**[Play Enhanced Version →](https://nyx-felis.aftongauntlett.com/)** | **[Post-Mortem →](https://www.aftongauntlett.com/blog/js13k-2025-post-mortem)**

*See also: [Orbital Order](https://github.com/aftongauntlett/orbital-order) for my other JS13K entry.*

---

## Table of Contents

- [Motivation](#motivation)
- [Game Overview](#game-overview)
- [Technical Architecture & Implementation](#technical-architecture--implementation)
- [Compression & Optimization](#compression--optimization)
- [Accessibility & UX Considerations](#accessibility--ux-considerations)
- [Build & Deployment](#build--deployment)
- [Challenges & Lessons Learned](#challenges--lessons-learned)
- [Repository Notes](#repository-notes)
- [Next Steps](#next-steps)
- [License](#license)

---

## Motivation

**Why I built this**: JS13k's strict size constraints force decisions and keep scope tight, making it possible to actually ship a game.

I wanted to build a small game and finish it. The theme was **Black Cats**, which made me happy because I love cats. Fireflies were already on my mind from evening walks, so the pairing came naturally. The goal was calm, cozy, a little mysterious. And particles... lots of particles.

The game shifted from a "cozy screensaver" to something with structure and timing when I added the curiosity bar and shield mechanic. Constraints forced choices and kept ideas from sprawling.

---

## Game Overview

**Gameplay**: Timing-based collector where you guide fireflies, evolve them with well-timed shields, and deliver them to keep Nyx Felis curious for 3 minutes. Core loop: Summon → Collect → Shield → Evolve → Deliver. Evolution chain progresses through four tiers (Green → Purple → Gold → Rainbow), with perfect shield timing on the third warning flash granting 100% evolution and protection.

---

## Technical Architecture & Implementation

**Summary**: Vanilla JavaScript organized into modular systems for rendering, audio, timing, and game state management—all compressed to 12.5KB.

### Stack & Tooling

- **Engine**: Vanilla JavaScript (ES6+), no frameworks
- **Rendering**: Canvas 2D with composite operations for glow effects
- **Audio**: Web Audio API (procedural, no external files)
- **Build Pipeline**: Terser → Roadroller → inline script → ZIP
- **Deployment**: Vercel (enhanced version), static hosting (competition build)
- **Backend**: Firebase Firestore (leaderboard, post-jam addition)

### Project Structure

```
js13k-2025/
├── main.js              # Core game logic
├── index.html           # Minimal HTML shell
├── build/
│   └── inline.js        # Build script: inlines JS into HTML
├── dist/                # Build output directory
├── package.json         # Dependencies & build scripts
├── vercel.json          # Deployment config
└── firebase-test.html   # Leaderboard integration tests
```

### Key Modules & Systems

**`main.js`** is organized into logical sections:

- **Constants & Configuration**: Game balance constants (`CFG` object), font system, math shortcuts
- **Utility Functions**: Canvas state caching, distance calculations, game state helpers
- **Audio System**: Web Audio initialization, procedural tone generation, layered background music, shield chimes, victory/defeat melodies
- **Game State Variables**: Mouse tracking, player state, firefly arrays, particle pools, shield cooldowns, cat eye timers
- **Firefly Management**: Spawning, movement, collection, evolution logic, reversion on failed shields
- **Particle System**: Lightweight particle rendering for trails, explosions, glow effects
- **Shield Timing Mechanics**: Three-phase warning system with frame-based flash detection
- **Cat Rendering**: Procedural cat face with reactive eyes, whiskers, and proximity-based animations
- **Tutorial System**: Task-based tutorial with progressive unlocks
- **Rendering Pipeline**: Layered gradients, composite operations (`lighter`, `screen`), shadow blur for glow

### Core Technical Decisions

**Canvas 2D over WebGL**: Gradients and composite operations create glow effects without shaders. Performance stayed at ~60fps with hundreds of particles on screen.

**Procedural Audio**: All sounds generated with Web Audio oscillators, filters, and envelopes. No audio files = more space for code.

**Frame-Based Timing**: Game loop uses `requestAnimationFrame`. Shield timing relies on frame counters for predictable, repeatable windows.

**State Caching**: Canvas properties (`fillStyle`, `strokeStyle`, `lineWidth`) cached to minimize redundant API calls during particle rendering.

**Build Compression**: Roadroller (JS packer) reduced minified JS by ~40%. Final competition build: **12.5KB zipped**.

---

## Compression & Optimization

**Summary**: Four-stage build pipeline (Terser → Roadroller → inline → ZIP) compressed 6,792 lines of JavaScript to 12.5KB while maintaining 60fps performance.

### Build Process

```bash
npm run build  # Full pipeline: minify → roadroller → inline → zip
```

**Steps**: Terser minifies → Roadroller packs with context modeling → inline script embeds JS into HTML → ZIP creates final bundle.

### Size Breakdown

| Build | Size | Notes |
|-------|------|-------|
| **Competition Build** | 12.5KB | Original submission (missed deadline) |
| **Enhanced Build** | 22KB | Post-jam: enhanced audio, Firebase leaderboard, refined tutorial |

### Optimization Techniques

- **Variable Aliasing**: `Math.sin` → `sin`, `Math.floor` → `F`, `Math.random` → `r`
- **Canvas State Caching**: Avoid redundant style changes during particle loops
- **Particle Pooling**: Reuse particle objects where beneficial
- **Composite Operations**: `globalCompositeOperation = 'lighter'` for additive glow without alpha blending overhead
- **Selective Font Loading**: Two Google Fonts within size budget

---

## Accessibility & UX Considerations

**Summary**: Three-flash warning system, color-coded evolution tiers, and task-based tutorial prioritize clarity and readability for timing-critical gameplay.

### Visual Clarity

- **Three-Flash Warning System**: Third flash signals optimal shield moment
- **Color-Coded Evolution**: Green → Purple → Gold → Rainbow with distinct glows
- **High-Contrast UI**: White text on dark gradients with shadow blur
- **Responsive Feedback**: Score popups, shield outlines, particle bursts confirm actions

### Interaction Design

- **Mouse-Only Controls**: Movement and clicks; right-click drops fireflies for recollection
- **Keyboard Shortcuts**: Space (shield), X (drop), Esc (help), M (audio), L (leaderboard)
- **Cat Reactivity**: Eyes, whiskers, and nose react to mouse proximity
- **Tutorial Flow**: Task-based tutorial introduces mechanics sequentially

### Performance Targets

- **60fps on Modern Hardware**: Maintained with hundreds of particles
- **Canvas Fallback**: No WebGL dependency, works on older browsers
- **Mobile Detection**: Detects touch devices but targets desktop experience

---

## Build & Deployment

**Summary**: Python dev server for local testing, npm scripts for production builds, Vercel deployment for enhanced version with Firebase leaderboard.

### Local Development

```bash
npm install  # Install dependencies
npm start    # Start Python 3 dev server
# Open: http://localhost:8000
```

### Production Build

```bash
npm run build  # Full pipeline
npm run size   # Check against 13,312 byte limit
```

### Deployment

- **Competition Build**: Hosted on js13kgames.com (single `index.html`)
- **Enhanced Build**: Vercel deployment at [nyx-felis.aftongauntlett.com](https://nyx-felis.aftongauntlett.com/)

### Testing Firebase Leaderboard

```bash
npm start
# Open: http://localhost:8000/firebase-test.html
```

See `FIREBASE_TEST_README.md` for detailed setup instructions.

---

## Challenges & Lessons Learned

**Summary**: Constraints forced ruthless prioritization. Small UX fixes (timing clarity, visual cues) improved feel more than new features. Shipped despite missed deadline.

### Key Takeaways

**Timing Clarity**: Changed shield cues so third flash signals action moment. Some players initially confused warning flashes with attacks.

**Canvas Tricks**: `globalCompositeOperation = 'lighter'` + layered gradients + shadow blur created WebGL-like glow. Several people thought it was shader-based.

**Constraints Ship Games**: 13KB limit forced cuts. Features that didn't serve core loop were eliminated. This kept scope manageable.

**UX > Features**: Clarifying shield timing improved gameplay more than adding mechanics.

**Tutorial as Unlock**: Task-based tutorial (summon → collect → shield) reduced friction. Learn by doing, not reading.

**Missed Deadline**: Mixed up CST and CT. Finished enhanced version anyway. Learned to keep scope tight and move on.

**AI Partnership**: GitHub Copilot helped with repetitive logic. ChatGPT filled audio/math gaps. Still had to steer, clean up, and validate.

*For detailed technical reflections, see [Post-Mortem Blog →](https://www.aftongauntlett.com/blog/js13k-2025-post-mortem)*

---

## Repository Notes

- **`main` branch**: Enhanced version (22KB) with refined audio, Firebase leaderboard, improved tutorial
- **`submission-2025` tag**: Original 12.5KB competition entry (if tagged)
- **Post-Mortem Blog**: Full reflection at [aftongauntlett.com/blog/js13k-2025-post-mortem](https://www.aftongauntlett.com/blog/js13k-2025-post-mortem)

---

## Next Steps

- Try Unity for future game projects
- Potentially rebuild one of these JS13K concepts
- Explore the lightning idea that sparked this journey
- Stars and sparkles will probably show up

---

## License

MIT License - Built by [Afton Gauntlett](https://github.com/aftongauntlett)