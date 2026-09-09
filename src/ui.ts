import gsap from 'gsap';
import { Satellite } from './satellite';
import { DEFAULT_PARAMS, type JointAngles, type SatelliteParams, type WingParams } from './types';

export interface ControlPanelApi {
  getParams: () => SatelliteParams;
  dispose: () => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function numberField(
  label: string,
  unit: string,
  value: number,
  opts: { min?: number; max?: number; step?: number; id: string },
  onChange: (v: number) => void,
): HTMLElement {
  const wrap = el('label', 'field');
  const top = el('div', 'field-top');
  top.append(el('span', 'field-label', label), el('span', 'field-unit', unit));
  wrap.append(top);

  const row = el('div', 'field-row');
  const input = el('input', 'field-input');
  input.type = 'number';
  input.id = opts.id;
  input.value = String(value);
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  if (opts.step !== undefined) input.step = String(opts.step);

  const range = el('input', 'field-range');
  range.type = 'range';
  range.min = String(opts.min ?? 0);
  range.max = String(opts.max ?? 10);
  range.step = String(opts.step ?? 0.01);
  range.value = String(value);

  const emit = (v: number): void => {
    if (opts.min !== undefined) v = Math.max(opts.min, v);
    if (opts.max !== undefined) v = Math.min(opts.max, v);
    input.value = String(v);
    range.value = String(v);
    onChange(v);
  };

  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (Number.isFinite(v)) emit(v);
  });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    if (input.value !== '' && Number.isFinite(v)) {
      range.value = String(v);
      onChange(v);
    }
  });
  range.addEventListener('input', () => emit(Number(range.value)));

  row.append(input, range);
  wrap.append(row);
  return wrap;
}

