import React from 'react';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  BarChart3,
  BookOpen,
  Wrench,
  Radio,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { CalibrationData } from '../types/pwfs';

interface TopTelemetryBarProps {
  rmsOpd: number;
  pvOpd: number;
  stepCount: number;
  isClosedLoopRunning: boolean;
  onToggleClosedLoop: () => void;
  onStepClosedLoop: () => void;
  onResetLoop: () => void;
  calibration: CalibrationData | null;
  onCalibrate: () => void;
  isCalibrating: boolean;
  gain: number;
  onChangeGain: (g: number) => void;
  onOpenSvd: () => void;
  onOpenHandbook: () => void;
}

export const TopTelemetryBar: React.FC<TopTelemetryBarProps> = ({
  rmsOpd,
  pvOpd,
  stepCount,
  isClosedLoopRunning,
  onToggleClosedLoop,
  onStepClosedLoop,
  onResetLoop,
  calibration,
  onCalibrate,
  isCalibrating,
  gain,
  onChangeGain,
  onOpenSvd,
  onOpenHandbook,
}) => {
  const isCoPhased = rmsOpd < 0.8;

  return (
    <header className="bg-slate-950 border-b border-slate-800 text-slate-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
      {/* Title & Status */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400">
          <Radio className={`w-4 h-4 ${isClosedLoopRunning ? 'animate-pulse text-emerald-400' : ''}`} />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm font-bold text-slate-100 tracking-wide">
              PWFS 拼接子镜精共相共焦闭环控制系统
            </h1>
            <span className="text-[10px] font-mono uppercase bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800">
              λ = 632.8 nm
            </span>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400 mt-0.5">
            {calibration ? (
              <span className="flex items-center space-x-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>IM 矩阵已标定 (12 模态正交解耦)</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-amber-400">
                <AlertCircle className="w-3 h-3" />
                <span>未标定，请点击标定</span>
              </span>
            )}
            <span className="text-slate-600">|</span>
            <span>4 扇区子镜 + 12 压电促动器</span>
          </div>
        </div>
      </div>

      {/* Real-time Telemetry Readout */}
      <div className="flex items-center space-x-4 bg-slate-900/80 border border-slate-800/80 px-3.5 py-1.5 rounded-lg">
        {/* RMS OPD */}
        <div>
          <span className="text-[9px] font-mono uppercase text-slate-400 block">Wavefront RMS</span>
          <div className="flex items-baseline space-x-1">
            <span
              className={`text-lg font-mono font-bold tabular-nums ${
                isCoPhased ? 'text-emerald-400' : 'text-cyan-400'
              }`}
            >
              {rmsOpd.toFixed(3)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">nm</span>
          </div>
        </div>

        <div className="w-px h-6 bg-slate-800" />

        {/* PV OPD */}
        <div>
          <span className="text-[9px] font-mono uppercase text-slate-400 block">Peak-to-Valley (PV)</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-lg font-mono font-bold text-amber-400 tabular-nums">
              {pvOpd.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono text-slate-400">nm</span>
          </div>
        </div>

        <div className="w-px h-6 bg-slate-800" />

        {/* Closed-loop Iteration */}
        <div>
          <span className="text-[9px] font-mono uppercase text-slate-400 block">迭代次数 (Step)</span>
          <div className="flex items-baseline space-x-1">
            <span className="text-lg font-mono font-bold text-slate-200 tabular-nums">
              #{stepCount}
            </span>
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center space-x-2">
        {/* Loop Gain Slider */}
        <div className="hidden sm:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
          <span className="text-slate-400 text-[10px]">增益 G:</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={gain}
            onChange={(e) => onChangeGain(parseFloat(e.target.value))}
            className="w-16 accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
          />
          <span className="text-cyan-300 font-bold tabular-nums">{gain.toFixed(2)}</span>
        </div>

        {/* Calibrate Button */}
        <button
          onClick={onCalibrate}
          disabled={isCalibrating || isClosedLoopRunning}
          className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
            isCalibrating
              ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-wait'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200 active:scale-95'
          }`}
          title="执行 Push-Pull 差分标定生成 IM 和 CM 矩阵"
        >
          <Wrench className={`w-3.5 h-3.5 ${isCalibrating ? 'animate-spin text-cyan-400' : ''}`} />
          <span>{isCalibrating ? '标定中...' : '推拉标定 (IM)'}</span>
        </button>

        {/* Single Step Button */}
        <button
          onClick={onStepClosedLoop}
          disabled={!calibration || isClosedLoopRunning || isCalibrating}
          className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded-lg transition active:scale-95 disabled:opacity-40"
          title="执行一次 PWFS 采样 ➔ 控制矩阵解算 ➔ 促动器调整"
        >
          <StepForward className="w-3.5 h-3.5 text-cyan-400" />
          <span>单步调整</span>
        </button>

        {/* Auto Closed-Loop Run / Pause */}
        <button
          onClick={onToggleClosedLoop}
          disabled={!calibration || isCalibrating}
          className={`flex items-center space-x-2 px-4 py-1.5 text-xs font-bold rounded-lg shadow transition active:scale-95 disabled:opacity-40 ${
            isClosedLoopRunning
              ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
              : 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white'
          }`}
          title="启动/暂停连续自动闭环反馈控制"
        >
          {isClosedLoopRunning ? (
            <>
              <Pause className="w-4 h-4 fill-white" />
              <span>暂停闭环</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white" />
              <span>自动闭环共相</span>
            </>
          )}
        </button>

        {/* Reset Telemetry */}
        <button
          onClick={onResetLoop}
          className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition"
          title="重置迭代记录"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-slate-800 mx-1" />

        {/* SVD Modal Trigger */}
        <button
          onClick={onOpenSvd}
          className="p-1.5 text-slate-300 hover:text-cyan-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition"
          title="查看相互作用矩阵 SVD 奇异值谱与解耦分析"
        >
          <BarChart3 className="w-4 h-4" />
        </button>

        {/* Theory Handbook Trigger */}
        <button
          onClick={onOpenHandbook}
          className="p-1.5 text-slate-300 hover:text-cyan-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition"
          title="查看物理原理与数学推导手册"
        >
          <BookOpen className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
