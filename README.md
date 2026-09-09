# Starlink V2 Editor / Starlink V2 参数化编辑器

Parametric **Starlink Satellite V2** 3D editor — Vite + TypeScript + Three.js.  
参数化 **Starlink V2** 卫星三维编辑器（Vite + TypeScript + Three.js）。

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

| Param | Unit | Meaning |
|-------|------|---------|
| `panelLength` | m | Length of each basic solar panel segment |
| `panelWidth` | m | Width of each basic solar panel segment |
| `panelCount` | pcs | Total panels; split with `floor(n/2)` per side (even preferred; odd remainder dropped) |
| Azimuth | ° | Wing–bus yaw about bus **+Y** (normal) |
| Elevation | ° | Wing–bus pitch about boom / local **+Z** |
| Unlock sides | — | Edit left/right joints independently |

Deploy animation folds panel hinges from stowed → open while keeping the 2-DOF joint pose as the base orientation.

展开动画在翼根 2-DOF 姿态基础上，将各段铰链从收拢插值到完全展开。

## Deploy to Vercel / 部署到 Vercel

Static Vite SPA. `vercel.json` rewrites all routes to `index.html`.

1. Push this repo to GitHub  
2. Import the project in [Vercel](https://vercel.com)  
3. Build command: `npm run build` · Output: `dist`

无需额外服务端；静态产物即可部署。
