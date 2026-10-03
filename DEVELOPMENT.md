# DECODED: 3D Number Hunt — Technical Development & Architecture Guide

## 1. System Architecture

**DECODED** is a high-performance, mobile-first 3D multiplayer stealth party game built using **Three.js**, **TypeScript**, and **WebSockets**. The core design philosophy centers around observation, memory, line-of-sight concealment, and deduction rather than conventional weapon shooting.

```
┌────────────────────────────────────────────────────────┐
│                   BROWSER CLIENT                       │
│  Three.js WebGL Renderer (60 FPS)                      │
│  First-Person Camera Controller + Bobbing + Zoom       │
│  Procedural Character Models + Forehead Badges         │
│  Input Manager (WASD / Mouse Lock / Touch Joysticks)   │
│  Procedural Web Audio API Sound Synthesizer            │
│  Responsive Glassmorphic UI (Menu / HUD / Keypad)      │
└───────────────────────────▲────────────────────────────┘
                            │
               WebSocket Protocol (JSON)
          Snapshot Streaming (20 Hz Tick Rate)
                            │
┌───────────────────────────▼────────────────────────────┐
│               AUTHORITATIVE GAME SERVER                │
│  Node.js + WebSockets ('ws')                           │
│  Room Manager (2-20 players, 5-char room codes)        │
│  State Machine (LOBBY, CHOOSE_NUM, PLAYING, ROUND_END) │
│  Raycast Line-of-Sight Occlusion against AABB Map      │
│  Forehead Facing Angle Dot-Product Validation          │
│  Secure Censored Forehead Digit Streaming              │
│  Server-Authoritative Elimination & Cooldowns          │
└────────────────────────────────────────────────────────┘
```

---

## 2. Server Authority & Anti-Cheat

### 2.1 No Client Number Leaks
In typical games, broadcasting all player states exposes hidden information to browser devtools or packet sniffers. **DECODED** prevents this at the network layer:
- The server checks line of sight, maximum reading distance ($28\text{m}$), field of view, and forehead orientation angle for *each* viewer towards *each* target.
- If and only if a target is genuinely visible according to authoritative server game rules, `visibleNumber` contains the 4-digit code.
- Otherwise, `visibleNumber` is sent as `null`, rendering memory inspection and packet sniffing useless.

### 2.2 Elimination Validation Pipeline
When a player attempts elimination:
1. Attacker sends `{ type: 'ELIMINATION_ATTEMPT', targetId, guessedNumber }`.
2. Server validates:
   - Match state is `PLAYING`.
   - Attacker and target are alive.
   - Attacker is not on cooldown from a prior wrong guess ($5\text{s}$ penalty).
   - Target is not under spawn protection ($4\text{s}$ shield).
   - Distance $\le 28\text{m}$.
   - Unobstructed raycast between attacker eye and target forehead (using `COLLISION_OBSTACLES` and active smoke volumes).
   - Forehead facing angle test: $\vec{F}_{\text{target}} \cdot \vec{D}_{\text{viewer}} > 0.12$ (target forehead must face the viewer).
   - Target's secret number matches `guessedNumber`.
3. If valid: Target killed, attacker $+100$ points, server broadcasts `ELIMINATION_EVENT`.
4. If wrong: Attacker receives $5\text{s}$ penalty cooldown and $-20$ score penalty.

---

## 3. Map & Tactical Visibility Design

The map is a $100\text{m} \times 100\text{m}$ modular arena designed around meaningful tactical choices:
- **Low Cover** ($1.2\text{m}$ wooden crates): Standing players' foreheads ($1.65\text{m}$) peek over the crate. Players must crouch ($1.05\text{m}$) to conceal their number.
- **Medium Cover** ($1.3\text{m}$ concrete barriers with hazard stripes): Hides crouching players completely; requires strategic peeking.
- **Full Cover** ($2.4\text{m}$ stacked crates, $2.8\text{m}$ shipping containers, $3.5\text{m}$ bunker walls): Complete visual concealment.
- **Central Monument & Elevated Platforms**: Vantage points for long-range observation.
- **Corridors and Flanking Alleys**: Enable stealth ambushes from behind opponents.

---

## 4. Controls & Cross-Platform Support

### Desktop Controls
- **Movement:** `W`, `A`, `S`, `D` or Arrow keys
- **Sprint:** `Left Shift`
- **Crouch:** `C` or `Left Ctrl`
- **Jump:** `Space`
- **Look:** Mouse (Pointer Lock API)
- **Decode / Keypad:** `E` or Keypad UI
- **Gadgets:** `1` Smoke, `2` Flash, `3` Camera, `4` Binoculars Zoom
- **Debug:** `F1` (FPS, Ping, Coordinates)

### Mobile Controls
- **Left Virtual Joystick:** Analog movement and strafe.
- **Right Touch Zone:** Drag to rotate camera pitch & yaw.
- **Action Buttons:** Large touch buttons for `DECODE`, `JUMP`, and `CROUCH`.
- **Responsive Keypad:** Large touch targets ($0-9$, `CLR`, `CONFIRM`).
- **Resolution Capping:** `Math.min(window.devicePixelRatio, 1.5)` for optimal thermal and battery efficiency.

---

## 5. Development & Running Commands

```bash
# Install dependencies
npm install

# Run both Client and Server concurrently
npm run dev

# Run Authoritative WebSocket Server only (port 3001)
npm run server

# Run Vite Client only (port 3000)
npm run client

# Run complete TypeScript build (Client bundle + Server typecheck)
npm run build

# Run automated test suite (Unit tests + Section 64 E2E Acceptance Test)
npm test
```

---

## 6. Network Protocol Reference

### Client -> Server Messages
- `CREATE_ROOM`: `{ playerName, gameMode, color, accessory }`
- `JOIN_ROOM`: `{ roomId, playerName, color, accessory, team? }`
- `SET_READY`: `{ ready: boolean }`
- `START_GAME`: `{}` (Host only)
- `SELECT_NUMBER`: `{ number: string }` (4 digits, e.g. `'0047'`)
- `PLAYER_INPUT`: `{ seq, position, rotationY, pitch, velocity, isCrouching, isSprinting, isMoving }`
- `ELIMINATION_ATTEMPT`: `{ targetId, guessedNumber }`
- `USE_GADGET`: `{ gadget, targetPosition }`
- `PING`: `{ timestamp }`

### Server -> Client Messages
- `ROOM_JOINED`: `{ roomId, playerId, isHost, gameMode }`
- `ROOM_UPDATE`: `{ roomId, hostId, gameMode, state, players }`
- `STATE_CHANGE`: `{ state, timer, roundNumber }`
- `NUMBER_SELECTION_REQUIRED`: `{ durationSec, isRespawn }`
- `GAME_SNAPSHOT`: `{ tick, timestamp, timer, players, activeGadgets }`
- `ELIMINATION_EVENT`: `{ attackerId, victimId, eliminatedNumber, attackerScore, isSelfAttacker, isSelfVictim }`
- `ELIMINATION_REJECTED`: `{ reason, cooldownSeconds, message }`
- `GADGET_TRIGGERED`: `{ id, gadgetType, ownerId, position, duration, capturedNumber? }`
- `PONG`: `{ clientTimestamp, serverTimestamp }`
