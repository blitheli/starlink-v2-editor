import * as THREE from 'three';
import { BUS, type JointAngles, type SatelliteParams, type WingParams } from './types';
import { createMaterials, disposeMaterials, type SatelliteMaterials } from './materials';

export type WingSide = 'left' | 'right';

interface PanelSegment {
  hinge: THREE.Object3D;
  mesh: THREE.Mesh;
}

interface WingAssembly {
  /** Root attached to bus side */
  root: THREE.Object3D;
  /** Pivot order: azimuth (Y) → elevation (Z) → roll/hinge-twist (X) */
  azimuthPivot: THREE.Object3D;
  elevationPivot: THREE.Object3D;
  rollPivot: THREE.Object3D;
  segments: PanelSegment[];
  /** Fold angles (radians) applied during deploy — one per hinge including root fold */
  foldTargets: number[];
}

/**
 * Starlink V2-style flat-panel satellite.
 *
 * Coordinate system (bus-local):
 *   +X = boom / wing span direction (left = -X, right = +X)
 *   +Y = bus normal / "up" (antenna faces -Y)
 *   +Z = bus length axis
 *
 * Joint DOF (each side), applied in this order:
 *   1. Azimuth  — yaw about bus +Y
 *   2. Elevation — pitch about local +Z (after azimuth)
 *   3. Roll      — twist about hinge / boom axis (local ±X after elevation)
 *
 * Deploy folds accordion-style about local +Z at each panel hinge,
 * composed on top of the 3-DOF base pose.
 */
export class Satellite {
  readonly group = new THREE.Group();
  private mats: SatelliteMaterials;
  private busGroup = new THREE.Group();
  private leftWing: WingAssembly | null = null;
  private rightWing: WingAssembly | null = null;
  private params: SatelliteParams;
  /** 0 = fully stowed, 1 = fully deployed */
  private deployProgress = 1;

  constructor(params: SatelliteParams) {
    this.params = structuredClone(params);
    this.mats = createMaterials();
    this.group.name = 'StarlinkV2';
    this.buildBus();
    this.rebuildWings();
    this.applyJoints();
    this.applyDeploy(this.deployProgress);
  }

  getParams(): SatelliteParams {
    return structuredClone(this.params);
  }

  getDeployProgress(): number {
    return this.deployProgress;
  }

  setDeployProgress(t: number): void {
    this.deployProgress = THREE.MathUtils.clamp(t, 0, 1);
    this.applyDeploy(this.deployProgress);
  }

  updateWings(wings: WingParams): void {
    this.params.wings = { ...wings };
    this.rebuildWings();
    this.applyJoints();
    this.applyDeploy(this.deployProgress);
  }

  updateJoints(joints: SatelliteParams['joints'], unlockSides: boolean): void {
    this.params.joints = structuredClone(joints);
    this.params.unlockSides = unlockSides;
    this.applyJoints();
  }

  setUnlockSides(unlock: boolean): void {
    this.params.unlockSides = unlock;
    if (!unlock) {
      this.params.joints.right = structuredClone(this.params.joints.left);
    }
    this.applyJoints();
  }

  /** Panels per side after even split (odd remainder discarded). */
  static panelsPerSide(panelCount: number): number {
    return Math.max(1, Math.floor(Math.max(1, Math.round(panelCount)) / 2));
  }

