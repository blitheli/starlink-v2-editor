# Starlink V2 Editor / Starlink V2 参数化编辑器

Parametric **Starlink Satellite V2** 3D editor — Vite + TypeScript + Three.js.  
参数化 **Starlink V2** 卫星三维编辑器（Vite + TypeScript + Three.js）。

界面文案默认为中文；代码标识符保持英文。详见 `AGENTS.md`。

## Run locally / 本地运行

```bash
npm i
npm run dev
```

Open the printed local URL (default `http://localhost:5173`).  
打开终端中显示的本地地址（默认 `http://localhost:5173`）。

```bash
npm run build    # production build → dist/
npm run preview  # preview the production build
```

## Parameters / 参数说明

| Param / 参数 | UI 标签 | Unit | Meaning |
|--------------|---------|------|---------|
| `panelLength` | 板长 | m | Length of each basic solar panel segment |
| `panelWidth` | 板宽 | m | Width of each basic solar panel segment |
| `panelCount` | 板片总数 | 片 | Total panels; default **8**, UI max **80** (min 2); split with `floor(n/2)` per side (even preferred; odd remainder dropped) |
| Azimuth | 方位角（偏航） | ° | Wing–bus yaw about bus **+Y** (normal) |
| Elevation | 俯仰角 | ° | Wing–bus pitch about boom / local **+Z** |
| Roll | 绕铰链旋转 | ° | Twist about hinge / boom axis (local **+X** after elevation); left & right share the same rotation sign (not mirrored) |
| Unlock sides | 解锁左右独立调节 | — | Edit left/right joints independently |
| Deploy scrubber | 展开进度 | % | Live scrub of deploy progress (0–100) |
| Show axes | 显示坐标轴 | — | Toggle world + bus `AxesHelper` (default on) |

### Joint DOF order / 关节自由度顺序

`azimuth → elevation → roll`（方位角 → 俯仰 → 绕铰链旋转）

Deploy animation folds panel hinges from stowed → open (~8 s full unfold) while keeping the **3-DOF** joint pose as the base orientation. Scrub the timeline to seek live.

展开动画在翼根 **3 自由度** 姿态基础上，将各段铰链从收拢插值到完全展开（完整展开约 8 秒）；可拖动「展开进度」即时预览。

### Axes / 坐标轴

- **+X** 翼桁架 / 翼展 · **+Y** 星体法向 · **+Z** 星体长度

## Deploy to Vercel / 部署到 Vercel

Static Vite SPA. `vercel.json` rewrites all routes to `index.html`.

1. Push this repo to GitHub  
2. Import the project in [Vercel](https://vercel.com)  
3. Build command: `npm run build` · Output: `dist`

无需额外服务端；静态产物即可部署。
