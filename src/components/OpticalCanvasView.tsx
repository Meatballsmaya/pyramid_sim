import React, { useEffect, useRef, useState } from 'react';
import { ColormapType, renderArrayToCanvas } from '../utils/colormaps';

interface OpticalCanvasViewProps {
  title: string;
  subtitle?: string;
  data: Float32Array;
  width: number;
  height: number;
  mask: Uint8Array | null;
  colormap: ColormapType;
  unit: string;
  minVal?: number;
  maxVal?: number;
  symmetricZero?: boolean;
  formatPrecision?: number;
  highlightEdges?: boolean;
}

export const OpticalCanvasView: React.FC<OpticalCanvasViewProps> = ({
  title,
  subtitle,
  data,
  width,
  height,
  mask,
  colormap,
  unit,
  minVal,
  maxVal,
  symmetricZero = false,
  formatPrecision = 2,
  highlightEdges = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; val: number; normX: number; normY: number } | null>(null);

  // Compute stats
  let currentMin = minVal ?? Infinity;
  let currentMax = maxVal ?? -Infinity;
  let hasValid = false;

  for (let i = 0; i < data.length; i++) {
    if (!mask || mask[i] === 1) {
      const v = data[i];
      if (v < currentMin) currentMin = v;
      if (v > currentMax) currentMax = v;
      hasValid = true;
    }
  }

  if (!hasValid) {
    currentMin = 0;
    currentMax = 1;
  }

  // Detect if data is essentially zero (< 0.05 nm / slope) for symmetricZero fields like OPD
  const isNearlyFlat = symmetricZero && Math.abs(currentMax - currentMin) < 0.05 && Math.abs(currentMax) < 0.05;

  if (symmetricZero) {
    const abs = Math.max(Math.abs(currentMin), Math.abs(currentMax), 0.5);
    currentMin = -abs;
    currentMax = abs;
  } else {
    // For positive physical quantities (like detector light intensity), min should stay at 0
    if (currentMin > 0) currentMin = 0;
    if (currentMax <= currentMin) currentMax = currentMin + 1.0;
  }

  // Draw on canvas whenever data or parameters change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = renderArrayToCanvas(
      data,
      width,
      height,
      mask,
      colormap,
      currentMin,
      currentMax,
      symmetricZero
    );

    ctx.putImageData(imgData, 0, 0);

    // Optionally overlay quadrant division lines
    if (highlightEdges) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      // Crosshairs
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [data, width, height, mask, colormap, currentMin, currentMax, symmetricZero, highlightEdges]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;

    const canvasX = Math.floor((e.clientX - rect.left) * scaleX);
    const canvasY = Math.floor((e.clientY - rect.top) * scaleY);

    if (canvasX >= 0 && canvasX < width && canvasY >= 0 && canvasY < height) {
      const srcY = height - 1 - canvasY; // Cartesian inverted Y
      const idx = srcY * width + canvasX;

      if (!mask || mask[idx] === 1) {
        const val = data[idx];
        const normX = (canvasX - width / 2 + 0.5) / (width / 2);
        const normY = (srcY - height / 2 + 0.5) / (height / 2);
        setHoverInfo({ x: canvasX, y: canvasY, val, normX, normY });
        return;
      }
    }
    setHoverInfo(null);
  };

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-lg overflow-hidden shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-baseline space-x-2">
          <span className="text-xs font-semibold text-slate-200 tracking-wider">{title}</span>
          {subtitle && <span className="text-[10px] text-slate-400 font-mono">{subtitle}</span>}
        </div>
        <div className="text-[11px] font-mono tabular-nums text-slate-300">
          <span className="text-slate-500 mr-1">RANGE:</span>
          {isNearlyFlat ? (
            <span className="text-emerald-400 font-medium">0.00 {unit} (零位对准)</span>
          ) : (
            <>
              <span className="text-cyan-400">{currentMin.toFixed(formatPrecision)}</span>
              <span className="text-slate-600 mx-1">~</span>
              <span className="text-amber-400">{currentMax.toFixed(formatPrecision)}</span>
              <span className="text-[10px] text-slate-400 ml-1">{unit}</span>
            </>
          )}
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative aspect-square w-full bg-slate-950 flex items-center justify-center p-2 group">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverInfo(null)}
          className="w-full h-full object-contain cursor-crosshair rounded"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Hover Coordinate HUD */}
        {hoverInfo && (
          <div className="absolute bottom-3 left-3 pointer-events-none bg-slate-950/90 border border-cyan-500/40 px-2 py-1 rounded text-[10px] font-mono tabular-nums text-slate-200 shadow-lg backdrop-blur-sm flex items-center space-x-2">
            <span className="text-cyan-400">
              r: {Math.sqrt(hoverInfo.normX * hoverInfo.normX + hoverInfo.normY * hoverInfo.normY).toFixed(2)}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-300">
              ({hoverInfo.normX.toFixed(2)}, {hoverInfo.normY.toFixed(2)})
            </span>
            <span className="text-slate-500">|</span>
            <span className="font-semibold text-emerald-400">
              {hoverInfo.val.toFixed(formatPrecision)} {unit}
            </span>
          </div>
        )}
      </div>

      {/* Colorbar Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-800/80 bg-slate-950/40 text-[10px] font-mono tabular-nums text-slate-400">
        <span>{currentMin.toFixed(formatPrecision)}</span>
        <div className="flex-1 mx-3 h-1.5 rounded-full overflow-hidden border border-slate-800 flex">
          {colormap === 'jet' && (
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(to right, #00008c, #00ffff, #00e600, #ffff00, #ff0000, #8c0000)',
              }}
            />
          )}
          {colormap === 'seismic' && (
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(to right, #0f1ea0, #3278dc, #121826, #f07828, #dc1428)',
              }}
            />
          )}
          {colormap === 'hot' && (
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(to right, #04060c, #8c0a0a, #f56e0a, #ffe63c, #ffffff)',
              }}
            />
          )}
          {colormap === 'viridis' && (
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(to right, #440154, #3b528b, #21918c, #5ec962, #fde725)',
              }}
            />
          )}
        </div>
        <span>{currentMax.toFixed(formatPrecision)} {unit}</span>
      </div>
    </div>
  );
};
