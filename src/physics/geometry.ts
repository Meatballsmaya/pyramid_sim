// Segmented mirror mechanical geometry and actuator-PTT mapping
import { ActuatorCoord, ActuatorDisplacements, PTTMode, QuadrantId, QuadrantStates } from '../types/pwfs';

// Geometric parameters (aligned with MATLAB PWFS simulation)
export const DEFAULT_ROUT = 1.0;
export const DEFAULT_RIN = 0.4;
export const APERTURE_DIAMETER_MM = 100.0; // 100 mm physical pupil diameter

// Centroid of each quadrant (r ~ 0.67, angle ~ 45, 135, 225, 315 deg)
export const QUADRANT_CENTROIDS: Record<QuadrantId, { x: number; y: number }> = {
  Q1: { x: 0.474, y: 0.474 },
  Q2: { x: -0.474, y: 0.474 },
  Q3: { x: -0.474, y: -0.474 },
  Q4: { x: 0.474, y: -0.474 },
};

// 12 Actuators: 3 per quadrant arranged in a stable triangle
export const ACTUATORS: ActuatorCoord[] = [
  // Q1 (Top-Right)
  { id: 'c11', quadrant: 'Q1', index: 1, x: 0.34, y: 0.34, label: 'C11 (内弧)' },
  { id: 'c12', quadrant: 'Q1', index: 2, x: 0.78, y: 0.25, label: 'C12 (外角X)' },
  { id: 'c13', quadrant: 'Q1', index: 3, x: 0.25, y: 0.78, label: 'C13 (外角Y)' },

  // Q2 (Top-Left)
  { id: 'c21', quadrant: 'Q2', index: 1, x: -0.34, y: 0.34, label: 'C21 (内弧)' },
  { id: 'c22', quadrant: 'Q2', index: 2, x: -0.78, y: 0.25, label: 'C22 (外角X)' },
  { id: 'c23', quadrant: 'Q2', index: 3, x: -0.25, y: 0.78, label: 'C23 (外角Y)' },

  // Q3 (Bottom-Left)
  { id: 'c31', quadrant: 'Q3', index: 1, x: -0.34, y: -0.34, label: 'C31 (内弧)' },
  { id: 'c32', quadrant: 'Q3', index: 2, x: -0.78, y: -0.25, label: 'C32 (外角X)' },
  { id: 'c33', quadrant: 'Q3', index: 3, x: -0.25, y: -0.78, label: 'C33 (外角Y)' },

  // Q4 (Bottom-Right)
  { id: 'c41', quadrant: 'Q4', index: 1, x: 0.34, y: -0.34, label: 'C41 (内弧)' },
  { id: 'c42', quadrant: 'Q4', index: 2, x: 0.78, y: -0.25, label: 'C42 (外角X)' },
  { id: 'c43', quadrant: 'Q4', index: 3, x: 0.25, y: -0.78, label: 'C43 (外角Y)' },
];

// Invert 3x3 matrix helper
function invert3x3(m: number[][]): number[][] {
  const [a, b, c] = m[0];
  const [d, e, f] = m[1];
  const [g, h, i] = m[2];

  const det =
    a * (e * i - f * h) -
    b * (d * i - f * g) +
    c * (d * h - e * g);

  if (Math.abs(det) < 1e-12) {
    throw new Error('Singular geometry matrix for quadrant actuators');
  }

  const invDet = 1.0 / det;

  return [
    [
      (e * i - f * h) * invDet,
      (c * h - b * i) * invDet,
      (b * f - c * e) * invDet,
    ],
    [
      (f * g - d * i) * invDet,
      (a * i - c * g) * invDet,
      (c * d - a * f) * invDet,
    ],
    [
      (d * h - e * g) * invDet,
      (g * b - a * h) * invDet,
      (a * e - b * d) * invDet,
    ],
  ];
}

