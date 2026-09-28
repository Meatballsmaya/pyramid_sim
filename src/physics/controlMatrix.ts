// Calibration and Closed-Loop Control Matrix Engine
// Builds Modal Push-Pull Interaction Matrix (IM) and computes Control Matrix (CM) via SVD.

import { PWFSEngine } from './pwfsEngine';
import { quadrantGeometry } from './geometry';
import {
  ActuatorDisplacements,
  CalibrationData,
  ClosedLoopStepRecord,
  PTTMode,
  QuadrantId,
  QuadrantStates,
} from '../types/pwfs';

export interface ModeDescriptor {
  index: number;
  quadrant: QuadrantId;
  type: 'piston' | 'tilt' | 'tip';
  label: string;
  pushDelta: number; // nm or μrad
  unit: string;
}

export const MODES_LIST: ModeDescriptor[] = [
  // Q1
  { index: 0, quadrant: 'Q1', type: 'piston', label: 'Q1 Piston', pushDelta: 30.0, unit: 'nm' },
  { index: 1, quadrant: 'Q1', type: 'tilt', label: 'Q1 Tilt (X)', pushDelta: 0.6, unit: 'μrad' },
  { index: 2, quadrant: 'Q1', type: 'tip', label: 'Q1 Tip (Y)', pushDelta: 0.6, unit: 'μrad' },

  // Q2
  { index: 3, quadrant: 'Q2', type: 'piston', label: 'Q2 Piston', pushDelta: 30.0, unit: 'nm' },
  { index: 4, quadrant: 'Q2', type: 'tilt', label: 'Q2 Tilt (X)', pushDelta: 0.6, unit: 'μrad' },
  { index: 5, quadrant: 'Q2', type: 'tip', label: 'Q2 Tip (Y)', pushDelta: 0.6, unit: 'μrad' },

  // Q3
  { index: 6, quadrant: 'Q3', type: 'piston', label: 'Q3 Piston', pushDelta: 30.0, unit: 'nm' },
  { index: 7, quadrant: 'Q3', type: 'tilt', label: 'Q3 Tilt (X)', pushDelta: 0.6, unit: 'μrad' },
  { index: 8, quadrant: 'Q3', type: 'tip', label: 'Q3 Tip (Y)', pushDelta: 0.6, unit: 'μrad' },

  // Q4
  { index: 9, quadrant: 'Q4', type: 'piston', label: 'Q4 Piston', pushDelta: 30.0, unit: 'nm' },
  { index: 10, quadrant: 'Q4', type: 'tilt', label: 'Q4 Tilt (X)', pushDelta: 0.6, unit: 'μrad' },
  { index: 11, quadrant: 'Q4', type: 'tip', label: 'Q4 Tip (Y)', pushDelta: 0.6, unit: 'μrad' },
];

export function createZeroQuadrantStates(): QuadrantStates {
  return {
    Q1: { piston: 0, tip: 0, tilt: 0 },
    Q2: { piston: 0, tip: 0, tilt: 0 },
    Q3: { piston: 0, tip: 0, tilt: 0 },
    Q4: { piston: 0, tip: 0, tilt: 0 },
  };
}

// Classical Jacobi eigenvalue solver for symmetric NxN matrix
function jacobiEigen(matrix: number[][], maxIter = 100): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  // Initialize V to identity
  const V: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );

  // Copy A
  const A: number[][] = matrix.map((row) => [...row]);

  for (let iter = 0; iter < maxIter; iter++) {
    // Find largest off-diagonal element
    let p = 0;
    let q = 1;
    let maxVal = Math.abs(A[0][1]);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const absVal = Math.abs(A[i][j]);
        if (absVal > maxVal) {
          maxVal = absVal;
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < 1e-14) {
      break; // Converged
    }

    const app = A[p][p];
    const aqq = A[q][q];
    const apq = A[p][q];

    const theta = (aqq - app) / (2.0 * apq);
    let t: number;
    if (theta >= 0) {
      t = 1.0 / (theta + Math.sqrt(theta * theta + 1.0));
    } else {
      t = -1.0 / (-theta + Math.sqrt(theta * theta + 1.0));
    }

    const c = 1.0 / Math.sqrt(t * t + 1.0);
    const s = t * c;
    const tau = s / (1.0 + c);

    A[p][p] = app - t * apq;
    A[q][q] = aqq + t * apq;
    A[p][q] = 0;
    A[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const aip = A[i][p];
        const aiq = A[i][q];
        A[i][p] = aip - s * (aiq + tau * aip);
        A[p][i] = A[i][p];
        A[i][q] = aiq + s * (aip - tau * aiq);
        A[q][i] = A[i][q];
      }
    }

    for (let i = 0; i < n; i++) {
      const vip = V[i][p];
      const viq = V[i][q];
      V[i][p] = vip - s * (viq + tau * vip);
      V[i][q] = viq + s * (vip - tau * viq);
    }
  }

  const eigenvalues = Array.from({ length: n }, (_, i) => A[i][i]);
  return { eigenvalues, eigenvectors: V };
}

