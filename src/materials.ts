import * as THREE from 'three';

export interface SatelliteMaterials {
  bus: THREE.MeshPhysicalMaterial;
  antenna: THREE.MeshPhysicalMaterial;
  solar: THREE.MeshPhysicalMaterial;
  solarFrame: THREE.MeshStandardMaterial;
  yoke: THREE.MeshStandardMaterial;
  grid: THREE.MeshBasicMaterial;
}

function createSolarCellTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep blue-black cell field
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0a1628');
  grad.addColorStop(0.45, '#0d1f3a');
  grad.addColorStop(1, '#081220');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Cell grid
  const cellsX = 12;
  const cellsY = 8;
  const pad = 6;
  const gap = 2;
  const cellW = (size - pad * 2 - gap * (cellsX - 1)) / cellsX;
  const cellH = (size - pad * 2 - gap * (cellsY - 1)) / cellsY;

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const px = pad + x * (cellW + gap);
      const py = pad + y * (cellH + gap);
      const shade = 18 + ((x * 7 + y * 11) % 14);
      ctx.fillStyle = `rgb(${shade},${shade + 8},${shade + 28})`;
      ctx.fillRect(px, py, cellW, cellH);

      // Fine busbars
      ctx.strokeStyle = 'rgba(120, 160, 200, 0.22)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 1; i < 4; i++) {
        const lx = px + (cellW * i) / 4;
        ctx.moveTo(lx, py + 1);
        ctx.lineTo(lx, py + cellH - 1);
      }
      ctx.stroke();
    }
  }

  // Outer frame edge
  ctx.strokeStyle = 'rgba(40, 55, 70, 0.9)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createAntennaTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#c8cdd4';
  ctx.fillRect(0, 0, size, size);

  // Phased-array element grid
  const n = 28;
  const margin = 18;
  const step = (size - margin * 2) / n;
  ctx.fillStyle = '#aeb6c0';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const px = margin + x * step + 1;
      const py = margin + y * step + 1;
      ctx.fillRect(px, py, step - 2, step - 2);
    }
  }

  // Subtle concentric RF patterning
  ctx.strokeStyle = 'rgba(90, 100, 110, 0.15)';
  ctx.lineWidth = 1;
  for (let r = 40; r < size / 2; r += 28) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export function createMaterials(): SatelliteMaterials {
  const solarMap = createSolarCellTexture();
  const antennaMap = createAntennaTexture();

  return {
    bus: new THREE.MeshPhysicalMaterial({
      color: 0x1a1c1f,
      metalness: 0.65,
      roughness: 0.42,
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
    }),
    antenna: new THREE.MeshPhysicalMaterial({
      map: antennaMap,
      color: 0xffffff,
      metalness: 0.15,
      roughness: 0.72,
      clearcoat: 0.05,
    }),
    solar: new THREE.MeshPhysicalMaterial({
      map: solarMap,
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.28,
      clearcoat: 0.55,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.1,
    }),
    solarFrame: new THREE.MeshStandardMaterial({
      color: 0x2a3038,
      metalness: 0.7,
      roughness: 0.35,
    }),
    yoke: new THREE.MeshStandardMaterial({
      color: 0x3a4048,
      metalness: 0.8,
      roughness: 0.3,
    }),
    grid: new THREE.MeshBasicMaterial({
      color: 0x4a90c8,
      transparent: true,
      opacity: 0.15,
    }),
  };
}

export function disposeMaterials(mats: SatelliteMaterials): void {
  for (const mat of Object.values(mats)) {
    const map = (mat as THREE.MeshPhysicalMaterial).map;
    if (map) map.dispose();
    mat.dispose();
  }
}
