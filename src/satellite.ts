import * as THREE from 'three';
import { BUS, type JointAngles, type SatelliteParams, type WingParams } from './types';
import { createMaterials, disposeMaterials, type SatelliteMaterials } from './materials';

export type WingSide = 'left' | 'right';

interface PanelSegment {
  hinge: THREE.Object3D;
  mesh: THREE.Mesh;
}

interface WingAssembly {
  /** Root attached to bus side; receives azimuth (Y) then elevation (Z) */
  root: THREE.Object3D;
  azimuthPivot: THREE.Object3D;
  elevationPivot: THREE.Object3D;
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
 * Joint DOF (each side):
 *   Azimuth  — yaw about bus +Y
 *   Elevation — pitch about local +Z (after azimuth)
 *
 * Deploy folds accordion-style about local +Z at each panel hinge.
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

    // Thin dark chassis
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(W, H, L),
      this.mats.bus,
    );
    body.castShadow = true;
    body.receiveShadow = true;
    body.name = 'BusBody';
    this.busGroup.add(body);

    // Slight bevel lip / radiator edge strip
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.02, H * 0.35, L + 0.02),
      this.mats.solarFrame,
    );
    lip.position.y = -H * 0.28;
    lip.castShadow = true;
    this.busGroup.add(lip);

    // Phased-array antenna on -Y face
    const antenna = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.96, antennaThickness, L * 0.94),
      this.mats.antenna,
    );
    antenna.position.y = -(H / 2 + antennaThickness / 2);
    antenna.receiveShadow = true;
    antenna.name = 'AntennaFace';
    this.busGroup.add(antenna);

    // Small bus details: thruster pods at Z ends
    for (const sign of [-1, 1]) {
      const pod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.07, 0.12, 12),
        this.mats.yoke,
      );
      pod.rotation.z = Math.PI / 2;
      pod.position.set(0, 0, sign * (L / 2 + 0.04));
      this.busGroup.add(pod);
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

    const azimuthPivot = new THREE.Object3D();
    azimuthPivot.name = `Azimuth_${side}`;
    root.add(azimuthPivot);

    const elevationPivot = new THREE.Object3D();
    elevationPivot.name = `Elevation_${side}`;
    azimuthPivot.add(elevationPivot);

    // Short yoke / boom from bus edge to first panel hinge
    const yokeLen = BUS.yokeLength;
    const yoke = new THREE.Mesh(
      new THREE.CylinderGeometry(BUS.yokeRadius, BUS.yokeRadius * 0.9, yokeLen, 10),
      this.mats.yoke,
    );
    yoke.rotation.z = Math.PI / 2;
    yoke.position.set(dir * (yokeLen / 2), 0, 0);
    yoke.castShadow = true;
    elevationPivot.add(yoke);

    // Chain of panel segments with fold hinges
    const chainAnchor = new THREE.Object3D();
    chainAnchor.position.set(dir * yokeLen, 0, 0);
    elevationPivot.add(chainAnchor);

    const segments: PanelSegment[] = [];
    let parent: THREE.Object3D = chainAnchor;

    for (let i = 0; i < n; i++) {
      const hinge = new THREE.Object3D();
      hinge.name = `FoldHinge_${side}_${i}`;
      // First hinge at yoke tip; subsequent at outer edge of previous panel
      if (i === 0) {
        hinge.position.set(0, 0, 0);
      } else {
        hinge.position.set(dir * panelLength, 0, 0);
      }
      parent.add(hinge);

      const panel = this.createPanelMesh(panelLength, panelWidth, side, i);
      // Panel extends outward from hinge along ±X
      panel.position.set(dir * (panelLength / 2), 0, 0);
      hinge.add(panel);

      segments.push({ hinge, mesh: panel });
      parent = hinge;
    }

    return {
      root,
      azimuthPivot,
      elevationPivot,
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
    const thickness = 0.028;
    const geom = new THREE.BoxGeometry(length * 0.98, thickness, width * 0.98);
    const mesh = new THREE.Mesh(geom, this.mats.solar);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `SolarPanel_${side}_${index}`;

    // Thin frame rim as child
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(length, thickness * 1.15, width),
      this.mats.solarFrame,
    );
    frame.scale.set(1.01, 0.7, 1.01);
    frame.position.y = -thickness * 0.15;
    mesh.add(frame);

    // Slight UV repeat based on aspect
    const mat = this.mats.solar;
    if (mat.map) {
      // Shared texture — per-mesh clone would be heavy; leave as-is
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
  }

  /**
   * Accordion deploy: each hinge folds about local Z.
   * Stowed (t=0): panels stacked against bus (≈180° folds alternating).
   * Deployed (t=1): all folds = 0 (flat wing).
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
      // Root fold starts more closed; outer panels trail slightly for a nicer cascade
      const stagger = n > 1 ? i / (n - 1) : 0;
      const localT = THREE.MathUtils.clamp((eased - stagger * 0.25) / (1 - stagger * 0.25 || 1), 0, 1);
      const stowAngle = Math.PI * 0.98; // nearly 180° fold
      // Alternate fold direction for accordion stack
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
