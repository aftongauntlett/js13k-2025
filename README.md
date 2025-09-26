# ✨ Nyx Felis and Lampyris ✨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![js13k](https://img.shields.io/badge/js13k-2025-orange.svg)](https://js13kgames.com/)
[![Size](https://img.shields.io/badge/size-<13KB-brightgreen.svg)](#)
[![Commits](https://img.shields.io/github/commit-activity/t/aftongauntlett/js13k-2025?style=flat&logo=git&logoColor=white&label=commits&color=blue)](https://github.com/aftongauntlett/js13k-2025/commits)

## Game Overview

You are **Lampyris**, a mystical guide of fireflies in the eternal night. Your mission: collect fireflies and deliver them to **Nyx Felis** (the great cat) to maintain her curiosity about the night world.

### How to Play
This is an **addictive clicker game** with a 3-minute survival challenge:

1. **Click rapidly** to summon fireflies (costs mana)
2. **Move to collect** them around your character  
3. **Watch the delivery pressure timer** - green bar at bottom shows time until curiosity decay
4. **Deliver to Nyx** before the timer turns red (15 second deadline)
5. **Shield timing** - when her eyes flash, activate shield to protect fireflies
6. **Build delivery streaks** - consecutive deliveries multiply your score, but streaks break on failure!

### Firefly Evolution & Scoring
- **Green**: 5 points, slow (safe base tier)
- **Purple**: 15 points, faster (evolved once)
- **Gold**: 25 points, fast (evolved twice)
- **Rainbow**: 40 points, very fast (maximum evolution, high risk/reward)

**Victory**: Curiosity above -50 for 3 minutes + 1000 completion bonus + (streak × 50)

## Controls

- **Mouse Movement**: Guide Lampyris and collect fireflies
- **Click/Spacebar (Rapid)**: Summon fireflies - click rapidly for more! (costs bioluminescence/mana)
- **Hold (Click/Spacebar)**: Activate protective shield (costs bioluminescence/mana)
- **Right-Click/X Key**: Drop captured fireflies with temporary immunity (strategic for evolved fireflies)
- **ESC**: Show/hide help menu
- **M**: Toggle audio on/off

## Key Mechanics

- **Delivery Pressure Timer**: Visual countdown shows exactly when curiosity decays (every 15 seconds)
  - Green: Safe zone (10+ seconds remaining)
  - Yellow: Warning zone (5-10 seconds) 
  - Red: Critical zone (<5 seconds)
- **Streak System**: Consecutive deliveries build score multipliers up to 300% - but fail once and lose it all!
- **Curiosity System**: Nyx's interest decays without deliveries. Reach -50 = game over  
- **Perfect Timing**: White flash = shield protects ALL fireflies, good timing saves most
- **Strategic Risk/Reward**: Wait for more fireflies vs deliver safely before deadline
- **Bioluminescence (Mana) Management**: Summoning costs energy, only overheats when completely empty
- **Dynamic Difficulty**: Nyx's gaze shifts become quicker over time

## Technical Details

- **Engine**: Vanilla JavaScript with Canvas 2D
- **Size**: Optimized for js13k competition (<13KB zipped)
- **Performance**: 60fps gameplay with efficient rendering
- **Audio**: Dynamic sound effects and ambient background music

## Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

## Repository Information

This repository contains both the original JS13k 2025 competition submission and ongoing improvements:

- **Original Submission**: Tagged as `submission-2025` - the exact code submitted to the JS13k competition
- **Ongoing Development**: The `main` branch contains post-jam improvements, fixes, and new features
- **Competition Entry**: This was an official entry in the [js13k Games 2025 Competition](https://js13kgames.com/)

## Post-Mortem

For detailed insights into the development process, challenges faced, and lessons learned during the JS13k 2025 competition, read the full post-mortem:

**[🔗 JS13k 2025 Post-Mortem](https://aftongauntlett.com/js13k-2025-post-mortem)**

## License

MIT License - see [LICENSE](LICENSE) for details.

---

*Entry for js13k Games 2025 Competition - Built with ✨ by [Afton Gauntlett](https://github.com/aftongauntlett)*