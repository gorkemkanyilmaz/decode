# DECODED: 3D Number Hunt

> **A high-stakes 3D multiplayer stealth party game built with Three.js, TypeScript, and WebSockets.**
>
> *Read the opponent's forehead cipher before they read yours. Conceal your number. Move between cover. Decode to eliminate.*

---

## 🎮 Game Concept

Every agent enters the arena with a **4-digit secret number** mounted on their forehead.
To eliminate an opponent, you must:
1. **Locate** the target in the 3D arena.
2. **Angle** yourself so their forehead is facing your line of sight.
3. **Remember** their four digits.
4. **Open** the spy cipher keypad (`[E]` or touch button).
5. **Type & Confirm** the number to trigger an elimination!

**Cover matters:** Standing behind low crates exposes your forehead unless you crouch. Turning around hides your number from opponents pursuing you.

---

## ⚡ Key Features

- **Authoritative Multiplayer Server**: Built on Node.js and WebSockets with room codes (e.g. `X7K9P`), supporting 2–20 players per match.
- **Anti-Cheat Line-of-Sight Streaming**: Opponents' numbers are *never* transmitted in WebSocket packets unless server raycasting confirms unobstructed line-of-sight and facing orientation.
- **Original Stylized Low-Poly 3D Art**: Modular environment props (crates, shipping containers, concrete barriers, security bunkers, stylized trees, and monuments) with zero external asset dependencies.
- **Mobile-First & Desktop Controls**:
  - Desktop: First-person camera, WASD, PointerLock mouse look, Shift sprint, C crouch, E keypad.
  - Mobile: Dual virtual touch joysticks (move & look), large action buttons, and responsive on-screen keypad.
- **Procedural Web Audio API Sound System**: Footsteps, keypad tones, elimination fanfare, error buzzers, and gadget sound effects synthesized in pure code (no missing audio assets).
- **Tactical Gadgets**:
  - 💨 **Smoke Grenade**: Creates dense volumetric smoke obscuring vision and blocking raycasts.
  - ⚡ **Flashbang**: Disorients opponents in front of the blast.
  - 📸 **Spy Camera**: Snaps an opponent's forehead in sight to display a temporary 5-second polaroid card.
  - 🔭 **Binoculars**: 3x optical zoom extending reading range up to $60\text{m}$.
- **Game Modes**:
  - **Deathmatch**: Free-for-all; eliminated agents respawn and select a new secret cipher.
  - **Team Hunt**: Red vs Blue squad action with friendly-fire protection.
  - **Last Standing**: Limited lives; elimination tournament.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (tested on Node.js 24)
- npm 9+

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Game (Server + Client)
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser!

### 3. Run Automated Tests
```bash
npm test
```
Runs the full unit test suite and the automated 2-player Section 64 acceptance test.

---

## 🏗️ Project Structure

```
├── client/                     # Frontend Three.js Web Application
│   ├── index.html              # Mobile viewport & UI roots
│   └── src/
│       ├── audio/              # Procedural Web Audio API sound synthesizer
│       ├── camera/             # FPS camera controller, head bobbing, zoom
│       ├── game/               # Master game loop & state machine
│       ├── input/              # Desktop keyboard/mouse & mobile dual joysticks
│       ├── network/            # WebSocket client connection & message routing
│       ├── player/             # Character model, animated limbs, forehead badge
│       ├── ui/                 # Glassmorphic UI, menu, lobby, HUD, keypad
│       └── world/              # Procedural props, lighting, fog, particle effects
├── server/                     # Authoritative Node.js Multiplayer Server
│   └── src/
│       ├── index.ts            # Server entry point (HTTP & WebSocket)
│       ├── network/            # WebSocket message dispatcher & connection handling
│       ├── players/            # ServerPlayer model & authoritative state
│       └── rooms/              # Room manager, state transitions, raycast LOS
├── shared/                     # Shared TypeScript Code (Client & Server)
│   ├── constants/              # Game constants & 100m x 100m map layout definitions
│   ├── protocol/               # Strict client-server network message schemas
│   ├── types/                  # Game state, snapshot, and customization types
│   └── utils/                  # 3D math, AABB ray-box intersection, facing angles
└── test/                       # Comprehensive Test Suite
    ├── gameRules.test.ts       # Raycast, facing dot-product, & number validation
    ├── roomAndMultiplayer.test.ts # Room codes, host assignment, elimination rules
    └── e2eMultiplayerScenario.test.ts # Section 64 live acceptance test
```

---

## 📜 License
MIT License — Created for Multiplayer 3D Number Hunt.