export class ControlSystem {
  private engine: PWFSEngine;
  private calibration: CalibrationData | null = null;

  constructor(engine: PWFSEngine) {
    this.engine = engine;
  }

  public setEngine(engine: PWFSEngine): void {
    this.engine = engine;
    this.calibration = null; // Invalidate calibration on engine change
  }

  public getCalibration(): CalibrationData | null {
    return this.calibration;
  }

  // Push-pull calibration for 12 PTT modes
  public calibrate(onProgress?: (progress: number, label: string) => void): CalibrationData {
    const engine = this.engine;
    const zeroStates = createZeroQuadrantStates();

    // 1. Reference signal at perfect zero alignment
    const refResult = engine.simulate(zeroStates);
    const refCombined = engine.extractSignalVector(refResult.sx, refResult.sy);
    const validIndices = engine.validSubPixelIndices;
    const m2 = refCombined.length; // 2 * validSubPixels
    const numModes = MODES_LIST.length; // 12

    // Initialize Interaction Matrix IM of size (2M) x 12
    const IM: number[][] = Array.from({ length: m2 }, () => new Array<number>(numModes));

    // 2. Iterate each mode using push-pull
    for (let j = 0; j < numModes; j++) {
      const mode = MODES_LIST[j];
      const delta = mode.pushDelta;

      if (onProgress) {
        onProgress((j / numModes) * 0.8, `正在标定模式 ${j + 1}/12: ${mode.label} (±${delta}${mode.unit})`);
      }

      // Positive push
      const pushStates = createZeroQuadrantStates();
      pushStates[mode.quadrant][mode.type] = delta;
      const pushResult = engine.simulate(pushStates);
      const pushSignal = engine.extractSignalVector(pushResult.sx, pushResult.sy);

      // Negative pull
      const pullStates = createZeroQuadrantStates();
      pullStates[mode.quadrant][mode.type] = -delta;
      const pullResult = engine.simulate(pullStates);
      const pullSignal = engine.extractSignalVector(pullResult.sx, pullResult.sy);

      // Derivative column: (S_push - S_pull) / (2 * delta)
      const invTwoDelta = 1.0 / (2.0 * delta);
      for (let i = 0; i < m2; i++) {
        IM[i][j] = (pushSignal[i] - pullSignal[i]) * invTwoDelta;
      }
    }

    if (onProgress) {
      onProgress(0.85, '正在进行 SVD 奇异值分解与控制矩阵求逆...');
    }

    // 3. Compute A = IM^T * IM (12 x 12 symmetric matrix)
    const A: number[][] = Array.from({ length: numModes }, () => new Array<number>(numModes).fill(0));
    for (let r = 0; r < numModes; r++) {
      for (let c = r; c < numModes; c++) {
        let sum = 0;
        for (let k = 0; k < m2; k++) {
          sum += IM[k][r] * IM[k][c];
        }
        A[r][c] = sum;
        A[c][r] = sum;
      }
    }

    // 4. Eigendecomposition of A
    const { eigenvalues, eigenvectors: V } = jacobiEigen(A);

    // Compute singular values: sigma_j = sqrt(lambda_j)
    const singularValues: number[] = [];
    for (let i = 0; i < numModes; i++) {
      const lambda = Math.max(0, eigenvalues[i]);
      singularValues.push(Math.sqrt(lambda));
    }

    // Sort singular values descending
    const indices = Array.from({ length: numModes }, (_, i) => i);
    indices.sort((a, b) => singularValues[b] - singularValues[a]);

    const sortedSingularValues = indices.map((i) => singularValues[i]);
    const sortedV: number[][] = Array.from({ length: numModes }, (_, r) =>
      indices.map((c) => V[r][c])
    );

    const maxSigma = sortedSingularValues[0];
    const minSigma = sortedSingularValues[numModes - 1];
    const conditionNumber = minSigma > 1e-9 ? maxSigma / minSigma : Infinity;

    // 5. Compute Pseudo-inverse A_inv = V * diag(1 / (sigma_i^2 + alpha)) * V^T
    // Tikhonov damping factor for numerical regularization
    const alpha = 1e-7;
    const A_inv: number[][] = Array.from({ length: numModes }, () => new Array<number>(numModes).fill(0));

    for (let i = 0; i < numModes; i++) {
      for (let j = 0; j < numModes; j++) {
        let sum = 0;
        for (let k = 0; k < numModes; k++) {
          const s = sortedSingularValues[k];
          const invVal = s / (s * s * s + alpha); // corresponds to 1/(s^2) damped
          sum += sortedV[i][k] * invVal * sortedV[j][k];
        }
        A_inv[i][j] = sum;
      }
    }

    // 6. Control Matrix: CM = A_inv * IM^T of size 12 x (2M)
    const CM: number[][] = Array.from({ length: numModes }, () => new Array<number>(m2));
    for (let modeIdx = 0; modeIdx < numModes; modeIdx++) {
      for (let pixIdx = 0; pixIdx < m2; pixIdx++) {
        let sum = 0;
        for (let k = 0; k < numModes; k++) {
          sum += A_inv[modeIdx][k] * IM[pixIdx][k];
        }
        CM[modeIdx][pixIdx] = sum;
      }
    }

    if (onProgress) {
      onProgress(1.0, '标定完成！');
    }

    this.calibration = {
      interactionMatrix: IM,
      controlMatrix: CM,
      singularValues: sortedSingularValues,
      conditionNumber,
      validPixelIndices: validIndices,
      referenceSlopes: {
        sx: refResult.sx,
        sy: refResult.sy,
        combined: refCombined,
      },
      timestamp: Date.now(),
    };

    return this.calibration;
  }

