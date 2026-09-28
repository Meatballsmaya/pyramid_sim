// =========================================================================
// PWFS Optical Simulation Engine
// Faithfully implements MATLAB 2D Fourier optics wave propagation:
// 1. Entrance pupil with central reference mirror + 4 outer quadrants
// 2. Complex pupil field E_pupil = Amplitude .* exp(1i * Phase)
// 3. First lens propagation: E_focal = fftshift(fft2(ifftshift(E_pupil)))
// 4. Pyramid phase mask: exp(-1i * (2*pi/N) * shift_dist * (|u| + |v|))
// 5. Second lens propagation: E_detector = fftshift(ifft2(ifftshift(E_focal_masked)))
// 6. True physical detector intensity: I_detector = abs(E_detector).^2
// 7. Slope signals Sx, Sy extracted via quad-cell difference-over-sum
// =========================================================================

import { FFT2D } from './fft';
import { DEFAULT_RIN, DEFAULT_ROUT } from './geometry';
import { PWFSConfig, PWFSSimulationResult, QuadrantId, QuadrantStates } from '../types/pwfs';

export class PWFSEngine {
  public readonly config: PWFSConfig;
  public readonly n: number;         // Detector & simulation grid size N (256)
  public readonly halfN: number;     // N / 2 (128)
  public readonly quarterN: number;  // N / 4 (64, shift distance & pupil radius)
  public readonly subN: number;      // Sub-pupil / slope grid size (128)
  private readonly fft: FFT2D;

  // Normalized entrance grid (x, y in [-2, 2], pupil radius R_out = 1.0)
  public readonly xGrid: Float32Array;
  public readonly yGrid: Float32Array;
  public readonly rGrid: Float32Array;
  public readonly fullPupilMask: Uint8Array;
  public readonly centerMask: Uint8Array;
  public readonly quadrantMasks: Record<QuadrantId, Uint8Array>;

  // Quadrant geometric centroids for rotation pivot
  public readonly xc: Record<QuadrantId, number>;
  public readonly yc: Record<QuadrantId, number>;

  // Sub-pupil slope grid
  public readonly subPupilMask: Uint8Array;
  public readonly validSubPixelIndices: number[];

  // Real & Imaginary buffers for FFT
  private readonly eReal: Float64Array;
  private readonly eImag: Float64Array;

  // Output buffers
  public readonly detectorImage: Float32Array;
  public readonly refSx: Float32Array;
  public readonly refSy: Float32Array;

  constructor(config?: Partial<PWFSConfig>) {
    this.n = config?.gridSize ?? 256;
    this.halfN = this.n / 2;
    this.quarterN = this.n / 4;
    this.subN = this.halfN; // 128 for N=256

    this.config = {
      wavelength: config?.wavelength ?? 632.0, // nm
      gridSize: this.n,
      rout: config?.rout ?? DEFAULT_ROUT,      // 1.0
      rin: config?.rin ?? DEFAULT_RIN,        // 0.4
      pyramidShift: config?.pyramidShift ?? this.quarterN,
      gain: config?.gain ?? 0.6,
      loopSpeedMs: config?.loopSpeedMs ?? 100,
    };

    this.fft = new FFT2D(this.n);

    const totalFull = this.n * this.n;
    this.xGrid = new Float32Array(totalFull);
    this.yGrid = new Float32Array(totalFull);
    this.rGrid = new Float32Array(totalFull);
    this.fullPupilMask = new Uint8Array(totalFull);
    this.centerMask = new Uint8Array(totalFull);
    this.quadrantMasks = {
      Q1: new Uint8Array(totalFull),
      Q2: new Uint8Array(totalFull),
      Q3: new Uint8Array(totalFull),
      Q4: new Uint8Array(totalFull),
    };

    this.xc = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    this.yc = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

    const totalSub = this.subN * this.subN;
    this.subPupilMask = new Uint8Array(totalSub);
    this.validSubPixelIndices = [];

    this.eReal = new Float64Array(totalFull);
    this.eImag = new Float64Array(totalFull);
    this.detectorImage = new Float32Array(totalFull);
    this.refSx = new Float32Array(totalSub);
    this.refSy = new Float32Array(totalSub);

    this.initGrids();
    this.initReferenceSlopes();
  }

