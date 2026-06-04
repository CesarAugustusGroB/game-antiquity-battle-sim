# Antiquity: Grimdark Battle Sim

A cinematic, Total War-style ancient battle simulator built with React and the HTML5 Canvas API. Two armies — Macedonia and the Eastern Empire — clash in real time using steering/flocking AI, formations, and a morale system. A Gemini-powered tactical advisor reads the live battlefield and delivers gritty, cinematic commands. Pick your army size and formations, hit BATTLE, and watch the lines hold or break.

## Features

- Real-time army-vs-army simulation rendered on a full-screen Canvas with an animation loop (`requestAnimationFrame`).
- Five unit types with distinct stats — Infantry, Archers, Cavalry, Elephants, and Heroes (`constants.ts`, `UNIT_CONFIG`).
- Steering-behavior AI combining separation, alignment, and a strong formation pull so units hold their lines until the enemy closes (`FLOCK_*`, `FORMATION_WEIGHT`, `ENGAGE_DISTANCE`).
- Multiple formations per side: Phalanx (Syntagma), Flanking (Hammer & Anvil), Line, Wedge (Beast Wall), and Scattered (Skirmish Cloud).
- Morale system with decay on nearby deaths, gradual recovery, and a rout threshold that sends units fleeing (`MORALE_THRESHOLD`, `MORALE_DECAY_ON_DEATH`, `MORALE_RECOVERY`).
- Visual effects including projectiles with arcing trajectories, particles, and persistent corpses.
- Adjustable army scale (50–400 units per side) and live formation switching mid-battle.
- AI Tactical Advisor: sends current unit counts, morale, and status to Gemini for a concise, "grimdark" tactical observation (`services/advisorService.ts`).

## Tech Stack

- React 19 + TypeScript
- Vite 6 (dev server, build, preview)
- HTML5 Canvas 2D rendering (custom `BattleEngine` with a `Vector2` math class)
- `@google/genai` (Gemini) for the tactical advisor
- `lucide-react` for icons

## Getting Started

### Prerequisites

- Node.js

### Installation

```bash
npm install
```

### Configure the Gemini API key

This app uses the Gemini API for the tactical advisor. Create a `.env.local` file in the project root and set your key:

```bash
GEMINI_API_KEY=your_api_key_here
```

(Vite maps `GEMINI_API_KEY` to `process.env.API_KEY` at build time via `vite.config.ts`.)

### Run

```bash
npm run dev      # start the dev server (http://localhost:3000)
npm run build    # production build
npm run preview  # preview the production build
```

## Project Structure

```
.
├── App.tsx                     # Root component: game state, render loop, advisor wiring
├── index.tsx                   # React entry point
├── classes/
│   └── BattleEngine.ts         # Simulation core: Units, Vector2, formations, combat, particles
├── components/
│   └── Controls.tsx            # Command deck UI: army scale, formation selectors, actions
├── services/
│   └── advisorService.ts       # Gemini tactical-advice calls
├── constants.ts                # Unit configs, team colors, morale & physics tuning
├── types.ts                    # Enums and interfaces (Team, UnitType, FormationType, stats)
└── metadata.json
```
