# Nyx & Lampy: Game Mechanics Developer Diary

## Overview
I've been working on this JS13K game entry that combines resource management, timing mechanics, and risk/reward systems. The core loop revolves around balancing mana (bioluminescence), evolving fireflies for maximum points, and managing Nyx's curiosity to survive as long as possible.

## Core Characters & Concepts

### Nyx Felis (The Cat)
Nyx is our central character - a mystical cat whose eyes shift colors in predictable patterns. She has a curiosity meter that decreases over time, and when it hits zero, it's game over. The only way to restore her curiosity is by feeding her fireflies, but this costs the player their collected fireflies and the potential points they represent.

### Lampyris (The Player Firefly)
The player controls Lampy, a firefly that can summon other fireflies, create protective shields, and deliver groups of fireflies to Nyx. Lampy's core resource is bioluminescence (mana), which powers most abilities.

## The Bioluminescence (Mana) System

This is the heart of the game's resource management. I designed it to create constant tension between offense and defense:

- **Starting Mana**: 100 points (full bar)
- **Mana Costs**:
  - Summoning a firefly: 5 mana (can summon 20 fireflies from full mana)
  - Using shield: 1 mana per use
- **Mana Recovery**: Gained by delivering fireflies to Nyx
  - All fireflies: 5 mana each (regardless of evolution tier)
  - This matches the summoning cost, creating a 1:1 mana economy

The key insight here is that players want to evolve all their fireflies for maximum mana recovery, but the curiosity pressure forces them to sometimes deliver base fireflies just to keep Nyx happy.

## Firefly Evolution & Color System

### Green Fireflies (Base Tier)
- **Points**: 5 points each when delivered
- **Mana Recovery**: 5 mana each (matches summoning cost)
- **Risk**: Minimal (survive most shield timings)

### Evolved Fireflies
Fireflies evolve when they survive Nyx's eye color shifts while protected by the shield. Each evolution increases their value:

- **Purple Fireflies**: 15 points, 5 mana recovery (3x green points)
- **Gold Fireflies**: 25 points, 5 mana recovery (5x green points)  
- **Rainbow Fireflies**: 40 points, 5 mana recovery (8x green points)

**Important**: All fireflies provide the same mana recovery (5 mana each), but evolved fireflies give significantly more points.

The evolution system creates exponential rewards, but the risk scales too - evolved fireflies are lost permanently if caught unshielded during an eye flash.

## Shield Mechanics & Timing System

The shield is where skill expression really shines. I implemented a timing-based system with four precision levels:

### Shield Timing Windows
- **Perfect** (±5 frames): No mana cost, +10 bonus points per evolved firefly
- **Great** (±10 frames): Half mana cost, +5 bonus points per evolved firefly  
- **Good** (±15 frames): Normal mana cost, no bonus
- **Miss** (outside window): Double mana cost, evolved fireflies take damage

### Shield Positioning
The shield has inside/outside mechanics:
- **Inside Shield**: Fireflies are protected and can evolve
- **Outside Shield**: Fireflies are vulnerable and will be lost if caught during an eye flash

## Eye Flash Pattern & Unified Timing

Nyx's eye flashes follow a predictable pattern every 4 seconds (240 frames):
- Flash warning at frame 60
- Flash buildup at frame 120  
- Actual flash at frame 180
- Reset at frame 240

This timing synchronizes with:
- Screen flash effects
- Player glow intensity
- Audio cues
- Cat eye color changes

## Scoring & Streak System

### Base Scoring
Points are awarded when fireflies are delivered to Nyx:
- Base fireflies: 10 points each
- Evolved fireflies: Exponential scaling (20, 40, 80, 160)
- Perfect shield timing: +10 bonus per evolved firefly
- Great shield timing: +5 bonus per evolved firefly

### Streak Multiplier
Consecutive deliveries without losing fireflies build a streak multiplier:
- Streak 1-4: 1x multiplier
- Streak 5-9: 1.5x multiplier  
- Streak 10-14: 2x multiplier
- Streak 15+: 2.5x multiplier

The streak resets to 0 whenever fireflies are lost to an unshielded eye flash.

### Visual Feedback
I added a rainbow star twinkle effect during deliveries to make the scoring moment feel more rewarding and help players understand when points are being awarded.

## Curiosity System

Nyx's curiosity is the game's timer mechanism:
- **Tutorial Mode**: 60 seconds to experiment and learn
- **Normal Mode**: 15 seconds of constant pressure
- **Decay Rate**: Decreases continuously during gameplay
- **Recovery**: Only by delivering fireflies to Nyx
- **Game Over**: When curiosity reaches zero

This creates the core tension - players must balance evolving fireflies for maximum points against feeding Nyx to survive.

## Tutorial Integration

The tutorial system is task-based rather than time-based, walking players through:
1. Basic movement and firefly summoning
2. Shield timing and protection
3. Firefly evolution mechanics  
4. Delivery and scoring
5. Mana management
6. Curiosity pressure

Key tutorial features:
- Protected environment (evolved fireflies don't die)
- Extended curiosity timer (60s vs 15s)
- Game timer doesn't start until tutorial completion
- Progressive complexity introduction

## Infinite Mode

For players who want to experiment without pressure:
- No timer or curiosity decay
- No mana costs
- No scoring system
- Pure sandbox firefly collection

## AI-Assisted Development Notes

I used AI assistance heavily for:
- Balancing the exponential firefly evolution values
- Implementing the unified timing system
- Debugging the streak multiplier calculation
- Refining the tutorial progression
- Optimizing the mana cost/recovery ratios

The AI helped me identify edge cases I missed, like the 0-point delivery bug and the need for audio feedback on insufficient mana actions.

## Technical Implementation Notes

### Performance Optimizations
- Removed complex firefly breathing animations for evolved fireflies (better visibility, less CPU)
- Simplified spawning system with direct placement vs animated emergence
- Consolidated flash effects into unified system

### Player Feedback Systems
- Audio cues for all major actions (summon, shield, evolve, deliver)
- Visual feedback for mana states, shield timing, evolution status
- Warning systems for firefly limits and low mana

### Development Cleanup
- Removed debug keybindings (number keys for testing)
- Eliminated console.log statements
- Standardized timing constants across all systems

## Balance Philosophy

The game is designed around meaningful choices under pressure:
- **Risk vs Reward**: Evolving fireflies vs immediate safety
- **Resource Management**: Spending mana wisely across summons and shields  
- **Timing Skill**: Perfect shields for maximum efficiency
- **Strategic Depth**: When to deliver vs when to evolve further

Every mechanic reinforces this core loop while providing multiple skill expression opportunities for different player types.