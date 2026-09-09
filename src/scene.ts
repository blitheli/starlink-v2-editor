import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface SceneBundle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  pmrem: THREE.PMREMGenerator;
  dispose: () => void;
  resetCamera: () => void;
}

const DEFAULT_CAM = {
  position: new THREE.Vector3(4.8, 2.6, 4.2),
  target: new THREE.Vector3(0, 0, 0),
};

export function createScene(canvas: HTMLCanvasElement): SceneBundle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090d);
  scene.fog = new THREE.FogExp2(0x07090d, 0.035);

  const camera = new THREE.PerspectiveCamera(
    42,
    canvas.clientWidth / Math.max(canvas.clientHeight, 1),
    0.05,
    200,
  );
  camera.position.copy(DEFAULT_CAM.position);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.5;
  controls.maxDistance = 30;
  controls.target.copy(DEFAULT_CAM.target);
  controls.update();

  // Soft space-like lighting
  const hemi = new THREE.HemisphereLight(0xb8c8e0, 0x1a1510, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff2e0, 1.35);
  key.position.set(6, 10, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 40;
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.bias = -0.0002;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x88aadd, 0.35);
  fill.position.set(-5, 2, -4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xc0d8ff, 0.25);
  rim.position.set(0, -3, 6);
  scene.add(rim);

  // Subtle ground plane for shadow catcher
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(12, 64),
    new THREE.ShadowMaterial({ opacity: 0.35 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.55;
  ground.receiveShadow = true;
  scene.add(ground);

  // Dim grid for scale reference (1 m)
  const grid = new THREE.GridHelper(16, 16, 0x2a3340, 0x151a22);
  grid.position.y = -0.548;
  scene.add(grid);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const envMap = pmrem.fromScene(envScene as unknown as THREE.Scene, 0.04).texture;
  scene.environment = envMap;

  const resetCamera = (): void => {
    camera.position.copy(DEFAULT_CAM.position);
    controls.target.copy(DEFAULT_CAM.target);
    controls.update();
  };

  const onResize = (): void => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  window.addEventListener('resize', onResize);
  // Initial sizing after layout
  requestAnimationFrame(onResize);

  const dispose = (): void => {
    window.removeEventListener('resize', onResize);
    controls.dispose();
    envMap.dispose();
    pmrem.dispose();
    renderer.dispose();
  };

  return { renderer, scene, camera, controls, pmrem, dispose, resetCamera };
}