// Build geometry matrices G_q: [d1, d2, d3]^T = G_q * [P, Tilt, Tip]^T
// where Tip is slope along Y (μrad converted to nm displacement across radius),
// Tilt is slope along X.
// Physical scale: 1 normalized unit in radius corresponds to R = APERTURE_DIAMETER_MM / 2 = 50 mm = 50,000,000 nm.
// If Tip is 1 μrad (1e-6 rad), over 1 norm unit (50 mm) displacement is 50,000,000 * 1e-6 = 50 nm.
export const SLOPE_SCALE_NM_PER_URAD = (APERTURE_DIAMETER_MM * 1e6 * 0.5) * 1e-6; // 50 nm per μrad per unit normalized length

export class QuadrantGeometry {
  public readonly G: Record<QuadrantId, number[][]>;
  public readonly G_inv: Record<QuadrantId, number[][]>;

  constructor() {
    this.G = {} as Record<QuadrantId, number[][]>;
    this.G_inv = {} as Record<QuadrantId, number[][]>;

    const quadrants: QuadrantId[] = ['Q1', 'Q2', 'Q3', 'Q4'];
    for (const q of quadrants) {
      const qActs = ACTUATORS.filter((a) => a.quadrant === q);
      const c = QUADRANT_CENTROIDS[q];

      // Row k: [1, (x_k - x_c) * scale, (y_k - y_c) * scale]
      const gMat = qActs.map((act) => [
        1.0,
        (act.x - c.x) * SLOPE_SCALE_NM_PER_URAD,
        (act.y - c.y) * SLOPE_SCALE_NM_PER_URAD,
      ]);

      this.G[q] = gMat;
      this.G_inv[q] = invert3x3(gMat);
    }
  }

  // PTT to Actuators
  public pttToActuators(quadrant: QuadrantId, ptt: PTTMode): [number, number, number] {
    const g = this.G[quadrant];
    const vec = [ptt.piston, ptt.tilt, ptt.tip];
    return [
      g[0][0] * vec[0] + g[0][1] * vec[1] + g[0][2] * vec[2],
      g[1][0] * vec[0] + g[1][1] * vec[1] + g[1][2] * vec[2],
      g[2][0] * vec[0] + g[2][1] * vec[1] + g[2][2] * vec[2],
    ];
  }

  // Actuators to PTT
  public actuatorsToPtt(quadrant: QuadrantId, d: [number, number, number]): PTTMode {
    const gInv = this.G_inv[quadrant];
    return {
      piston: gInv[0][0] * d[0] + gInv[0][1] * d[1] + gInv[0][2] * d[2],
      tilt: gInv[1][0] * d[0] + gInv[1][1] * d[1] + gInv[1][2] * d[2],
      tip: gInv[2][0] * d[0] + gInv[2][1] * d[1] + gInv[2][2] * d[2],
    };
  }

  // Convert full QuadrantStates (4xPTT) to 12 ActuatorDisplacements
  public allPttToActuators(states: QuadrantStates): ActuatorDisplacements {
    const res: ActuatorDisplacements = {};
    const quadrants: QuadrantId[] = ['Q1', 'Q2', 'Q3', 'Q4'];
    for (const q of quadrants) {
      const [d1, d2, d3] = this.pttToActuators(q, states[q]);
      const prefix = q.toLowerCase();
      res[`c${q[1]}1`] = d1;
      res[`c${q[1]}2`] = d2;
      res[`c${q[1]}3`] = d3;
    }
    return res;
  }

  // Convert 12 ActuatorDisplacements to QuadrantStates
  public allActuatorsToPtt(actuators: ActuatorDisplacements): QuadrantStates {
    const quadrants: QuadrantId[] = ['Q1', 'Q2', 'Q3', 'Q4'];
    const res: Partial<QuadrantStates> = {};
    for (const q of quadrants) {
      const idx = q[1];
      const d: [number, number, number] = [
        actuators[`c${idx}1`] ?? 0,
        actuators[`c${idx}2`] ?? 0,
        actuators[`c${idx}3`] ?? 0,
      ];
      res[q] = this.actuatorsToPtt(q, d);
    }
    return res as QuadrantStates;
  }
}

export const quadrantGeometry = new QuadrantGeometry();
