import './style.css';
import { createScene } from './scene';
import { Satellite } from './satellite';
import { DEFAULT_PARAMS } from './types';
import { mountControlPanel } from './ui';

const canvas = document.querySelector<HTMLCanvasElement>('#viewport');
const panel = document.querySelector<HTMLElement>('#panel');

if (!canvas || !panel) {
  throw new Error('Missing #viewport or #panel');
}

const bundle = createScene(canvas);
const satellite = new Satellite(DEFAULT_PARAMS);
bundle.scene.add(satellite.group);

const ui = mountControlPanel(panel, satellite, bundle.resetCamera);

function frame(): void {
  bundle.controls.update();
  bundle.renderer.render(bundle.scene, bundle.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Hot-dispose helper for Vite HMR
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    ui.dispose();
    satellite.dispose();
    bundle.dispose();
  });
}
