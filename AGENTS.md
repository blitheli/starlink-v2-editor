# AGENTS.md — Starlink V2 Editor

Guidance for future coding agents working in this repository.

## UI language (required)

**All user-visible UI copy must be Chinese by default** — panel titles, section headers, field labels, units where natural, hints, warnings, buttons, deploy readout, legend, aria-labels, and page title.

Keep code identifiers, TypeScript types, CSS class names, and git/commit messages in English.

Examples:

| English (code / concept) | Chinese (UI) |
|--------------------------|--------------|
| Play / Pause / Reset | 播放 / 暂停 / 重置 |
| Reset camera | 重置相机 |
| Roll about hinge | 绕铰链旋转 |
| Deploy progress | 展开进度 |
| Show axes | 显示坐标轴 |

## Project purpose

Parametric **Starlink Satellite V2** 3D editor: a Vite + TypeScript + Three.js SPA for tweaking solar-wing dimensions, 3-DOF wing–bus joints, and accordion deploy animation with live scrubbing.

## Coordinate frame (bus-local = world at origin)

- **+X** — wing boom / span (left −X, right +X)
- **+Y** — bus normal / “up” (phased-array antenna faces −Y)
- **+Z** — bus length

## Key parameters

| Param | Unit | Notes |
|-------|------|--------|
| `panelLength` / `panelWidth` | m | Basic solar panel segment size |
| `panelCount` | pcs | Total panels; `floor(n/2)` per side (even preferred) |
| `azimuthDeg` | ° | Yaw about bus +Y |
| `elevationDeg` | ° | Pitch about local +Z after azimuth |
| `rollDeg` | ° | Twist about hinge / boom (±X after elevation) |
| `unlockSides` | bool | Edit left/right joints independently |

## Joint DOF order (each wing)

Scene-graph pivot order (do not reorder casually):

1. **Azimuth** — `azimuthPivot` — rotation about bus **+Y**
2. **Elevation** — `elevationPivot` — rotation about local **+Z**
3. **Roll (hinge twist)** — `rollPivot` — rotation about local **±X** (boom from bus to panels)

Deploy accordion folds (about local +Z at each panel hinge) compose **on top of** this 3-DOF base pose.

## Deploy animation & scrubber

- Full unfold duration ≈ **8 s** (`DEPLOY_DURATION_S` in `src/ui.ts`).
- UI provides Play / Pause / Reset plus a scrubbable **展开进度** range (0%–100%).
- Dragging the scrubber calls `setDeployProgress` live and kills any playing tween.

## Axes helpers

- World `AxesHelper` plus a smaller bus-origin gizmo (default **ON**).
- Toggle: **显示坐标轴** → `setAxesVisible` from `src/scene.ts`.

## How to run

```bash
npm i
npm run dev
```

```bash
npm run build    # tsc && vite build → dist/
npm run preview
```

## Important source files

- `src/types.ts` — params / `JointAngles` / defaults
- `src/satellite.ts` — bus, wings, 3-DOF pivots, deploy folds
- `src/materials.ts` — canvas textures + PBR materials
- `src/ui.ts` — Chinese control panel
- `src/scene.ts` — lights, PMREM, axes, OrbitControls