  // Initialize grids matching MATLAB: [x, y] = meshgrid((-N/2 : N/2-1) / (N/4))
  private initGrids(): void {
    const N = this.n;
    const halfN = this.halfN;
    const quarterN = this.quarterN;
    const R_in = this.config.rin;   // 0.4
    const R_out = this.config.rout; // 1.0

    const counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const sumX = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
    const sumY = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

    for (let j = 0; j < N; j++) {
      // y coordinate: j goes from 0 to N-1
      // In MATLAB meshgrid, y(j, i) = (-N/2 + j) / (N/4)
      const yVal = (j - halfN) / quarterN;

      for (let i = 0; i < N; i++) {
        // x coordinate: i goes from 0 to N-1
        const xVal = (i - halfN) / quarterN;
        const idx = j * N + i;

        this.xGrid[idx] = xVal;
        this.yGrid[idx] = yVal;
        const rVal = Math.sqrt(xVal * xVal + yVal * yVal);
        this.rGrid[idx] = rVal;

        if (rVal <= R_in) {
          this.centerMask[idx] = 1;
          this.fullPupilMask[idx] = 1;
        } else if (rVal <= R_out) {
          this.fullPupilMask[idx] = 1;
          if (xVal >= 0 && yVal >= 0) {
            this.quadrantMasks.Q1[idx] = 1;
            sumX.Q1 += xVal;
            sumY.Q1 += yVal;
            counts.Q1++;
          } else if (xVal < 0 && yVal >= 0) {
            this.quadrantMasks.Q2[idx] = 1;
            sumX.Q2 += xVal;
            sumY.Q2 += yVal;
            counts.Q2++;
          } else if (xVal < 0 && yVal < 0) {
            this.quadrantMasks.Q3[idx] = 1;
            sumX.Q3 += xVal;
            sumY.Q3 += yVal;
            counts.Q3++;
          } else if (xVal >= 0 && yVal < 0) {
            this.quadrantMasks.Q4[idx] = 1;
            sumX.Q4 += xVal;
            sumY.Q4 += yVal;
            counts.Q4++;
          }
        }
      }
    }

    // Centroids of quadrants (rotation pivot)
    const qIds: QuadrantId[] = ['Q1', 'Q2', 'Q3', 'Q4'];
    for (const q of qIds) {
      if (counts[q] > 0) {
        this.xc[q] = sumX[q] / counts[q];
        this.yc[q] = sumY[q] / counts[q];
      }
    }

    // Sub-pupil mask (r_sub <= 1.0)
    const subN = this.subN;
    const subHalf = subN / 2;
    const subQuarter = subN / 2; // radius of sub-pupil is subN / 2
    for (let r = 0; r < subN; r++) {
      const y = (r - subHalf) / subQuarter;
      for (let c = 0; c < subN; c++) {
        const x = (c - subHalf) / subQuarter;
        const subIdx = r * subN + c;
        if (x * x + y * y <= 1.05) {
          this.subPupilMask[subIdx] = 1;
          this.validSubPixelIndices.push(subIdx);
        }
      }
    }
  }

  // Precompute flat baseline reference slopes (identically zero for symmetric optics)
  private initReferenceSlopes(): void {
    const zeroStates: QuadrantStates = {
      Q1: { piston: 0, tilt: 0, tip: 0 },
      Q2: { piston: 0, tilt: 0, tip: 0 },
      Q3: { piston: 0, tilt: 0, tip: 0 },
      Q4: { piston: 0, tilt: 0, tip: 0 },
    };
    const res = this.simulate(zeroStates);
    for (let i = 0; i < this.subN * this.subN; i++) {
      this.refSx[i] = res.sx[i];
      this.refSy[i] = res.sy[i];
    }
  }

