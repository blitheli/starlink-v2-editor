import * as THREE from 'three';

export interface SatelliteMaterials {
  bus: THREE.MeshPhysicalMaterial;
  busMli: THREE.MeshPhysicalMaterial;
  busBevel: THREE.MeshPhysicalMaterial;
  antenna: THREE.MeshPhysicalMaterial;
  antennaFrame: THREE.MeshStandardMaterial;
  solar: THREE.MeshPhysicalMaterial;
  solarGlass: THREE.MeshPhysicalMaterial;
  solarFrame: THREE.MeshStandardMaterial;
  yoke: THREE.MeshStandardMaterial;
  detail: THREE.MeshStandardMaterial;
}

function noise(ctx: CanvasRenderingContext2D, size: number, alpha: number): void {
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = (alpha * 255) | 0;
  }
  ctx.putImageData(img, 0, 0);
}

function createBusMliTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Dark thermal blanket / MLI base
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#141618');
  grad.addColorStop(0.4, '#1a1c1f');
  grad.addColorStop(0.7, '#121416');
  grad.addColorStop(1, '#0e1012');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Crinkled foil streaks
  for (let i = 0; i < 48; i++) {
    const y = (i / 48) * size + (Math.random() - 0.5) * 8;
    ctx.strokeStyle = `rgba(${30 + (i % 5) * 4},${32 + (i % 3) * 3},${36 + (i % 4) * 2},${0.08 + (i % 7) * 0.01})`;
    ctx.lineWidth = 1 + (i % 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < size; x += 16) {
      ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 3);
    }
    ctx.stroke();
  }

  // Soft noise overlay
  ctx.globalCompositeOperation = 'overlay';
  noise(ctx, size, 0.12);
  ctx.globalCompositeOperation = 'source-over';

  // Seam / stitch lines
  ctx.strokeStyle = 'rgba(55, 60, 68, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    const x = (size * i) / 6;
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x, size - 8);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createBusRoughnessMap(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, size, size);
  noise(ctx, size, 0.45);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createSolarCellTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Darker blue-black cell field (coverglass undertone)
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#050a12');
  grad.addColorStop(0.4, '#071018');
  grad.addColorStop(1, '#04080e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const cellsX = 18;
  const cellsY = 10;
  const pad = 10;
  const gap = 3;
  const cellW = (size - pad * 2 - gap * (cellsX - 1)) / cellsX;
  const cellH = (size - pad * 2 - gap * (cellsY - 1)) / cellsY;

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const px = pad + x * (cellW + gap);
      const py = pad + y * (cellH + gap);

      // Cell body — slight per-cell variation
      const shade = 10 + ((x * 5 + y * 9) % 10);
      const blue = 22 + ((x + y * 3) % 12);
      ctx.fillStyle = `rgb(${shade},${shade + 4},${blue})`;
      ctx.fillRect(px, py, cellW, cellH);

      // Specular striping (coverglass / cell texture)
      const stripe = ctx.createLinearGradient(px, py, px + cellW, py);
      stripe.addColorStop(0, 'rgba(80, 120, 180, 0.04)');
      stripe.addColorStop(0.5, 'rgba(140, 180, 220, 0.1)');
      stripe.addColorStop(1, 'rgba(60, 90, 140, 0.03)');
      ctx.fillStyle = stripe;
      ctx.fillRect(px, py, cellW, cellH);

      // Fine vertical busbars
      ctx.strokeStyle = 'rgba(160, 190, 220, 0.28)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
        const lx = px + (cellW * i) / 5;
        ctx.moveTo(lx, py + 1);
        ctx.lineTo(lx, py + cellH - 1);
      }
      ctx.stroke();

      // Horizontal finger lines
      ctx.strokeStyle = 'rgba(100, 140, 180, 0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let i = 1; i < 6; i++) {
        const ly = py + (cellH * i) / 6;
        ctx.moveTo(px + 1, ly);
        ctx.lineTo(px + cellW - 1, ly);
      }
      ctx.stroke();

      // Cell edge highlight
      ctx.strokeStyle = 'rgba(40, 70, 100, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, cellW - 1, cellH - 1);
    }
  }

  // Intercell gap darkening already via gap; outer frame edge
  ctx.strokeStyle = 'rgba(25, 35, 45, 0.95)';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, size - 8, size - 8);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createAntennaTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base aluminum / PCB gray
  ctx.fillStyle = '#b8bec8';
  ctx.fillRect(0, 0, size, size);

  // Dense phased-array elements
  const n = 48;
  const margin = 24;
  const step = (size - margin * 2) / n;

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = margin + x * step;
      const py = margin + y * step;
      const inset = 1.2;
      // Element pad
      ctx.fillStyle = (x + y) % 2 === 0 ? '#9aa3ae' : '#a4adb8';
      ctx.fillRect(px + inset, py + inset, step - inset * 2, step - inset * 2);
      // Tiny feed via
      ctx.fillStyle = 'rgba(70, 78, 88, 0.45)';
      const cx = px + step / 2;
      const cy = py + step / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, step * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Concentric RF / calibration rings
  ctx.strokeStyle = 'rgba(70, 80, 90, 0.12)';
  ctx.lineWidth = 1.2;
  for (let r = 50; r < size / 2 - 20; r += 36) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Border trim
  ctx.strokeStyle = 'rgba(90, 98, 108, 0.55)';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, size - 20, size - 20);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createMaterials(): SatelliteMaterials {
  const solarMap = createSolarCellTexture();
  const antennaMap = createAntennaTexture();
  const busMliMap = createBusMliTexture();
  const busRough = createBusRoughnessMap();

  return {
    bus: new THREE.MeshPhysicalMaterial({
      color: 0x1c1e22,
      metalness: 0.72,
      roughness: 0.38,
      clearcoat: 0.2,
      clearcoatRoughness: 0.45,
      roughnessMap: busRough,
      envMapIntensity: 0.9,
    }),
    busMli: new THREE.MeshPhysicalMaterial({
      map: busMliMap,
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.55,
      clearcoat: 0.08,
      clearcoatRoughness: 0.7,
      roughnessMap: busRough,
      envMapIntensity: 0.75,
    }),
    busBevel: new THREE.MeshPhysicalMaterial({
      color: 0x2a2e34,
      metalness: 0.85,
      roughness: 0.28,
      clearcoat: 0.35,
      clearcoatRoughness: 0.25,
    }),
    antenna: new THREE.MeshPhysicalMaterial({
      map: antennaMap,
      color: 0xffffff,
      metalness: 0.22,
      roughness: 0.68,
      clearcoat: 0.12,
      clearcoatRoughness: 0.4,
    }),
    antennaFrame: new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.75,
      roughness: 0.32,
    }),
    solar: new THREE.MeshPhysicalMaterial({
      map: solarMap,
      color: 0xffffff,
      metalness: 0.62,
      roughness: 0.22,
      clearcoat: 0.65,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.15,
    }),
    solarGlass: new THREE.MeshPhysicalMaterial({
      color: 0x1a2838,
      metalness: 0.1,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      opacity: 0.18,
      envMapIntensity: 1.4,
      depthWrite: false,
    }),
    solarFrame: new THREE.MeshStandardMaterial({
      color: 0x222830,
      metalness: 0.78,
      roughness: 0.32,
    }),
    yoke: new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.85,
      roughness: 0.28,
    }),
    detail: new THREE.MeshStandardMaterial({
      color: 0x4a5058,
      metalness: 0.9,
      roughness: 0.25,
    }),
  };
}

export function disposeMaterials(mats: SatelliteMaterials): void {
  for (const mat of Object.values(mats)) {
    const m = mat as THREE.MeshPhysicalMaterial;
    if (m.map) m.map.dispose();
    if (m.roughnessMap) m.roughnessMap.dispose();
    mat.dispose();
  }
}
