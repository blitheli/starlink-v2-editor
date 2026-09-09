/** Parametric Starlink V2 satellite configuration */

export interface WingParams {
  /** Length of each basic solar panel segment (meters) */
  panelLength: number;
  /** Width of each basic solar panel segment (meters) */
  panelWidth: number;
  /**
   * Total number of basic panels (integer ≥ 1).
   * Even preferred: floor(n/2) panels per side (mirror-symmetric).
   * Odd values are allowed but remainder is dropped with a UI warning.
   */
  panelCount: number;
}

/**
 * Wing–bus joint angles (degrees).
 * Pivot order in the scene graph: azimuth → elevation → roll (hinge twist).
 */
export interface JointAngles {
  /** Azimuth / yaw around bus +Y (up), degrees */
  azimuthDeg: number;
  /** Elevation / pitch around local +Z (after azimuth), degrees */
  elevationDeg: number;
  /**
   * Roll / twist about the hinge (boom / wing-span axis), degrees.
   * Applied about local +X after azimuth + elevation; same sign on both sides (not mirrored by side dir).
   */
  rollDeg: number;
}

export interface SideJoints {
  left: JointAngles;
  right: JointAngles;
}

export interface SatelliteParams {
  wings: WingParams;
  joints: SideJoints;
  /** When true, left and right joints are edited independently */
  unlockSides: boolean;
}

export const DEFAULT_PARAMS: SatelliteParams = {
  wings: {
    panelLength: 1.35,
    panelWidth: 1.55,
    panelCount: 8,
  },
  joints: {
    left: { azimuthDeg: 0, elevationDeg: 0, rollDeg: 0 },
    right: { azimuthDeg: 0, elevationDeg: 0, rollDeg: 0 },
  },
  unlockSides: false,
};

/** Fixed bus dimensions tuned for a recognizable V2 flat-panel look (meters). */
export const BUS = {
  length: 2.9,
  width: 1.55,
  height: 0.18,
  antennaThickness: 0.035,
  yokeLength: 0.28,
  yokeRadius: 0.035,
} as const;