  // Generate entrance pupil OPD (nm) and Phase (rad) exactly matching MATLAB Step 3
  public generateWavefront(states: QuadrantStates): { opd: Float32Array; phase: Float32Array } {
    const totalPixels = this.n * this.n;
    const opd = new Float32Array(totalPixels);
    const phase = new Float32Array(totalPixels);
    const lambda = this.config.wavelength; // nm

    const quadrants: QuadrantId[] = ['Q1', 'Q2', 'Q3', 'Q4'];

    for (const q of quadrants) {
      const state = states[q];
      const p = state.piston;
      const tiltX = state.tilt;
      const tiltY = state.tip;

      if (p === 0 && tiltX === 0 && tiltY === 0) continue;

      // MATLAB: phase_piston = (4 * pi * piston_nm) / lambda
      const phasePiston = (4.0 * Math.PI * p) / lambda;
      const mask = this.quadrantMasks[q];
      const xc = this.xc[q];
      const yc = this.yc[q];

      // Conversion factor: Phase = (4 * pi / lambda) * OPD
      // OPD = Phase * lambda / (4 * pi)
      const opdFactor = lambda / (4.0 * Math.PI);

      for (let i = 0; i < totalPixels; i++) {
        if (mask[i] === 1) {
          // MATLAB: Phase(pupil_Q1) = phase_piston + tilt_x_coef * (x - xc) + tilt_y_coef * (y - yc)
          const phi = phasePiston + tiltX * (this.xGrid[i] - xc) + tiltY * (this.yGrid[i] - yc);
          phase[i] = phi;
          opd[i] = phi * opdFactor;
        }
      }
    }

    return { opd, phase };
  }

