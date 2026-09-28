// Scientific Colormaps for Wavefront and Detector Visualizations

export type ColormapType = 'jet' | 'seismic' | 'hot' | 'viridis';

// Fast linear interpolation between key colors
function interpolateRamp(val: number, stops: [number, number, number, number][]): [number, number, number] {
  const clamped = Math.max(0, Math.min(1, val));
  for (let i = 0; i < stops.length - 1; i++) {
    const s0 = stops[i];
    const s1 = stops[i + 1];
    if (clamped >= s0[0] && clamped <= s1[0]) {
      const span = s1[0] - s0[0];
      const t = span > 0 ? (clamped - s0[0]) / span : 0;
      return [
        Math.round(s0[1] + t * (s1[1] - s0[1])),
        Math.round(s0[2] + t * (s1[2] - s0[2])),
        Math.round(s0[3] + t * (s1[3] - s0[3])),
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

// 1. Jet Colormap (for Phase & OPD)
const JET_STOPS: [number, number, number, number][] = [
  [0.0, 0, 0, 140],
  [0.125, 0, 0, 255],
  [0.375, 0, 255, 255],
  [0.5, 0, 230, 0],
  [0.625, 255, 255, 0],
  [0.875, 255, 0, 0],
  [1.0, 140, 0, 0],
];

// 2. Seismic / Coolwarm (Symmetric for Slopes Sx, Sy around 0)
const SEISMIC_STOPS: [number, number, number, number][] = [
  [0.0, 15, 30, 160],   // Strong negative (blue)
  [0.3, 50, 120, 220],
  [0.5, 18, 24, 38],    // Neutral 0 (dark slate canvas)
  [0.7, 240, 120, 40],
  [1.0, 220, 20, 40],   // Strong positive (red)
];

// 3. Hot (for Detector Intensity - exact MATLAB standard hot colormap)
const HOT_STOPS: [number, number, number, number][] = [
  [0.0, 0, 0, 0],
  [0.375, 255, 0, 0],
  [0.75, 255, 255, 0],
  [1.0, 255, 255, 255],
];

// 4. Viridis
const VIRIDIS_STOPS: [number, number, number, number][] = [
  [0.0, 68, 1, 84],
  [0.25, 59, 82, 139],
  [0.5, 33, 145, 140],
  [0.75, 94, 201, 98],
  [1.0, 253, 231, 37],
];

export function getColor(val: number, cmap: ColormapType): [number, number, number] {
  switch (cmap) {
    case 'jet':
      return interpolateRamp(val, JET_STOPS);
    case 'seismic':
      return interpolateRamp(val, SEISMIC_STOPS);
    case 'hot':
      return interpolateRamp(val, HOT_STOPS);
    case 'viridis':
      return interpolateRamp(val, VIRIDIS_STOPS);
  }
}

// Render a 2D float array into an HTML Canvas ImageData
export function renderArrayToCanvas(
  data: Float32Array,
  width: number,
  height: number,
  mask: Uint8Array | null,
  cmap: ColormapType,
  minVal?: number,
  maxVal?: number,
  symmetricZero: boolean = false
): ImageData {
  const imgData = new ImageData(width, height);
  const buf = imgData.data;

  // Determine min and max
  let actualMin = minVal ?? Infinity;
  let actualMax = maxVal ?? -Infinity;

  if (minVal === undefined || maxVal === undefined) {
    for (let i = 0; i < data.length; i++) {
      if (!mask || mask[i] === 1) {
        const v = data[i];
        if (v < actualMin) actualMin = v;
        if (v > actualMax) actualMax = v;
      }
    }
  }

  if (symmetricZero) {
    const absBound = Math.max(Math.abs(actualMin), Math.abs(actualMax), 0.5);
    actualMin = -absBound;
    actualMax = absBound;
  } else {
    // For positive physical quantities (like detector light intensity), min should stay at 0
    if (actualMin > 0) actualMin = 0;
    if (actualMax <= actualMin) actualMax = actualMin + 1.0;
  }

  const range = actualMax > actualMin ? actualMax - actualMin : 1.0;

  for (let y = 0; y < height; y++) {
    // Invert Y so standard Cartesian (y=0 at center or bottom) maps naturally
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x++) {
      const srcIdx = srcY * width + x;
      const dstIdx = (y * width + x) * 4;

      if (mask && mask[srcIdx] === 0) {
        // Inactive region: very dark slate transparent background
        buf[dstIdx] = 10;
        buf[dstIdx + 1] = 15;
        buf[dstIdx + 2] = 26;
        buf[dstIdx + 3] = 255;
      } else {
        const val = data[srcIdx];
        const norm = (val - actualMin) / range;
        const [r, g, b] = getColor(norm, cmap);
        buf[dstIdx] = r;
        buf[dstIdx + 1] = g;
        buf[dstIdx + 2] = b;
        buf[dstIdx + 3] = 255;
      }
    }
  }

  return imgData;
}
