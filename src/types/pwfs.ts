// Types and interfaces for the PWFS Segmented Mirror Co-Phasing System

export type QuadrantId = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export interface PTTMode {
  piston: number; // in nanometers (nm)
  tip: number;    // around X-axis, in microradians (μrad)
  tilt: number;   // around Y-axis, in microradians (μrad)
}

export type QuadrantStates = Record<QuadrantId, PTTMode>;

export interface ActuatorCoord {
  id: string;
  quadrant: QuadrantId;
  index: 1 | 2 | 3;
  x: number; // normalized coordinate [-1, 1]
  y: number;
  label: string;
}

export interface ActuatorDisplacements {
  [key: string]: number; // in nanometers (nm)
}

export interface PWFSConfig {
  wavelength: number;      // nm, default 632.8 nm (HeNe)
  gridSize: number;        // N, default 128
  rout: number;            // outer radius, default 0.90
  rin: number;             // inner radius (reference mirror boundary), default 0.38
  pyramidShift: number;    // pyramid tip shift factor in focal plane
  gain: number;            // closed loop gain (0.1 - 1.0)
  loopSpeedMs: number;     // ms per closed-loop step (50 - 1000)
}

export interface CalibrationData {
  interactionMatrix: number[][]; // (2M) x 12
  controlMatrix: number[][];     // 12 x (2M)
  singularValues: number[];      // 12 singular values
  conditionNumber: number;
  validPixelIndices: number[];   // indices of valid pupil pixels
  referenceSlopes: {
    sx: Float32Array;
    sy: Float32Array;
    combined: number[];
  };
  timestamp: number;
}

export interface ClosedLoopStepRecord {
  step: number;
  rmsOpd: number;               // nm
  quadrantPiston: Record<QuadrantId, number>; // nm
  quadrantTip: Record<QuadrantId, number>;    // μrad
  quadrantTilt: Record<QuadrantId, number>;   // μrad
  maxActuatorError: number;     // nm
  actuators: ActuatorDisplacements;
}

export interface PWFSSimulationResult {
  pupilPhase: Float32Array;      // Phase map (radians)
  pupilOpd: Float32Array;        // OPD map (nm)
  pupilMask: Uint8Array;         // 1 = active, 0 = inactive
  detectorIntensity: Float32Array; // 4 pupil detector image (Pupil conjugate plane)
  focalPlaneIntensity: Float32Array; // Focal plane PSF on pyramid apex (Focal plane)
  sx: Float32Array;              // X-slope
  sy: Float32Array;              // Y-slope
  sxResidual: Float32Array;      // Sx with quadrant-average slope removed (pure Hilbert edge)
  syResidual: Float32Array;      // Sy with quadrant-average slope removed (pure Hilbert edge)
  rmsOpd: number;                // RMS OPD across active outer quadrants (nm)
  peakToValley: number;          // PV OPD (nm)
}
