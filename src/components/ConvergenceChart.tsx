import React, { useState } from 'react';
import { ClosedLoopStepRecord } from '../types/pwfs';
import { TrendingDown, CheckCircle2 } from 'lucide-react';

interface ConvergenceChartProps {
  history: ClosedLoopStepRecord[];
  targetRmsThreshold?: number; // default 0.8 nm
}

export const ConvergenceChart: React.FC<ConvergenceChartProps> = ({
  history,
  targetRmsThreshold = 0.8,
}) => {
  const [hoverStep, setHoverStep] = useState<number | null>(null);

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-slate-900/60 border border-slate-800 rounded-lg p-4 text-center">
        <TrendingDown className="w-8 h-8 text-slate-600 mb-2" />
        <span className="text-xs font-mono text-slate-400">暂无闭环迭代遥测数据</span>
        <span className="text-[11px] text-slate-600 mt-1">
          点击顶部「自动闭环共相」或「单步解算与调整」启动闭环反馈控制
        </span>
      </div>
    );
  }

  const width = 580;
  const height = 180;
  const padding = { top: 20, right: 30, bottom: 30, left: 55 };

  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxStep = Math.max(history.length - 1, 5);
  const maxRms = Math.max(...history.map((h) => h.rmsOpd), 5.0) * 1.15;
  const minRms = 0;

  const getX = (step: number) => padding.left + (step / maxStep) * plotW;
  const getY = (rms: number) => padding.top + plotH - ((rms - minRms) / (maxRms - minRms)) * plotH;

  // Build SVG path for RMS
  const rmsPath = history
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(h.rmsOpd).toFixed(1)}`)
    .join(' ');

  // Target threshold Y
  const targetY = getY(targetRmsThreshold);

  // Latest record
  const latest = history[history.length - 1];
  const initial = history[0];
  const isConverged = latest.rmsOpd <= targetRmsThreshold;

  const activeRecord = hoverStep !== null && history[hoverStep] ? history[hoverStep] : latest;

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-lg p-3">
      {/* Header telemetry summary */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
        <div className="flex items-center space-x-2">
          <TrendingDown className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-200 tracking-wider">
            闭环共相收敛遥测 (RMS OPD & PISTON CONVERGENCE)
          </span>
          {isConverged && (
            <span className="flex items-center space-x-1 text-[10px] font-mono bg-emerald-950/80 border border-emerald-600/50 text-emerald-400 px-2 py-0.5 rounded">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>已达标 (&lt; {targetRmsThreshold} nm)</span>
            </span>
          )}
        </div>

        {/* Real-time stats */}
        <div className="flex items-center space-x-4 text-xs font-mono tabular-nums">
          <div>
            <span className="text-slate-500 text-[10px] mr-1">初始 RMS:</span>
            <span className="text-slate-300 font-bold">{initial.rmsOpd.toFixed(2)} nm</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">当前 RMS:</span>
            <span className={`font-bold ${isConverged ? 'text-emerald-400' : 'text-cyan-400'}`}>
              {latest.rmsOpd.toFixed(3)} nm
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] mr-1">迭代步数:</span>
            <span className="text-amber-400 font-bold">{history.length - 1}</span>
          </div>
        </div>
      </div>

      {/* SVG Plot */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
          {/* Background Grid */}
          <rect
            x={padding.left}
            y={padding.top}
            width={plotW}
            height={plotH}
            fill="#090d16"
            stroke="#1e293b"
            strokeWidth="1"
          />

          {/* Grid lines horizontal */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
            const yVal = minRms + frac * (maxRms - minRms);
            const py = getY(yVal);
            return (
              <g key={frac}>
                <line
                  x1={padding.left}
                  y1={py}
                  x2={padding.left + plotW}
                  y2={py}
                  stroke="#1e293b"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                />
                <text
                  x={padding.left - 6}
                  y={py + 3}
                  textAnchor="end"
                  className="text-[9px] font-mono fill-slate-500"
                >
                  {yVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Step tick marks on X-axis */}
          {Array.from({ length: maxStep + 1 }, (_, s) => {
            const px = getX(s);
            return (
              <g key={s}>
                <line
                  x1={px}
                  y1={padding.top + plotH}
                  x2={px}
                  y2={padding.top + plotH + 4}
                  stroke="#334155"
                  strokeWidth="1"
                />
                <text
                  x={px}
                  y={padding.top + plotH + 14}
                  textAnchor="middle"
                  className="text-[9px] font-mono fill-slate-500"
                >
                  {s}
                </text>
              </g>
            );
          })}

          {/* Target Co-phasing Threshold Line */}
          <line
            x1={padding.left}
            y1={targetY}
            x2={padding.left + plotW}
            y2={targetY}
            stroke="#10b981"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
          <text
            x={padding.left + plotW - 4}
            y={targetY - 4}
            textAnchor="end"
            className="text-[9px] font-mono fill-emerald-400 font-semibold"
          >
            目标共相阈值: {targetRmsThreshold} nm
          </text>

          {/* Area fill under RMS curve */}
          <path
            d={`${rmsPath} L ${getX(history.length - 1)} ${padding.top + plotH} L ${getX(0)} ${padding.top + plotH} Z`}
            fill="rgba(6, 182, 212, 0.12)"
          />

          {/* RMS OPD line */}
          <path
            d={rmsPath}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Individual Points */}
          {history.map((h, i) => {
            const cx = getX(i);
            const cy = getY(h.rmsOpd);
            const isHovered = hoverStep === i;
            return (
              <g
                key={i}
                className="cursor-pointer"
                onMouseEnter={() => setHoverStep(i)}
                onMouseLeave={() => setHoverStep(null)}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 6 : 3.5}
                  fill={h.rmsOpd <= targetRmsThreshold ? '#10b981' : '#06b6d4'}
                  stroke="#020617"
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Step Inspector HUD */}
      <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-5 gap-2 text-[11px] font-mono">
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-slate-500 block text-[9px]">INSPECTED STEP</span>
          <span className="font-bold text-cyan-400">Step #{activeRecord.step}</span>
        </div>
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-slate-500 block text-[9px]">Q1 PISTON</span>
          <span className="text-slate-200">{activeRecord.quadrantPiston.Q1.toFixed(2)} nm</span>
        </div>
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-slate-500 block text-[9px]">Q2 PISTON</span>
          <span className="text-slate-200">{activeRecord.quadrantPiston.Q2.toFixed(2)} nm</span>
        </div>
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-slate-500 block text-[9px]">Q3 PISTON</span>
          <span className="text-slate-200">{activeRecord.quadrantPiston.Q3.toFixed(2)} nm</span>
        </div>
        <div className="bg-slate-950/60 p-1.5 rounded border border-slate-800">
          <span className="text-slate-500 block text-[9px]">Q4 PISTON</span>
          <span className="text-slate-200">{activeRecord.quadrantPiston.Q4.toFixed(2)} nm</span>
        </div>
      </div>
    </div>
  );
};
