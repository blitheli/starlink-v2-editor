import gsap from 'gsap';
import { Satellite } from './satellite';
import { DEFAULT_PARAMS, type JointAngles, type SatelliteParams, type WingParams } from './types';

export interface ControlPanelApi {
  getParams: () => SatelliteParams;
  dispose: () => void;
}

/** Full unfold duration in seconds (~2.5× prior ~3.2s baseline). */
const DEPLOY_DURATION_S = 8;

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
  onAxesVisible?: (visible: boolean) => void,
): ControlPanelApi {
  let params: SatelliteParams = satellite.getParams();
  let deployTween: gsap.core.Tween | null = null;

  host.replaceChildren();
  const root = el('div', 'panel-inner');
  host.append(root);

  const header = el('header', 'panel-header');
  header.append(
    el('h1', 'panel-title', 'STARLINK V2'),
    el('p', 'panel-sub', '参数化卫星编辑器 · 米 / 度'),
  );
  root.append(header);

  // --- Wings ---
  const wingSec = el('section', 'section');
  wingSec.append(el('h2', 'section-title', '太阳翼'));
  const oddWarn = el('p', 'warn', '');
  oddWarn.hidden = true;

  const refreshOddWarn = (): void => {
    const n = Math.round(params.wings.panelCount);
    const per = Satellite.panelsPerSide(n);
    if (n % 2 !== 0) {
      oddWarn.hidden = false;
      oddWarn.textContent = `板片总数为奇数 ${n}：每侧使用 ${per} 片（余数已丢弃以保持对称）。`;
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
      '板长',
      'm',
      params.wings.panelLength,
      { id: 'panelLength', min: 0.2, max: 4, step: 0.05 },
      (v) => applyWings({ panelLength: v }),
    ),
    numberField(
      '板宽',
      'm',
      params.wings.panelWidth,
      { id: 'panelWidth', min: 0.2, max: 4, step: 0.05 },
      (v) => applyWings({ panelWidth: v }),
    ),
    numberField(
      '板片总数',
      '片',
      params.wings.panelCount,
      { id: 'panelCount', min: 2, max: 80, step: 2 },
      (v) => applyWings({ panelCount: v }),
    ),
    oddWarn,
    el('p', 'hint', '左右均分：每侧 floor(n/2) 片。建议使用偶数。'),
  );
  root.append(wingSec);

  // --- Joints (3-DOF) ---
  const jointSec = el('section', 'section');
  jointSec.append(el('h2', 'section-title', '翼–星体关节（3 自由度）'));
  jointSec.append(
    el(
      'p',
      'hint',
      '枢轴顺序：方位角 → 俯仰 → 绕铰链旋转。方位角＝绕星体 +Y 偏航；俯仰＝绕当地 +Z / 桁架；绕铰链旋转＝绕翼展铰链轴（当地 ±X）扭转。',
    ),
  );

  const unlockLabel = el('label', 'check');
  const unlock = el('input') as HTMLInputElement;
  unlock.type = 'checkbox';
  unlock.checked = params.unlockSides;
  unlockLabel.append(unlock, document.createTextNode(' 解锁左右独立调节'));
  jointSec.append(unlockLabel);

  const leftBox = el('div', 'joint-block');
  leftBox.append(el('h3', 'joint-side', '左侧（联动时＝右侧）'));

  const rightBox = el('div', 'joint-block');
  rightBox.append(el('h3', 'joint-side', '右侧'));
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
        '方位角（偏航）',
        '°',
        angles.azimuthDeg,
        { id: `az_${side}`, min: -120, max: 120, step: 1 },
        (v) => {
          params.joints[side].azimuthDeg = v;
          applyJoints();
        },
      ),
      numberField(
        '俯仰角',
        '°',
        angles.elevationDeg,
        { id: `el_${side}`, min: -90, max: 90, step: 1 },
        (v) => {
          params.joints[side].elevationDeg = v;
          applyJoints();
        },
      ),
      numberField(
        '绕铰链旋转',
        '°',
        angles.rollDeg,
        { id: `roll_${side}`, min: -180, max: 180, step: 1 },
        (v) => {
          params.joints[side].rollDeg = v;
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
  deploySec.append(el('h2', 'section-title', '展开'));
  const progressLabel = el('p', 'deploy-readout', '展开：100%');
  const progressBar = el('div', 'progress');
  const progressFill = el('div', 'progress-fill');
  progressBar.append(progressFill);

  const scrubWrap = el('label', 'field');
  const scrubTop = el('div', 'field-top');
  scrubTop.append(
    el('span', 'field-label', '展开进度'),
    el('span', 'field-unit', '%'),
  );
  scrubWrap.append(scrubTop);
  const scrub = el('input', 'field-range deploy-scrub');
  scrub.type = 'range';
  scrub.id = 'deployProgress';
  scrub.min = '0';
  scrub.max = '100';
  scrub.step = '0.1';
  scrub.value = '100';
  scrub.setAttribute('aria-label', '展开进度');
  scrubWrap.append(scrub);

  const setProgressUI = (t: number): void => {
    const pct = t * 100;
    progressFill.style.width = `${pct.toFixed(1)}%`;
    progressLabel.textContent = `展开：${pct.toFixed(0)}%`;
    scrub.value = String(pct);
  };
  setProgressUI(satellite.getDeployProgress());

  const btnRow = el('div', 'btn-row');
  const playBtn = el('button', 'btn btn-primary', '播放');
  const pauseBtn = el('button', 'btn', '暂停');
  const resetDeployBtn = el('button', 'btn', '重置');

  type DeployState = 'idle' | 'playing' | 'paused';
  let deployState: DeployState = 'idle';

  const killTween = (): void => {
    deployTween?.kill();
    deployTween = null;
  };

  const syncPlayLabel = (): void => {
    if (deployState === 'playing') playBtn.textContent = '播放中…';
    else if (deployState === 'paused') playBtn.textContent = '继续';
    else playBtn.textContent = '播放';
  };

  /** Scrubbing pauses any active tween and seeks live. */
  const scrubTo = (t: number): void => {
    killTween();
    deployState = 'idle';
    syncPlayLabel();
    satellite.setDeployProgress(t);
    setProgressUI(t);
  };

  scrub.addEventListener('input', () => {
    scrubTo(Number(scrub.value) / 100);
  });

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
      duration: Math.max(0.8, (1 - from) * DEPLOY_DURATION_S),
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
  deploySec.append(progressLabel, progressBar, scrubWrap, btnRow);
  deploySec.append(
    el(
      'p',
      'hint',
      '展开折叠在当前 3 自由度关节姿态之上合成。拖动进度条可即时预览；完整展开约 8 秒。',
    ),
  );
  root.append(deploySec);

  // --- Viewport / axes ---
  const camSec = el('section', 'section');
  camSec.append(el('h2', 'section-title', '视口'));

  const axesLabel = el('label', 'check');
  const axesToggle = el('input') as HTMLInputElement;
  axesToggle.type = 'checkbox';
  axesToggle.checked = true;
  axesLabel.append(axesToggle, document.createTextNode(' 显示坐标轴'));
  axesToggle.addEventListener('change', () => {
    onAxesVisible?.(axesToggle.checked);
  });
  camSec.append(axesLabel);

  const camBtn = el('button', 'btn btn-block', '重置相机');
  camBtn.addEventListener('click', onResetCamera);
  camSec.append(camBtn);
  camSec.append(
    el('p', 'hint', '拖动旋转 · 滚轮缩放 · 右键平移。阻尼轨道控制器。'),
  );
  root.append(camSec);

  const legend = el('footer', 'legend');
  legend.innerHTML =
    '<strong>坐标轴</strong> +X 翼桁架 / 翼展 · +Y 星体法向 · +Z 星体长度<br/>' +
    '<strong>三轴关节</strong> 方位角(Y) → 俯仰(Z) → 绕铰链旋转(X)<br/>' +
    `默认：长=${DEFAULT_PARAMS.wings.panelLength}m · 宽=${DEFAULT_PARAMS.wings.panelWidth}m · 总数=${DEFAULT_PARAMS.wings.panelCount}`;
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