export function mountControlPanel(
  host: HTMLElement,
  satellite: Satellite,
  onResetCamera: () => void,
): ControlPanelApi {
  let params: SatelliteParams = satellite.getParams();
  let deployTween: gsap.core.Tween | null = null;

  host.replaceChildren();
  const root = el('div', 'panel-inner');
  host.append(root);

  const header = el('header', 'panel-header');
  header.append(
    el('h1', 'panel-title', 'STARLINK V2'),
    el('p', 'panel-sub', 'Parametric satellite editor · meters / degrees'),
  );
  root.append(header);

  // --- Wings ---
  const wingSec = el('section', 'section');
  wingSec.append(el('h2', 'section-title', 'Solar Wings'));
  const oddWarn = el('p', 'warn', '');
  oddWarn.hidden = true;

  const refreshOddWarn = (): void => {
    const n = Math.round(params.wings.panelCount);
    const per = Satellite.panelsPerSide(n);
    if (n % 2 !== 0) {
      oddWarn.hidden = false;
      oddWarn.textContent = `Odd panelCount=${n}: using ${per}/side (remainder dropped for symmetry).`;
    } else {
      oddWarn.hidden = true;
    }
  };

  const applyWings = (patch: Partial<WingParams>): void => {
    params.wings = { ...params.wings, ...patch };
    if (patch.panelCount !== undefined) {
      params.wings.panelCount = Math.max(1, Math.round(patch.panelCount));
    }
    refreshOddWarn();
    satellite.updateWings(params.wings);
  };

  wingSec.append(
    numberField(
      'Panel length',
      'm',
      params.wings.panelLength,
      { id: 'panelLength', min: 0.2, max: 4, step: 0.05 },
      (v) => applyWings({ panelLength: v }),
    ),
    numberField(
      'Panel width',
      'm',
      params.wings.panelWidth,
      { id: 'panelWidth', min: 0.2, max: 4, step: 0.05 },
      (v) => applyWings({ panelWidth: v }),
    ),
    numberField(
      'Panel count (total)',
      'pcs',
      params.wings.panelCount,
      { id: 'panelCount', min: 2, max: 12, step: 2 },
      (v) => applyWings({ panelCount: v }),
    ),
    oddWarn,
    el('p', 'hint', 'Split evenly L/R: floor(n/2) per side. Prefer even counts.'),
  );
  root.append(wingSec);

  // --- Joints ---
  const jointSec = el('section', 'section');
  jointSec.append(el('h2', 'section-title', 'Wing–Bus Joint (2-DOF)'));
  jointSec.append(
    el(
      'p',
      'hint',
      'Azimuth = yaw about bus +Y (normal). Elevation = pitch about boom / local +Z.',
    ),
  );

  const unlockLabel = el('label', 'check');
  const unlock = el('input') as HTMLInputElement;
  unlock.type = 'checkbox';
  unlock.checked = params.unlockSides;
  unlockLabel.append(unlock, document.createTextNode(' Unlock sides independently'));
  jointSec.append(unlockLabel);

  const leftBox = el('div', 'joint-block');
  leftBox.append(el('h3', 'joint-side', 'Left (= Right when linked)'));

  const rightBox = el('div', 'joint-block');
  rightBox.append(el('h3', 'joint-side', 'Right'));
  rightBox.hidden = !params.unlockSides;

  const applyJoints = (): void => {
    if (!params.unlockSides) {
      params.joints.right = structuredClone(params.joints.left);
    }
    satellite.updateJoints(params.joints, params.unlockSides);
  };

  const jointFields = (box: HTMLElement, side: 'left' | 'right', angles: JointAngles): void => {
    box.append(
      numberField(
        'Azimuth (yaw)',
        '°',
        angles.azimuthDeg,
        { id: `az_${side}`, min: -120, max: 120, step: 1 },
        (v) => {
          params.joints[side].azimuthDeg = v;
          applyJoints();
        },
      ),
      numberField(
        'Elevation (pitch)',
        '°',
        angles.elevationDeg,
        { id: `el_${side}`, min: -90, max: 90, step: 1 },
        (v) => {
          params.joints[side].elevationDeg = v;
          applyJoints();
        },
      ),
    );
  };

  jointFields(leftBox, 'left', params.joints.left);
  jointFields(rightBox, 'right', params.joints.right);
  jointSec.append(leftBox, rightBox);

  unlock.addEventListener('change', () => {
    params.unlockSides = unlock.checked;
    rightBox.hidden = !unlock.checked;
    satellite.setUnlockSides(params.unlockSides);
    params = satellite.getParams();
  });

  root.append(jointSec);

  // --- Deploy ---
  const deploySec = el('section', 'section');
  deploySec.append(el('h2', 'section-title', 'Deployment'));
  const progressLabel = el('p', 'deploy-readout', 'Deploy: 100%');
  const progressBar = el('div', 'progress');
  const progressFill = el('div', 'progress-fill');
  progressBar.append(progressFill);

  const setProgressUI = (t: number): void => {
    progressFill.style.width = `${(t * 100).toFixed(1)}%`;
    progressLabel.textContent = `Deploy: ${(t * 100).toFixed(0)}%`;
  };
  setProgressUI(satellite.getDeployProgress());

  const btnRow = el('div', 'btn-row');
  const playBtn = el('button', 'btn btn-primary', 'Play');
  const pauseBtn = el('button', 'btn', 'Pause');
  const resetDeployBtn = el('button', 'btn', 'Reset');

  type DeployState = 'idle' | 'playing' | 'paused';
  let deployState: DeployState = 'idle';

  const killTween = (): void => {
    deployTween?.kill();
    deployTween = null;
  };

  const syncPlayLabel = (): void => {
    if (deployState === 'playing') playBtn.textContent = 'Playing…';
    else if (deployState === 'paused') playBtn.textContent = 'Resume';
    else playBtn.textContent = 'Play';
  };

  playBtn.addEventListener('click', () => {
    if (deployState === 'playing') return;

    if (deployState === 'paused' && deployTween) {
      deployTween.resume();
      deployState = 'playing';
      syncPlayLabel();
      return;
    }

    killTween();
    const start = satellite.getDeployProgress();
    const from = start >= 0.999 ? 0 : start;
    if (from === 0) satellite.setDeployProgress(0);
    setProgressUI(from);

    const state = { t: from };
    deployState = 'playing';
    syncPlayLabel();

    deployTween = gsap.to(state, {
      t: 1,
      duration: Math.max(0.45, (1 - from) * 3.2),
      ease: 'power2.inOut',
      onUpdate: () => {
        satellite.setDeployProgress(state.t);
        setProgressUI(state.t);
      },
      onComplete: () => {
        deployState = 'idle';
        deployTween = null;
        syncPlayLabel();
      },
    });
  });

  pauseBtn.addEventListener('click', () => {
    if (deployState !== 'playing' || !deployTween) return;
    deployTween.pause();
    deployState = 'paused';
    syncPlayLabel();
  });

  resetDeployBtn.addEventListener('click', () => {
    killTween();
    deployState = 'idle';
    satellite.setDeployProgress(0);
    setProgressUI(0);
    syncPlayLabel();
  });

  btnRow.append(playBtn, pauseBtn, resetDeployBtn);
  deploySec.append(progressLabel, progressBar, btnRow);
  deploySec.append(
    el('p', 'hint', 'Folds respect current 2-DOF joint pose as the base orientation.'),
  );
  root.append(deploySec);

  // --- Camera ---
  const camSec = el('section', 'section');
  camSec.append(el('h2', 'section-title', 'Viewport'));
  const camBtn = el('button', 'btn btn-block', 'Reset camera');
  camBtn.addEventListener('click', onResetCamera);
  camSec.append(camBtn);
  camSec.append(
    el('p', 'hint', 'Drag orbit · scroll zoom · RMB pan. Damped OrbitControls.'),
  );
  root.append(camSec);

  const legend = el('footer', 'legend');
  legend.innerHTML =
    '<strong>Axes</strong> +X wing boom · +Y bus normal · +Z bus length<br/>' +
    `Defaults: L=${DEFAULT_PARAMS.wings.panelLength}m · W=${DEFAULT_PARAMS.wings.panelWidth}m · N=${DEFAULT_PARAMS.wings.panelCount}`;
  root.append(legend);

  refreshOddWarn();

  return {
    getParams: () => structuredClone(params),
    dispose: () => {
      killTween();
      host.replaceChildren();
    },
  };
}
