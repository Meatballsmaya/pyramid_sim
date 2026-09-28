// High-performance 2D Fast Fourier Transform (Cooley-Tukey Radix-2)
// Optimized for interactive physical optics wavefront simulation.

export class FFT2D {
  public readonly n: number;
  private readonly bitReverse: Uint32Array;
  private readonly cosTable: Float64Array;
  private readonly sinTable: Float64Array;
  private readonly tempReal: Float64Array;
  private readonly tempImag: Float64Array;

  constructor(n: number) {
    if ((n & (n - 1)) !== 0) {
      throw new Error(`FFT size must be a power of 2, received ${n}`);
    }
    this.n = n;
    this.tempReal = new Float64Array(n);
    this.tempImag = new Float64Array(n);

    // Precompute bit reversal table
    const log2n = Math.round(Math.log2(n));
    this.bitReverse = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let rev = 0;
      for (let j = 0; j < log2n; j++) {
        if ((i & (1 << j)) !== 0) {
          rev |= 1 << (log2n - 1 - j);
        }
      }
      this.bitReverse[i] = rev;
    }

    // Precompute twiddle factors: exp(-2*pi*i * k / n)
    this.cosTable = new Float64Array(n / 2);
    this.sinTable = new Float64Array(n / 2);
    for (let k = 0; k < n / 2; k++) {
      const angle = (-2.0 * Math.PI * k) / n;
      this.cosTable[k] = Math.cos(angle);
      this.sinTable[k] = Math.sin(angle);
    }
  }

  // 1D In-place FFT on arrays
  private fft1D(real: Float64Array, imag: Float64Array, offset: number, stride: number, inverse: boolean): void {
    const n = this.n;
    const bitReverse = this.bitReverse;
    const tempR = this.tempReal;
    const tempI = this.tempImag;

    // Bit reversal permutation into temp
    for (let i = 0; i < n; i++) {
      const idx = offset + i * stride;
      const target = bitReverse[i];
      tempR[target] = real[idx];
      tempI[target] = imag[idx];
    }

    // Butterfly operations
    for (let size = 2; size <= n; size <<= 1) {
      const halfSize = size >> 1;
      const step = n / size;

      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < halfSize; j++) {
          const k = j * step;
          let c = this.cosTable[k];
          let s = inverse ? -this.sinTable[k] : this.sinTable[k];

          const evenIdx = i + j;
          const oddIdx = i + j + halfSize;

          const oddR = tempR[oddIdx];
          const oddI = tempI[oddIdx];

          const tR = oddR * c - oddI * s;
          const tI = oddR * s + oddI * c;

          const uR = tempR[evenIdx];
          const uI = tempI[evenIdx];

          tempR[evenIdx] = uR + tR;
          tempI[evenIdx] = uI + tI;
          tempR[oddIdx] = uR - tR;
          tempI[oddIdx] = uI - tI;
        }
      }
    }

    // Copy back
    const scale = inverse ? 1.0 / n : 1.0;
    for (let i = 0; i < n; i++) {
      const idx = offset + i * stride;
      real[idx] = tempR[i] * scale;
      imag[idx] = tempI[i] * scale;
    }
  }

  // 2D FFT in place
  public forward2D(real: Float64Array, imag: Float64Array): void {
    const n = this.n;
    // Row-wise FFT
    for (let r = 0; r < n; r++) {
      this.fft1D(real, imag, r * n, 1, false);
    }
    // Col-wise FFT
    for (let c = 0; c < n; c++) {
      this.fft1D(real, imag, c, n, false);
    }
  }

  // 2D Inverse FFT in place
  public inverse2D(real: Float64Array, imag: Float64Array): void {
    const n = this.n;
    // Row-wise IFFT
    for (let r = 0; r < n; r++) {
      this.fft1D(real, imag, r * n, 1, true);
    }
    // Col-wise IFFT
    for (let c = 0; c < n; c++) {
      this.fft1D(real, imag, c, n, true);
    }
  }

  // 2D FFTShift in place: swaps quadrants (1 with 3, 2 with 4)
  public static fftshift(data: Float64Array | Float32Array, n: number): void {
    const half = n / 2;
    for (let y = 0; y < half; y++) {
      for (let x = 0; x < half; x++) {
        // Quad 0 (top-left) <-> Quad 3 (bottom-right)
        const i0 = y * n + x;
        const i3 = (y + half) * n + (x + half);
        const t0 = data[i0];
        data[i0] = data[i3];
        data[i3] = t0;

        // Quad 1 (top-right) <-> Quad 2 (bottom-left)
        const i1 = y * n + (x + half);
        const i2 = (y + half) * n + x;
        const t1 = data[i1];
        data[i1] = data[i2];
        data[i2] = t1;
      }
    }
  }
}
