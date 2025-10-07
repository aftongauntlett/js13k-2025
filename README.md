# ✨ Nyx Felis and Lampyris 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![js13k](https://img.shields.io/badge/js13k-2025-orange.svg)](https://js13kgames.com/)
[![Submission](https://img.shields.io/badge/submission-12.5KB-brightgreen.svg)](#)
[![Enhanced](https://img.shields.io/badge/enhanced-22KB-blue.svg)](#)

> *Guide fireflies through the eternal night, master shield timing to evolve them, and keep Nyx Felis curious in this fast-paced 3-minute survival challenge*

**[Play the original submission (12.5KB) →](https://js13kgames.com/2025/games/nyx-felis-and-lampyris)**

**[Play the enhanced version (22KB) →](https://nyx-felis.aftongauntlett.com/)**

## About

You are **Lampyris**, a guide of fireflies in the eternal night. Collect and deliver fireflies to **Nyx Felis** (the great cat) to maintain her curiosity. Survive for 3 minutes to win!

**Core Loop**: Summon → Collect → Shield → Evolve → Deliver → Repeat

## Quick Start

### Controls
- **Mouse**: Move and collect fireflies
- **Click/Space**: Tap to summon, hold to shield
- **Right-Click/X**: Drop fireflies strategically
- **ESC/M/L**: Help, audio, leaderboard

### Win Condition
Stay alive for 3 minutes by delivering fireflies before the curiosity timer expires (15s deadline).

## Key Features

### Firefly Evolution Chain
Green (5pts) → Purple (15pts) → Gold (25pts) → Rainbow (40pts)

Shield with perfect timing during Nyx's attacks to evolve fireflies into higher tiers.

### Shield Timing System
Watch for **3 warning flashes** before each attack:
- **Perfect** (3rd flash): 100% evolution + protection
- **Great** (2nd flash): 75% evolution + protection  
- **Good** (1st flash): 50% evolution + protection
- **No shield**: Fireflies flee, streak resets

### Advanced Strategy
Drop evolved fireflies → recollect → shield again → reach rainbow tier faster!

## Technical Details

- **Engine**: Vanilla JavaScript + Canvas 2D
- **Features**: Particle systems, procedural audio, dynamic gradients
- **Performance**: 60fps with hundreds of particles
- **Original Submission**: 12.5KB (js13k 2025)
- **Enhanced Version**: 22KB (post-jam improvements)

## Development

```bash
npm install  # Install dependencies
npm start    # Development server
npm run build # Production build
```

### Testing Firebase Leaderboard

The game uses Firebase Firestore for cross-player leaderboards. To test the connection:

1. Start the dev server: `npm start`
2. Open: http://localhost:8000/firebase-test.html
3. Click "Run All Tests" to verify Firebase is working

See `FIREBASE_TEST_README.md` for detailed testing instructions.

## Repository Structure

This repository tracks the evolution of the game:

- **`submission-2025` tag**: Original 12.5KB competition entry
- **`main` branch**: Enhanced version (22KB) with improved audio, visuals, and tutorial system
- **Post-Mortem**: [Read about the development journey →](https://www.aftongauntlett.com/blog/js13k-2025-post-mortem)

## License

MIT License - Built with ✨ by [Afton Gauntlett](https://github.com/aftongauntlett)