  // Run full PWFS simulation following MATLAB code steps 1 to 7
  public simulate(states: QuadrantStates): PWFSSimulationResult {
    const N = this.n;
    const halfN = this.halfN;
    const quarterN = this.quarterN;
    const subN = this.subN;
    const totalFull = N * N;
    const totalSub = subN * subN;

    // 1. Generate entrance wavefront
    const { opd, phase } = this.generateWavefront(states);

    // 2. Build E_pupil = Amplitude .* exp(1i * Phase)
    // Amplitude = pupil_center + pupil_Q1 + pupil_Q2 + pupil_Q3 + pupil_Q4
    for (let i = 0; i < totalFull; i++) {
      if (this.fullPupilMask[i] === 1) {
        const phi = phase[i];
        this.eReal[i] = Math.cos(phi);
        this.eImag[i] = Math.sin(phi);
      } else {
        this.eReal[i] = 0;
        this.eImag[i] = 0;
      }
    }

    // 3. First lens: E_focal = fftshift(fft2(ifftshift(E_pupil)))
    FFT2D.fftshift(this.eReal, N);
    FFT2D.fftshift(this.eImag, N);
    this.fft.forward2D(this.eReal, this.eImag);
    FFT2D.fftshift(this.eReal, N);
    FFT2D.fftshift(this.eImag, N);

    // Compute focal plane PSF for inspection (zoomed central subN x subN region)
    const focalPlaneIntensity = new Float32Array(totalSub);
    const startOffset = Math.floor(N / 4); // start index to center subN in N
    let maxFoc = 0;
    for (let r = 0; r < subN; r++) {
      const srcRow = (startOffset + r) * N;
      for (let c = 0; c < subN; c++) {
        const srcIdx = srcRow + (startOffset + c);
        const val = this.eReal[srcIdx] * this.eReal[srcIdx] + this.eImag[srcIdx] * this.eImag[srcIdx];
        focalPlaneIntensity[r * subN + c] = val;
        if (val > maxFoc) maxFoc = val;
      }
    }
    if (maxFoc > 1e-12) {
      const invMax = 1.0 / maxFoc;
      for (let i = 0; i < totalSub; i++) {
        focalPlaneIntensity[i] *= invMax;
      }
    }

    // 4. Pyramid phase mask
    // [u, v] = meshgrid(-N/2 : N/2-1);
    // shift_dist = N/4; 
    // pyramid_mask = exp(-1i * (2*pi/N) * shift_dist * (abs(u) + abs(v)));
    // E_focal_masked = E_focal .* pyramid_mask;
    const shiftDist = quarterN;
    const kShift = (2.0 * Math.PI / N) * shiftDist;

    for (let j = 0; j < N; j++) {
      const v = Math.abs(j - halfN);
      const rowOffset = j * N;
      for (let i = 0; i < N; i++) {
        const u = Math.abs(i - halfN);
        const angle = -kShift * (u + v);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const idx = rowOffset + i;

        const re = this.eReal[idx];
        const im = this.eImag[idx];
        this.eReal[idx] = re * cosA - im * sinA;
        this.eImag[idx] = re * sinA + im * cosA;
      }
    }

    // 5. Second lens: E_detector = fftshift(ifft2(ifftshift(E_focal_masked)))
    FFT2D.fftshift(this.eReal, N);
    FFT2D.fftshift(this.eImag, N);
    this.fft.inverse2D(this.eReal, this.eImag);
    FFT2D.fftshift(this.eReal, N);
    FFT2D.fftshift(this.eImag, N);

    // 6. True physical detector intensity: I_detector = abs(E_detector).^2
    // NO hardcoded artificial overrides; completely reactive to phase aberrations!
    for (let i = 0; i < totalFull; i++) {
      this.detectorImage[i] = this.eReal[i] * this.eReal[i] + this.eImag[i] * this.eImag[i];
    }

    // 7. Extract signals Sx, Sy exactly matching MATLAB Step 7:
    // I_TL = I_detector(1:N/2, 1:N/2);     
    // I_TR = I_detector(1:N/2, N/2+1:N);   
    // I_BL = I_detector(N/2+1:N, 1:N/2);   
    // I_BR = I_detector(N/2+1:N, N/2+1:N); 
    // I_norm = I_TL + I_TR + I_BL + I_BR;  
    // epsilon = max(I_norm(:)) * 0.01;     
    // Sx = ((I_TR + I_BR) - (I_TL + I_BL)) ./ (I_norm + epsilon);
    // Sy = ((I_TL + I_TR) - (I_BL + I_BR)) ./ (I_norm + epsilon);
    // mask_plot = I_norm > epsilon * 2;
    // Sx = Sx .* mask_plot;
    // Sy = Sy .* mask_plot;

    const I_TL = new Float32Array(totalSub);
    const I_TR = new Float32Array(totalSub);
    const I_BL = new Float32Array(totalSub);
    const I_BR = new Float32Array(totalSub);
    const I_norm = new Float32Array(totalSub);

    let maxInorm = 0;
    for (let r = 0; r < halfN; r++) {
      const topRow = r * N;
      const botRow = (r + halfN) * N;
      const subRow = r * halfN;

      for (let c = 0; c < halfN; c++) {
        const subIdx = subRow + c;
        const vTL = this.detectorImage[topRow + c];
        const vTR = this.detectorImage[topRow + (c + halfN)];
        const vBL = this.detectorImage[botRow + c];
        const vBR = this.detectorImage[botRow + (c + halfN)];

        I_TL[subIdx] = vTL;
        I_TR[subIdx] = vTR;
        I_BL[subIdx] = vBL;
        I_BR[subIdx] = vBR;

        const norm = vTL + vTR + vBL + vBR;
        I_norm[subIdx] = norm;
        if (norm > maxInorm) maxInorm = norm;
      }
    }

    const epsilon = maxInorm * 0.01;
    const threshold = epsilon * 2.0;
    const sx = new Float32Array(totalSub);
    const sy = new Float32Array(totalSub);
    const sxResidual = new Float32Array(totalSub);
    const syResidual = new Float32Array(totalSub);

    for (let i = 0; i < totalSub; i++) {
      const norm = I_norm[i];
      if (norm > threshold) {
        sx[i] = ((I_TR[i] + I_BR[i]) - (I_TL[i] + I_BL[i])) / (norm + epsilon);
        sy[i] = ((I_TL[i] + I_TR[i]) - (I_BL[i] + I_BR[i])) / (norm + epsilon);
      }
    }

    // 8. Hilbert residuals (subtract quadrant-average slope to isolate high-frequency edge jumps)
    this.calculateHilbertResiduals(sx, sy, sxResidual, syResidual);

    // 9. RMS OPD and PV over active segmented mirrors (excluding reference mirror)
    let sumSq = 0;
    let count = 0;
    let minVal = Infinity;
    let maxVal = -Infinity;

    for (let i = 0; i < totalFull; i++) {
      if (
        this.quadrantMasks.Q1[i] === 1 ||
        this.quadrantMasks.Q2[i] === 1 ||
        this.quadrantMasks.Q3[i] === 1 ||
        this.quadrantMasks.Q4[i] === 1
      ) {
        const val = opd[i];
        sumSq += val * val;
        count++;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }

    const rmsOpd = count > 0 ? Math.sqrt(sumSq / count) : 0;
    const peakToValley = count > 0 && maxVal > minVal ? maxVal - minVal : 0;

    return {
      pupilPhase: phase,
      pupilOpd: opd,
      pupilMask: this.fullPupilMask,
      detectorIntensity: this.detectorImage,
      focalPlaneIntensity,
      sx,
      sy,
      sxResidual,
      syResidual,
      rmsOpd,
      peakToValley,
    };
  }

  // Calculate Hilbert residuals by removing average quadrant tilt/tip
  private calculateHilbertResiduals(
    sx: Float32Array,
    sy: Float32Array,
    sxRes: Float32Array,
    syRes: Float32Array
  ): void {
    const subN = this.subN;
    const subHalf = subN / 2;
    const subQuarter = subN / 2;

    const sumsX = [0, 0, 0, 0];
    const sumsY = [0, 0, 0, 0];
    const counts = [0, 0, 0, 0];

    for (let r = 0; r < subN; r++) {
      const y = (r - subHalf) / subQuarter;
      for (let c = 0; c < subN; c++) {
        const x = (c - subHalf) / subQuarter;
        const subIndex = r * subN + c;

        if (this.subPupilMask[subIndex] === 1) {
          let qIdx = -1;
          if (x >= 0 && y >= 0) qIdx = 0;
          else if (x < 0 && y >= 0) qIdx = 1;
          else if (x < 0 && y < 0) qIdx = 2;
          else if (x >= 0 && y < 0) qIdx = 3;

          if (qIdx >= 0) {
            sumsX[qIdx] += sx[subIndex];
            sumsY[qIdx] += sy[subIndex];
            counts[qIdx]++;
          }
        }
      }
    }

    const meansX = sumsX.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));
    const meansY = sumsY.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));

    for (let r = 0; r < subN; r++) {
      const y = (r - subHalf) / subQuarter;
      for (let c = 0; c < subN; c++) {
        const x = (c - subHalf) / subQuarter;
        const subIndex = r * subN + c;

        if (this.subPupilMask[subIndex] === 1) {
          let qIdx = -1;
          if (x >= 0 && y >= 0) qIdx = 0;
          else if (x < 0 && y >= 0) qIdx = 1;
          else if (x < 0 && y < 0) qIdx = 2;
          else if (x >= 0 && y < 0) qIdx = 3;

          if (qIdx >= 0) {
            sxRes[subIndex] = sx[subIndex] - meansX[qIdx];
            syRes[subIndex] = sy[subIndex] - meansY[qIdx];
          } else {
            sxRes[subIndex] = sx[subIndex];
            syRes[subIndex] = sy[subIndex];
          }
        }
      }
    }
  }

  // Extract compact 1D signal vector [S_x(valid); S_y(valid)] of length 2M
  public extractSignalVector(sx: Float32Array, sy: Float32Array): number[] {
    const indices = this.validSubPixelIndices;
    const m = indices.length;
    const signal = new Array<number>(2 * m);

    for (let i = 0; i < m; i++) {
      const idx = indices[i];
      signal[i] = sx[idx];
      signal[i + m] = sy[idx];
    }
    return signal;
  }
}
