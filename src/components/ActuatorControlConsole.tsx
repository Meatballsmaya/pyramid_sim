import React, { useState } from 'react';
import { ACTUATORS } from '../physics/geometry';
import { ActuatorDisplacements, PTTMode, QuadrantId, QuadrantStates } from '../types/pwfs';
import { Sliders, Activity, Sparkles, RefreshCw, Zap } from 'lucide-react';

interface ActuatorControlConsoleProps {
  states: QuadrantStates;
  actuators: ActuatorDisplacements;
  onUpdatePtt: (q: QuadrantId, ptt: Partial<PTTMode>) => void;
  onUpdateActuator: (id: string, val: number) => void;
  onApplyPreset: (presetName: string) => void;
  onResetToZero: () => void;
  activeQuadrant: QuadrantId;
  onSelectQuadrant: (q: QuadrantId) => void;
  isClosedLoopRunning: boolean;
}

export const ActuatorControlConsole: React.FC<ActuatorControlConsoleProps> = ({
  states,
  actuators,
  onUpdatePtt,
  onUpdateActuator,
  onApplyPreset,
  onResetToZero,
  activeQuadrant,
  onSelectQuadrant,
  isClosedLoopRunning,
}) => {
  const [tab, setTab] = useState<'actuators' | 'ptt' | 'presets'>('ptt');

  const quadrants: QuadrantId[] = ['Q1', 'Q2', 'Q3', 'Q4'];

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-800 rounded-lg p-3">
      {/* Tab Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
        <div className="flex space-x-1 bg-slate-950 p-1 rounded-md border border-slate-800/80">
          <button
            onClick={() => setTab('ptt')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
              tab === 'ptt'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>模态 PTT 调节</span>
          </button>
          <button
            onClick={() => setTab('actuators')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
              tab === 'actuators'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>12 促动器直控</span>
          </button>
          <button
            onClick={() => setTab('presets')}
            className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
              tab === 'presets'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>扰动工况库</span>
          </button>
        </div>

        <button
          onClick={onResetToZero}
          disabled={isClosedLoopRunning}
          className="flex items-center space-x-1 px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded border border-slate-700/60 transition disabled:opacity-50"
          title="将所有促动器与模态复位到零位"
        >
          <RefreshCw className="w-3 h-3" />
          <span>全清零</span>
        </button>
      </div>

      {/* Tab 1: Quadrant PTT Controls */}
      {tab === 'ptt' && (
        <div className="space-y-3">
          {/* Quadrant Selector */}
          <div className="grid grid-cols-4 gap-1.5">
            {quadrants.map((q) => {
              const p = states[q].piston;
              return (
                <button
                  key={q}
                  onClick={() => onSelectQuadrant(q)}
                  className={`p-1.5 rounded border text-left transition ${
                    activeQuadrant === q
                      ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold">{q}</span>
                    <span
                      className={`text-[10px] font-mono tabular-nums ${
                        Math.abs(p) < 0.5 ? 'text-emerald-400' : 'text-slate-300'
                      }`}
                    >
                      {p.toFixed(1)} nm
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Quadrant Sliders */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span className="text-xs font-semibold text-slate-200">
                当前选中: <span className="text-cyan-400 font-mono">{activeQuadrant}</span> 扇形子镜
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                中心 (xc={activeQuadrant.includes('1') || activeQuadrant.includes('4') ? '+0.47' : '-0.47'})
              </span>
            </div>

            {/* Piston Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">平移误差 (Piston):</span>
                <span className="text-cyan-400 font-bold tabular-nums">
                  {states[activeQuadrant].piston.toFixed(1)}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">nm</span>
                </span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                step="0.5"
                value={states[activeQuadrant].piston}
                onChange={(e) =>
                  onUpdatePtt(activeQuadrant, { piston: parseFloat(e.target.value) })
                }
                disabled={isClosedLoopRunning}
                className="w-full accent-cyan-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                <span>-60 nm</span>
                <span>0 nm</span>
                <span>+60 nm</span>
              </div>
            </div>

            {/* Tilt X Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">径向倾斜 (Tilt X):</span>
                <span className="text-amber-400 font-bold tabular-nums">
                  {states[activeQuadrant].tilt.toFixed(2)}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">μrad</span>
                </span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.05"
                value={states[activeQuadrant].tilt}
                onChange={(e) =>
                  onUpdatePtt(activeQuadrant, { tilt: parseFloat(e.target.value) })
                }
                disabled={isClosedLoopRunning}
                className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                <span>-2.0 μrad</span>
                <span>0 μrad</span>
                <span>+2.0 μrad</span>
              </div>
            </div>

            {/* Tip Y Slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">周向倾斜 (Tip Y):</span>
                <span className="text-rose-400 font-bold tabular-nums">
                  {states[activeQuadrant].tip.toFixed(2)}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">μrad</span>
                </span>
              </div>
              <input
                type="range"
                min="-2.0"
                max="2.0"
                step="0.05"
                value={states[activeQuadrant].tip}
                onChange={(e) =>
                  onUpdatePtt(activeQuadrant, { tip: parseFloat(e.target.value) })
                }
                disabled={isClosedLoopRunning}
                className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[9px] font-mono text-slate-500">
                <span>-2.0 μrad</span>
                <span>0 μrad</span>
                <span>+2.0 μrad</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: 12 Actuators Direct Drive */}
      {tab === 'actuators' && (
        <div className="space-y-2 max-h-[290px] overflow-y-auto pr-1">
          {quadrants.map((q) => {
            const qActs = ACTUATORS.filter((a) => a.quadrant === q);
            return (
              <div
                key={q}
                className="bg-slate-950/60 border border-slate-800/80 rounded-md p-2 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400">{q} 促动器组</span>
                  <span className="text-[10px] font-mono text-slate-500">3-PTT 支承</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {qActs.map((act) => {
                    const val = actuators[act.id] ?? 0;
                    return (
                      <div key={act.id} className="bg-slate-900 border border-slate-800/60 rounded p-1.5">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="font-semibold text-slate-200">{act.id.toUpperCase()}</span>
                          <span
                            className={`tabular-nums ${
                              Math.abs(val) < 0.5 ? 'text-emerald-400' : 'text-slate-300'
                            }`}
                          >
                            {val.toFixed(1)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-60"
                          max="60"
                          step="0.5"
                          value={val}
                          onChange={(e) => onUpdateActuator(act.id, parseFloat(e.target.value))}
                          disabled={isClosedLoopRunning}
                          className="w-full accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer disabled:opacity-50 mt-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Presets */}
      {tab === 'presets' && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400 mb-1">
            快速加载典型光学工况与扰动场景，测试 PWFS 闭环解耦性能：
          </div>

          <button
            onClick={() => onApplyPreset('matlab')}
            disabled={isClosedLoopRunning}
            className="w-full p-2 text-left bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded-lg transition group disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-300 group-hover:text-cyan-200 flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span>MATLAB 物理验证工况</span>
              </span>
              <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/60">
                典型仿真
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Q1=+30nm, Q2=-25nm, Q3=+40nm, Q4=0nm，叠加微小 Tip/Tilt（精确复现前期讨论中的干涉仪粗调残差）。
            </p>
          </button>

          <button
            onClick={() => onApplyPreset('pure_piston')}
            disabled={isClosedLoopRunning}
            className="w-full p-2 text-left bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 rounded-lg transition group disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300 group-hover:text-amber-200">
                纯平移阶跃工况 (Pure Piston, 0 Tilt)
              </span>
              <span className="text-[10px] font-mono bg-amber-950 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800/60">
                验证希尔伯特跳变
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              各扇区严格无倾斜，仅存在边缘高度差，清晰观察 PWFS 边缘干涉亮暗条纹特征。
            </p>
          </button>

          <button
            onClick={() => onApplyPreset('tilt_decouple')}
            disabled={isClosedLoopRunning}
            className="w-full p-2 text-left bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-lg transition group disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
                大倾斜强背景解耦测试 (Tip/Tilt Stress)
              </span>
              <span className="text-[10px] font-mono bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-800/60">
                模态控制矩阵
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Tip/Tilt 高达 ±1.5 μrad，Piston 仅 ±15 nm，验证从斜率平移背景中无串扰剥离 Piston。
            </p>
          </button>

          <button
            onClick={() => onApplyPreset('random_hand_tuned')}
            disabled={isClosedLoopRunning}
            className="w-full p-2 text-left bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-purple-500/50 rounded-lg transition group disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-300 group-hover:text-purple-200">
                随机装配残差 (&lt; 1 λ 捕获区内)
              </span>
              <span className="text-[10px] font-mono bg-purple-950 text-purple-400 px-1.5 py-0.5 rounded border border-purple-800/60">
                随机测试
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              为 12 个促动器注入均方根约 35 nm 的随机装配残差，模拟工程实际环境。
            </p>
          </button>
        </div>
      )}
    </div>
  );
};
