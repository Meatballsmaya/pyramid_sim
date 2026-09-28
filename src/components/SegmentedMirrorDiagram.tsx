import React from 'react';
import { ACTUATORS, DEFAULT_RIN, DEFAULT_ROUT, QUADRANT_CENTROIDS } from '../physics/geometry';
import { ActuatorCoord, ActuatorDisplacements, QuadrantId, QuadrantStates } from '../types/pwfs';

interface SegmentedMirrorDiagramProps {
  states: QuadrantStates;
  actuators: ActuatorDisplacements;
  selectedActuatorId: string | null;
  onSelectActuator: (id: string | null) => void;
  onNudgeActuator: (id: string, deltaNm: number) => void;
  onSelectQuadrant: (q: QuadrantId) => void;
  activeQuadrant: QuadrantId;
}

export const SegmentedMirrorDiagram: React.FC<SegmentedMirrorDiagramProps> = ({
  states,
  actuators,
  selectedActuatorId,
  onSelectActuator,
  onNudgeActuator,
  onSelectQuadrant,
  activeQuadrant,
}) => {
  const size = 300;
  const center = size / 2;
  const scale = (size / 2) * 0.95; // map normalized 1.0 to pixel radius

  const rInPx = DEFAULT_RIN * scale;
  const rOutPx = DEFAULT_ROUT * scale;

  // Color helper for OPD: maps -40..+40 nm to cool/warm tint
  const getQuadrantColor = (piston: number) => {
    if (Math.abs(piston) < 0.8) return 'rgba(30, 41, 59, 0.7)'; // slate neutral
    if (piston > 0) {
      const alpha = Math.min(0.85, 0.2 + (piston / 50) * 0.6);
      return `rgba(244, 63, 94, ${alpha})`; // warm rose
    } else {
      const alpha = Math.min(0.85, 0.2 + (-piston / 50) * 0.6);
      return `rgba(56, 189, 248, ${alpha})`; // cool sky blue
    }
  };

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span className="text-xs font-semibold text-slate-200 tracking-wider">
            拼接镜物理布局与促动器分布 (12 ACTUATORS)
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          R_in={DEFAULT_RIN} / R_out={DEFAULT_ROUT}
        </span>
      </div>

      {/* SVG Canvas for Mirror Segments */}
      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} className="overflow-visible select-none">
          {/* Subtle Outer Boundary Ring */}
          <circle
            cx={center}
            cy={center}
            r={rOutPx}
            fill="none"
            stroke="#334155"
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          {/* Quadrant Sectors */}
          {/* Q1: Top-Right (0 to 90 deg, Cartesian y > 0 is SVG y < center) */}
          <path
            d={`
              M ${center + rInPx} ${center}
              A ${rInPx} ${rInPx} 0 0 0 ${center} ${center - rInPx}
              L ${center} ${center - rOutPx}
              A ${rOutPx} ${rOutPx} 0 0 1 ${center + rOutPx} ${center}
              Z
            `}
            fill={getQuadrantColor(states.Q1.piston)}
            stroke={activeQuadrant === 'Q1' ? '#38bdf8' : '#475569'}
            strokeWidth={activeQuadrant === 'Q1' ? '2.5' : '1.5'}
            className="cursor-pointer transition-all hover:brightness-125"
            onClick={() => onSelectQuadrant('Q1')}
          />

          {/* Q2: Top-Left */}
          <path
            d={`
              M ${center} ${center - rInPx}
              A ${rInPx} ${rInPx} 0 0 0 ${center - rInPx} ${center}
              L ${center - rOutPx} ${center}
              A ${rOutPx} ${rOutPx} 0 0 1 ${center} ${center - rOutPx}
              Z
            `}
            fill={getQuadrantColor(states.Q2.piston)}
            stroke={activeQuadrant === 'Q2' ? '#38bdf8' : '#475569'}
            strokeWidth={activeQuadrant === 'Q2' ? '2.5' : '1.5'}
            className="cursor-pointer transition-all hover:brightness-125"
            onClick={() => onSelectQuadrant('Q2')}
          />

          {/* Q3: Bottom-Left */}
          <path
            d={`
              M ${center - rInPx} ${center}
              A ${rInPx} ${rInPx} 0 0 0 ${center} ${center + rInPx}
              L ${center} ${center + rOutPx}
              A ${rOutPx} ${rOutPx} 0 0 1 ${center - rOutPx} ${center}
              Z
            `}
            fill={getQuadrantColor(states.Q3.piston)}
            stroke={activeQuadrant === 'Q3' ? '#38bdf8' : '#475569'}
            strokeWidth={activeQuadrant === 'Q3' ? '2.5' : '1.5'}
            className="cursor-pointer transition-all hover:brightness-125"
            onClick={() => onSelectQuadrant('Q3')}
          />

          {/* Q4: Bottom-Right */}
          <path
            d={`
              M ${center} ${center + rInPx}
              A ${rInPx} ${rInPx} 0 0 0 ${center + rInPx} ${center}
              L ${center + rOutPx} ${center}
              A ${rOutPx} ${rOutPx} 0 0 1 ${center} ${center + rOutPx}
              Z
            `}
            fill={getQuadrantColor(states.Q4.piston)}
            stroke={activeQuadrant === 'Q4' ? '#38bdf8' : '#475569'}
            strokeWidth={activeQuadrant === 'Q4' ? '2.5' : '1.5'}
            className="cursor-pointer transition-all hover:brightness-125"
            onClick={() => onSelectQuadrant('Q4')}
          />

          {/* Central Fixed Reference Mirror */}
          <circle
            cx={center}
            cy={center}
            r={rInPx}
            fill="#0f172a"
            stroke="#06b6d4"
            strokeWidth="2"
            strokeDasharray="4 2"
          />

          {/* Labels on Mirrors */}
          <text
            x={center}
            y={center - 6}
            textAnchor="middle"
            className="text-[10px] font-mono fill-cyan-400 font-semibold"
          >
            基准内镜 (固定)
          </text>
          <text
            x={center}
            y={center + 10}
            textAnchor="middle"
            className="text-[9px] font-mono fill-slate-400"
          >
            Phase ≡ 0 nm
          </text>

          {/* Quadrant Name & Piston HUD inside segments */}
          {(['Q1', 'Q2', 'Q3', 'Q4'] as QuadrantId[]).map((q) => {
            const c = QUADRANT_CENTROIDS[q];
            // SVG Y coordinate is inverted relative to Cartesian
            const svgX = center + c.x * scale;
            const svgY = center - c.y * scale;
            const p = states[q].piston;

            return (
              <g key={q} className="pointer-events-none">
                <text
                  x={svgX}
                  y={svgY - 8}
                  textAnchor="middle"
                  className="text-xs font-mono font-bold fill-white shadow"
                >
                  {q}
                </text>
                <text
                  x={svgX}
                  y={svgY + 6}
                  textAnchor="middle"
                  className={`text-[10px] font-mono font-semibold ${
                    Math.abs(p) < 0.8
                      ? 'fill-emerald-400'
                      : p > 0
                      ? 'fill-rose-300'
                      : 'fill-cyan-300'
                  }`}
                >
                  {p > 0 ? `+${p.toFixed(1)}` : p.toFixed(1)} nm
                </text>
              </g>
            );
          })}

          {/* 12 Actuator Pins */}
          {ACTUATORS.map((act) => {
            const svgX = center + act.x * scale;
            const svgY = center - act.y * scale;
            const d = actuators[act.id] ?? 0;
            const isSelected = selectedActuatorId === act.id;

            return (
              <g
                key={act.id}
                className="cursor-pointer group"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectActuator(act.id);
                  onSelectQuadrant(act.quadrant);
                }}
              >
                {/* Glowing target halo when selected */}
                {isSelected && (
                  <circle
                    cx={svgX}
                    cy={svgY}
                    r="12"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    className="animate-pulse"
                  />
                )}

                {/* Actuator Pin Body */}
                <circle
                  cx={svgX}
                  cy={svgY}
                  r="6"
                  fill={isSelected ? '#38bdf8' : Math.abs(d) < 0.8 ? '#10b981' : d > 0 ? '#f43f5e' : '#0284c7'}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                  className="transition-transform group-hover:scale-125"
                />

                {/* Pin Center Dot */}
                <circle cx={svgX} cy={svgY} r="2" fill="#ffffff" />

                {/* Pin Text Label */}
                <text
                  x={svgX}
                  y={svgY - 9}
                  textAnchor="middle"
                  className="text-[9px] font-mono font-bold fill-slate-200 pointer-events-none drop-shadow"
                >
                  {act.id.toUpperCase()}
                </text>

                {/* Pin Value */}
                <text
                  x={svgX}
                  y={svgY + 14}
                  textAnchor="middle"
                  className="text-[8px] font-mono fill-slate-300 pointer-events-none drop-shadow"
                >
                  {d.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Actuator Quick Control Tray */}
      <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
        {selectedActuatorId ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-cyan-400">
                {selectedActuatorId.toUpperCase()}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-300">
                {(actuators[selectedActuatorId] ?? 0).toFixed(2)} nm
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => onNudgeActuator(selectedActuatorId, -5)}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 active:scale-95"
              >
                -5nm
              </button>
              <button
                onClick={() => onNudgeActuator(selectedActuatorId, -1)}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 active:scale-95"
              >
                -1nm
              </button>
              <button
                onClick={() => onNudgeActuator(selectedActuatorId, +1)}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 active:scale-95"
              >
                +1nm
              </button>
              <button
                onClick={() => onNudgeActuator(selectedActuatorId, +5)}
                className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 active:scale-95"
              >
                +5nm
              </button>
            </div>
          </div>
        ) : (
          <span className="text-[10px] font-mono text-slate-500">
            点击上方子镜扇区或促动器圆点进行选中与微调
          </span>
        )}
      </div>
    </div>
  );
};