  private buildBus(): void {
    const { length: L, width: W, height: H, antennaThickness } = BUS;

    // Core chassis — dark MLI / thermal blanket face
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.98, H * 0.88, L * 0.98),
      this.mats.busMli,
    );
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'BusBody';
    this.busGroup.add(body);

    // Chamfer / bevel rails along length (±X edges)
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, H * 1.05, L * 0.995),
        this.mats.busBevel,
      );
      rail.position.set(sx * (W / 2 - 0.015), 0, 0);
      rail.castShadow = true;
      this.busGroup.add(rail);
    }

    // End caps (±Z) with slight step
    for (const sz of [-1, 1]) {
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.92, H * 0.95, 0.05),
        this.mats.bus,
      );
      cap.position.set(0, 0, sz * (L / 2 - 0.02));
      cap.castShadow = true;
      this.busGroup.add(cap);
    }

    // Top deck plate (+Y) — slightly raised structural face
    const topDeck = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.94, 0.012, L * 0.94),
      this.mats.bus,
    );
    topDeck.position.y = H * 0.42;
    topDeck.castShadow = true;
    topDeck.receiveShadow = true;
    this.busGroup.add(topDeck);

    // Bottom lip / radiator edge strip
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.03, H * 0.28, L + 0.03),
      this.mats.busBevel,
    );
    lip.position.y = -H * 0.38;
    lip.castShadow = true;
    this.busGroup.add(lip);

    // Phased-array antenna on -Y face with raised frame
    const antennaFrame = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.98, antennaThickness * 0.55, L * 0.96),
      this.mats.antennaFrame,
    );
    antennaFrame.position.y = -(H / 2 + antennaThickness * 0.2);
    antennaFrame.castShadow = true;
    this.busGroup.add(antennaFrame);

    const antenna = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.94, antennaThickness, L * 0.92),
      this.mats.antenna,
    );
    antenna.position.y = -(H / 2 + antennaThickness * 0.75);
    antenna.receiveShadow = true;
    antenna.castShadow = true;
    antenna.name = 'AntennaFace';
    this.busGroup.add(antenna);

    // Thruster pods at Z ends
    for (const sign of [-1, 1]) {
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.065, 0.11, 14),
        this.mats.yoke,
      );
      pod.rotation.z = Math.PI / 2;
      pod.position.set(0, -0.01, sign * (L / 2 + 0.045));
      pod.castShadow = true;
      this.busGroup.add(pod);

      // Nozzle tip
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.045, 0.04, 12),
        this.mats.detail,
      );
      nozzle.rotation.z = Math.PI / 2;
      nozzle.position.set(0, -0.01, sign * (L / 2 + 0.1));
      this.busGroup.add(nozzle);
    }

    // Small laser-comm / star-tracker bump on +Y deck
    const laserBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.08, 0.025, 16),
      this.mats.detail,
    );
    laserBase.position.set(0.35, H * 0.42 + 0.018, 0.55);
    this.busGroup.add(laserBase);

    const laserDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      this.mats.busBevel,
    );
    laserDome.position.set(0.35, H * 0.42 + 0.03, 0.55);
    this.busGroup.add(laserDome);

    // Pair of small patch antennas near opposite corner
    for (const [ax, az] of [
      [-0.45, -0.7],
      [-0.45, -0.9],
    ] as const) {
      const patch = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.015, 0.08),
        this.mats.antennaFrame,
      );
      patch.position.set(ax, H * 0.42 + 0.01, az);
      this.busGroup.add(patch);
    }

    // Side harness / cable run stubs near yoke attach points
    for (const sx of [-1, 1]) {
      const harness = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.04, 0.22),
        this.mats.detail,
      );
      harness.position.set(sx * (W / 2 - 0.02), 0.02, 0);
      this.busGroup.add(harness);
    }

    this.group.add(this.busGroup);
  }

  private disposeWing(wing: WingAssembly | null): void {
    if (!wing) return;
    wing.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    });
    wing.root.parent?.remove(wing.root);
  }

  private rebuildWings(): void {
    this.disposeWing(this.leftWing);
    this.disposeWing(this.rightWing);
    this.leftWing = this.buildWing('left');
    this.rightWing = this.buildWing('right');
    this.group.add(this.leftWing.root);
    this.group.add(this.rightWing.root);
  }

  private buildWing(side: WingSide): WingAssembly {
    const { panelLength, panelWidth } = this.params.wings;
    const n = Satellite.panelsPerSide(this.params.wings.panelCount);
    const dir = side === 'right' ? 1 : -1;
    const halfBusW = BUS.width / 2;

    const root = new THREE.Object3D();
    root.name = `WingRoot_${side}`;
    root.position.set(dir * halfBusW, 0, 0);

    // 1) Azimuth — yaw about bus +Y
    const azimuthPivot = new THREE.Object3D();
    azimuthPivot.name = `Azimuth_${side}`;
    root.add(azimuthPivot);

    // 2) Elevation — pitch about local +Z
    const elevationPivot = new THREE.Object3D();
    elevationPivot.name = `Elevation_${side}`;
    azimuthPivot.add(elevationPivot);

    // 3) Roll — twist about hinge / boom axis (local ±X)
    const rollPivot = new THREE.Object3D();
    rollPivot.name = `Roll_${side}`;
    elevationPivot.add(rollPivot);

    // Short yoke / boom from bus edge to first panel hinge
    const yokeLen = BUS.yokeLength;
    const yoke = new THREE.Mesh(
      new THREE.CylinderGeometry(BUS.yokeRadius, BUS.yokeRadius * 0.9, yokeLen, 12),
      this.mats.yoke,
    );
    yoke.rotation.z = Math.PI / 2;
    yoke.position.set(dir * (yokeLen / 2), 0, 0);
    yoke.castShadow = true;
    rollPivot.add(yoke);

    // Yoke end fitting
    const fitting = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.06, 0.08),
      this.mats.detail,
    );
    fitting.position.set(dir * yokeLen, 0, 0);
    rollPivot.add(fitting);

    // Chain of panel segments with fold hinges
    const chainAnchor = new THREE.Object3D();
    chainAnchor.position.set(dir * yokeLen, 0, 0);
    rollPivot.add(chainAnchor);

    const segments: PanelSegment[] = [];
    let parent: THREE.Object3D = chainAnchor;

    for (let i = 0; i < n; i++) {
      const hinge = new THREE.Object3D();
      hinge.name = `FoldHinge_${side}_${i}`;
      if (i === 0) {
        hinge.position.set(0, 0, 0);
      } else {
        hinge.position.set(dir * panelLength, 0, 0);
      }
      parent.add(hinge);

      const panel = this.createPanelMesh(panelLength, panelWidth, side, i);
      panel.position.set(dir * (panelLength / 2), 0, 0);
      hinge.add(panel);

      segments.push({ hinge, mesh: panel });
      parent = hinge;
    }

    return {
      root,
      azimuthPivot,
      elevationPivot,
      rollPivot,
      segments,
      foldTargets: new Array(n).fill(0),
    };
  }

  private createPanelMesh(
    length: number,
    width: number,
    side: WingSide,
    index: number,
  ): THREE.Mesh {
    const thickness = 0.032;
    const geom = new THREE.BoxGeometry(length * 0.97, thickness, width * 0.96);
    const mesh = new THREE.Mesh(geom, this.mats.solar);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `SolarPanel_${side}_${index}`;

    // Structural frame rim
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(length, thickness * 1.25, width),
      this.mats.solarFrame,
    );
    frame.scale.set(1.012, 0.65, 1.012);
    frame.position.y = -thickness * 0.2;
    mesh.add(frame);

    // Thin coverglass slab for clearcoat specular
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.965, thickness * 0.15, width * 0.955),
      this.mats.solarGlass,
    );
    glass.position.y = thickness * 0.42;
    mesh.add(glass);

    // Edge rails along length (±Z of panel)
    for (const sz of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(length * 0.99, thickness * 1.1, 0.018),
        this.mats.solarFrame,
      );
      rail.position.set(0, 0, sz * (width * 0.48));
      mesh.add(rail);
    }

    return mesh;
  }

  private applyJoints(): void {
    const { left, right } = this.params.joints;
    const L = left;
    const R = this.params.unlockSides ? right : left;
    this.applySideJoints(this.leftWing, L, -1);
    this.applySideJoints(this.rightWing, R, 1);
  }

  private applySideJoints(
    wing: WingAssembly | null,
    angles: JointAngles,
    dir: number,
  ): void {
    if (!wing) return;
    // Azimuth: yaw about bus +Y. Mirror sign so +azimuth folds both wings "forward" similarly.
    wing.azimuthPivot.rotation.set(0, THREE.MathUtils.degToRad(angles.azimuthDeg) * dir, 0);
    // Elevation: pitch about local +Z after azimuth. Positive raises solar face toward +Y.
    wing.elevationPivot.rotation.set(0, 0, THREE.MathUtils.degToRad(angles.elevationDeg) * dir);
    // Roll: twist about hinge / boom axis (local ±X). Mirror so +roll twists both wings similarly about boom-from-bus.
    wing.rollPivot.rotation.set(THREE.MathUtils.degToRad(angles.rollDeg) * dir, 0, 0);
  }

  /**
   * Accordion deploy: each hinge folds about local Z.
   * Stowed (t=0): panels stacked against bus (≈180° folds alternating).
   * Deployed (t=1): all folds = 0 (flat wing).
   * Composed on top of the 3-DOF azimuth → elevation → roll base pose.
   */
  private applyDeploy(t: number): void {
    this.applyWingDeploy(this.leftWing, -1, t);
    this.applyWingDeploy(this.rightWing, 1, t);
  }

  private applyWingDeploy(wing: WingAssembly | null, dir: number, t: number): void {
    if (!wing) return;
    const n = wing.segments.length;
    const eased = t * t * (3 - 2 * t); // smoothstep

    for (let i = 0; i < n; i++) {
      const stagger = n > 1 ? i / (n - 1) : 0;
      const localT = THREE.MathUtils.clamp((eased - stagger * 0.25) / (1 - stagger * 0.25 || 1), 0, 1);
      const stowAngle = Math.PI * 0.98;
      const sign = i % 2 === 0 ? 1 : -1;
      const angle = (1 - localT) * stowAngle * sign;
      wing.segments[i].hinge.rotation.set(0, 0, angle * dir);
    }
  }

  dispose(): void {
    this.disposeWing(this.leftWing);
    this.disposeWing(this.rightWing);
    this.busGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    disposeMaterials(this.mats);
  }
}