  // Execute a single closed-loop iteration
  public step(
    currentActuators: ActuatorDisplacements,
    loopGain: number = 0.6
  ): {
    newActuators: ActuatorDisplacements;
    deltaModes: number[];
    deltaActuators: ActuatorDisplacements;
    stepRecord: ClosedLoopStepRecord;
    simResult: ReturnType<PWFSEngine['simulate']>;
  } {
    if (!this.calibration) {
      throw new Error('System must be calibrated before running closed-loop control');
    }

    // 1. Current mirror PTT state from actuators
    const currentStates = quadrantGeometry.allActuatorsToPtt(currentActuators);

    // 2. Optical simulation with PWFS
    const simResult = this.engine.simulate(currentStates);
    const measuredSignal = this.engine.extractSignalVector(simResult.sx, simResult.sy);

    // 3. Signal error: deltaS = measuredSignal - refSignal
    const refSignal = this.calibration.referenceSlopes.combined;
    const m2 = measuredSignal.length;
    const deltaS = new Array<number>(m2);
    for (let i = 0; i < m2; i++) {
      deltaS[i] = measuredSignal[i] - refSignal[i];
    }

    // 4. Mode reconstruction: deltaModes = CM * deltaS
    const CM = this.calibration.controlMatrix;
    const numModes = MODES_LIST.length; // 12
    const deltaModes = new Array<number>(numModes);

    for (let j = 0; j < numModes; j++) {
      let sum = 0;
      const row = CM[j];
      for (let i = 0; i < m2; i++) {
        sum += row[i] * deltaS[i];
      }
      deltaModes[j] = sum;
    }

    // 5. Format delta modes into QuadrantStates
    const deltaStates: QuadrantStates = {
      Q1: { piston: deltaModes[0], tilt: deltaModes[1], tip: deltaModes[2] },
      Q2: { piston: deltaModes[3], tilt: deltaModes[4], tip: deltaModes[5] },
      Q3: { piston: deltaModes[6], tilt: deltaModes[7], tip: deltaModes[8] },
      Q4: { piston: deltaModes[9], tilt: deltaModes[10], tip: deltaModes[11] },
    };

    // 6. Convert delta modes to actuator adjustments via geometry matrix G
    const deltaActuators = quadrantGeometry.allPttToActuators(deltaStates);

    // 7. Apply negative feedback: Actuators_new = Actuators_old - gain * deltaActuators
    const newActuators: ActuatorDisplacements = {};
    let maxActError = 0;

    for (const key of Object.keys(currentActuators)) {
      const oldVal = currentActuators[key] ?? 0;
      const adjustment = deltaActuators[key] ?? 0;
      const newVal = oldVal - loopGain * adjustment;
      newActuators[key] = newVal;

      const absErr = Math.abs(newVal);
      if (absErr > maxActError) maxActError = absErr;
    }

    // 8. Record step diagnostics
    const stepRecord: ClosedLoopStepRecord = {
      step: 0, // caller sets step number
      rmsOpd: simResult.rmsOpd,
      quadrantPiston: {
        Q1: currentStates.Q1.piston,
        Q2: currentStates.Q2.piston,
        Q3: currentStates.Q3.piston,
        Q4: currentStates.Q4.piston,
      },
      quadrantTip: {
        Q1: currentStates.Q1.tip,
        Q2: currentStates.Q2.tip,
        Q3: currentStates.Q3.tip,
        Q4: currentStates.Q4.tip,
      },
      quadrantTilt: {
        Q1: currentStates.Q1.tilt,
        Q2: currentStates.Q2.tilt,
        Q3: currentStates.Q3.tilt,
        Q4: currentStates.Q4.tilt,
      },
      maxActuatorError: maxActError,
      actuators: { ...currentActuators },
    };

    return {
      newActuators,
      deltaModes,
      deltaActuators,
      stepRecord,
      simResult,
    };
  }
}
