import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { PWFSEngine } from './physics/pwfsEngine';
import { ControlSystem } from './physics/controlMatrix';
import { quadrantGeometry } from './physics/geometry';
import {
  ActuatorDisplacements,
  ClosedLoopStepRecord,
  PTTMode,
  PWFSSimulationResult,
  QuadrantId,
  QuadrantStates,
} from './types/pwfs';
import { OpticalCanvasView } from './components/OpticalCanvasView';
import { SegmentedMirrorDiagram } from './components/SegmentedMirrorDiagram';
import { ActuatorControlConsole } from './components/ActuatorControlConsole';
import { ConvergenceChart } from './components/ConvergenceChart';
import { TopTelemetryBar } from './components/TopTelemetryBar';
import { SvdAnalysisModal } from './components/SvdAnalysisModal';
import { TheoryHandbookModal } from './components/TheoryHandbookModal';
import { Grid2X2, Maximize2, ShieldCheck, Zap, SlidersHorizontal, CheckCircle2 } from 'lucide-react';

export function App() {
  // Optical simulation engine & control system (N=256 high-resolution Fourier propagation)
  const engine = useMemo(() => new PWFSEngine({ gridSize: 256 }), []);
  const controlSystem = useMemo(() => new ControlSystem(engine), [engine]);

  // Initial mirror states: Default to perfect zero alignment (no initial deviation)
  const initialStates: QuadrantStates = useMemo(
    () => ({
      Q1: { piston: 0.0, tilt: 0.0, tip: 0.0 },
      Q2: { piston: 0.0, tilt: 0.0, tip: 0.0 },
      Q3: { piston: 0.0, tilt: 0.0, tip: 0.0 },
      Q4: { piston: 0.0, tilt: 0.0, tip: 0.0 },
    }),
    []
  );

  const [actuators, setActuators] = useState<ActuatorDisplacements>(() =>
    quadrantGeometry.allPttToActuators(initialStates)
  );

  // Optical simulation result (initialized synchronously for instantaneous first render)
  const [simResult, setSimResult] = useState<PWFSSimulationResult>(() =>
    engine.simulate(initialStates)
  );

  // Closed loop control states
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationData, setCalibrationData] = useState(() => controlSystem.getCalibration());
  const [isClosedLoopRunning, setIsClosedLoopRunning] = useState<boolean>(false);
  const [gain, setGain] = useState<number>(0.6);
  const [history, setHistory] = useState<ClosedLoopStepRecord[]>([]);

  // Selection states
  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantId>('Q1');
  const [selectedActuatorId, setSelectedActuatorId] = useState<string | null>('c11');
  const [viewportLayout, setViewportLayout] = useState<'grid' | 'focused'>('grid');
  const [cameraViewMode, setCameraViewMode] = useState<'pupil' | 'focal'>('pupil');
  const [focusedChannel, setFocusedChannel] = useState<'opd' | 'detector' | 'focal' | 'sx' | 'sy' | 'hilbert'>('opd');

  // Modals
  const [isSvdModalOpen, setIsSvdModalOpen] = useState<boolean>(false);
  const [isHandbookOpen, setIsHandbookOpen] = useState<boolean>(false);

  // Step delta telemetry
  const [lastDeltas, setLastDeltas] = useState<{
    modes: number[];
    actuators: ActuatorDisplacements;
  } | null>(null);

  // Ref to hold current actuators and loop state
  const actuatorsRef = useRef(actuators);
  actuatorsRef.current = actuators;
  const isRunningRef = useRef<boolean>(isClosedLoopRunning);
  isRunningRef.current = isClosedLoopRunning;

  // Initial push-pull calibration on mount
  useEffect(() => {
    try {
      const calib = controlSystem.calibrate();
      setCalibrationData(calib);
    } catch (e) {
      console.error('Failed to calibrate PWFS on mount:', e);
    }
  }, [controlSystem]);

  // Derived current QuadrantStates from actuators
  const currentStates = useMemo(() => {
    return quadrantGeometry.allActuatorsToPtt(actuators);
  }, [actuators]);

  // Run simulation whenever actuators change
  useEffect(() => {
    const result = engine.simulate(currentStates);
    setSimResult(result);
  }, [engine, currentStates]);

  // Initialize and sync baseline history record with step 0
  useEffect(() => {
    if (simResult && history.length <= 1) {
      const record: ClosedLoopStepRecord = {
        step: 0,
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
        maxActuatorError: Math.max(...Object.values(actuators).map((v) => Math.abs(v))),
        actuators: { ...actuators },
      };
      setHistory([record]);
    }
  }, [simResult]);

  // Perform calibration manually
  const handleCalibrate = useCallback(() => {
    setIsCalibrating(true);
    setTimeout(() => {
      try {
        const calib = controlSystem.calibrate();
        setCalibrationData(calib);
      } catch (err) {
        console.error('Calibration error:', err);
      } finally {
        setIsCalibrating(false);
      }
    }, 50);
  }, [controlSystem]);

  // Perform single closed-loop iteration step
  const executeStep = useCallback(() => {
    if (!controlSystem.getCalibration()) return;

    const res = controlSystem.step(actuatorsRef.current, gain);

    setActuators(res.newActuators);
    setLastDeltas({
      modes: res.deltaModes,
      actuators: res.deltaActuators,
    });

    setHistory((prev) => {
      const nextStepNum = prev.length;
      const newRec: ClosedLoopStepRecord = {
        ...res.stepRecord,
        step: nextStepNum,
      };
      return [...prev, newRec];
    });

    return res.simResult.rmsOpd;
  }, [controlSystem, gain]);

  // Continuous closed-loop feedback loop
  useEffect(() => {
    if (isClosedLoopRunning) {
      const interval = setInterval(() => {
        const currentRms = executeStep();
        // Stop automatically if RMS OPD has converged below 0.35 nm
        if (currentRms !== undefined && currentRms < 0.35) {
          setIsClosedLoopRunning(false);
        }
      }, 120);

      return () => clearInterval(interval);
    }
  }, [isClosedLoopRunning, executeStep]);

  // Toggle closed loop
  const handleToggleClosedLoop = () => {
    setIsClosedLoopRunning((prev) => !prev);
  };

  // Reset closed loop history
  const handleResetLoopHistory = () => {
    setIsClosedLoopRunning(false);
    if (simResult) {
      setHistory([
        {
          step: 0,
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
          maxActuatorError: Math.max(...Object.values(actuators).map((v) => Math.abs(v))),
          actuators: { ...actuators },
        },
      ]);
    }
  };

  // Update PTT mode directly
  const handleUpdatePtt = (q: QuadrantId, pttDelta: Partial<PTTMode>) => {
    if (isClosedLoopRunning) setIsClosedLoopRunning(false);
    const updatedStates: QuadrantStates = {
      ...currentStates,
      [q]: {
        ...currentStates[q],
        ...pttDelta,
      },
    };
    const newActs = quadrantGeometry.allPttToActuators(updatedStates);
    setActuators(newActs);
    setHistory((prev) => (prev.length <= 1 ? prev : []));
  };

  // Update individual actuator directly
  const handleUpdateActuator = (id: string, val: number) => {
    if (isClosedLoopRunning) setIsClosedLoopRunning(false);
    setActuators((prev) => ({
      ...prev,
      [id]: val,
    }));
    setHistory((prev) => (prev.length <= 1 ? prev : []));
  };

  // Nudge actuator by delta nm
  const handleNudgeActuator = (id: string, deltaNm: number) => {
    if (isClosedLoopRunning) setIsClosedLoopRunning(false);
    setActuators((prev) => ({
      ...prev,
      [id]: (prev[id] ?? 0) + deltaNm,
    }));
    setHistory((prev) => (prev.length <= 1 ? prev : []));
  };

  // Presets handler
  const handleApplyPreset = (presetName: string) => {
    setIsClosedLoopRunning(false);
    let newStates: QuadrantStates;

    switch (presetName) {
      case 'matlab':
        // The exact case discussed with the user
        newStates = {
          Q1: { piston: 30.0, tilt: 0.15, tip: -0.10 },
          Q2: { piston: -25.0, tilt: -0.20, tip: 0.15 },
          Q3: { piston: 40.0, tilt: 0.10, tip: 0.25 },
          Q4: { piston: 0.0, tilt: -0.12, tip: -0.18 },
        };
        break;

      case 'pure_piston':
        // Pure Piston with zero Tilt/Tip to demonstrate pure Hilbert edge spikes
        newStates = {
          Q1: { piston: 45.0, tilt: 0.0, tip: 0.0 },
          Q2: { piston: -30.0, tilt: 0.0, tip: 0.0 },
          Q3: { piston: 20.0, tilt: 0.0, tip: 0.0 },
          Q4: { piston: -15.0, tilt: 0.0, tip: 0.0 },
        };
        break;

      case 'tilt_decouple':
        // Large Tilt/Tip with small Piston to stress decoupling
        newStates = {
          Q1: { piston: 15.0, tilt: 1.4, tip: -1.2 },
          Q2: { piston: -15.0, tilt: -1.5, tip: 1.1 },
          Q3: { piston: 20.0, tilt: 1.2, tip: 1.5 },
          Q4: { piston: -10.0, tilt: -1.3, tip: -1.4 },
        };
        break;

      case 'random_hand_tuned': {
        // Random assembly residuals within < 1 wavelength capture range
        const rnd = (span: number) => (Math.random() - 0.5) * 2 * span;
        newStates = {
          Q1: { piston: rnd(35), tilt: rnd(0.5), tip: rnd(0.5) },
          Q2: { piston: rnd(35), tilt: rnd(0.5), tip: rnd(0.5) },
          Q3: { piston: rnd(35), tilt: rnd(0.5), tip: rnd(0.5) },
          Q4: { piston: rnd(35), tilt: rnd(0.5), tip: rnd(0.5) },
        };
        break;
      }

      default:
        return;
    }

    const newActs = quadrantGeometry.allPttToActuators(newStates);
    setActuators(newActs);
    setHistory([]);
  };

  // Reset to perfect zero
  const handleResetToZero = () => {
    setIsClosedLoopRunning(false);
    const zeroStates: QuadrantStates = {
      Q1: { piston: 0, tilt: 0, tip: 0 },
      Q2: { piston: 0, tilt: 0, tip: 0 },
      Q3: { piston: 0, tilt: 0, tip: 0 },
      Q4: { piston: 0, tilt: 0, tip: 0 },
    };
    const zeroActs = quadrantGeometry.allPttToActuators(zeroStates);
    setActuators(zeroActs);
    setHistory([]);
  };

  const subN = engine.subN;
  const fullN = engine.n;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30">
      {/* Top Telemetry & Control Bar */}
      <TopTelemetryBar
        rmsOpd={simResult.rmsOpd}
        pvOpd={simResult.peakToValley}
        stepCount={history.length > 0 ? history.length - 1 : 0}
        isClosedLoopRunning={isClosedLoopRunning}
        onToggleClosedLoop={handleToggleClosedLoop}
        onStepClosedLoop={executeStep}
        onResetLoop={handleResetLoopHistory}
        calibration={calibrationData}
        onCalibrate={handleCalibrate}
        isCalibrating={isCalibrating}
        gain={gain}
        onChangeGain={setGain}
        onOpenSvd={() => setIsSvdModalOpen(true)}
        onOpenHandbook={() => setIsHandbookOpen(true)}
      />

      {/* Main Workspace Layout */}
      <main className="flex-1 p-3 grid grid-cols-1 xl:grid-cols-12 gap-3 max-w-[1920px] mx-auto w-full">
        {/* Left / Center Column: Optical Viewports & Convergence Telemetry (8 cols on XL) */}
        <div className="xl:col-span-8 flex flex-col space-y-3">
          {/* Viewport Header Controls */}
          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-lg text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400 font-mono text-[11px] uppercase">VIEWPORT MODE:</span>
              <button
                onClick={() => setViewportLayout('grid')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded font-semibold transition ${
                  viewportLayout === 'grid'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Grid2X2 className="w-3.5 h-3.5" />
                <span>2×2 联动监控视图</span>
              </button>
              <button
                onClick={() => setViewportLayout('focused')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded font-semibold transition ${
                  viewportLayout === 'focused'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>单图高分辨聚焦</span>
              </button>
            </div>

            {viewportLayout === 'focused' && (
              <div className="flex items-center space-x-1 font-mono text-[11px]">
                {(
                  [
                    { id: 'opd', label: '出瞳 OPD' },
                    { id: 'detector', label: '2. 探测器原始图像' },
                    { id: 'focal', label: '焦平面 PSF 光斑' },
                    { id: 'sx', label: '斜率 Sx' },
                    { id: 'sy', label: '斜率 Sy' },
                    { id: 'hilbert', label: '希尔伯特边缘' },
                  ] as const
                ).map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setFocusedChannel(ch.id)}
                    className={`px-2 py-0.5 rounded border transition ${
                      focusedChannel === ch.id
                        ? 'bg-cyan-950 border-cyan-500/60 text-cyan-300'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {ch.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optical Canvases */}
          {viewportLayout === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 1. Pupil OPD Map */}
              <OpticalCanvasView
                title="1. 系统输入相位 / 出瞳 OPD (nm)"
                subtitle="拼接镜出瞳波前 | 双程干涉反射"
                data={simResult.pupilOpd}
                width={fullN}
                height={fullN}
                mask={simResult.pupilMask}
                colormap="jet"
                unit="nm"
                symmetricZero
                highlightEdges
              />

              {/* 2. PWFS Camera: Toggleable between Pupil Detector and Focal Plane PSF */}
              <div className="relative flex flex-col">
                <div className="absolute top-2 right-2 z-10 flex bg-slate-950/80 border border-slate-700/80 rounded p-0.5 text-[10px]">
                  <button
                    onClick={() => setCameraViewMode('pupil')}
                    className={`px-1.5 py-0.5 rounded transition ${
                      cameraViewMode === 'pupil'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="查看 PWFS 探测器 4 分出瞳原始图像"
                  >
                    探测器原图
                  </button>
                  <button
                    onClick={() => setCameraViewMode('focal')}
                    className={`px-1.5 py-0.5 rounded transition ${
                      cameraViewMode === 'focal'
                        ? 'bg-amber-500/20 text-amber-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="查看焦平面四棱锥尖端的聚焦 PSF 光斑"
                  >
                    焦平面 PSF
                  </button>
                </div>
                {cameraViewMode === 'pupil' ? (
                  <OpticalCanvasView
                    title="2. 探测器原始图像"
                    subtitle="四棱锥分束 4 分出瞳像 | 动态衍射干涉图样"
                    data={simResult.detectorIntensity}
                    width={fullN}
                    height={fullN}
                    mask={null}
                    colormap="hot"
                    unit="a.u."
                  />
                ) : (
                  <OpticalCanvasView
                    title="2. 焦平面点扩散函数 (FOCAL PLANE PSF)"
                    subtitle="四棱锥尖 (0, 0) 处聚焦斑与 Airy 衍射"
                    data={simResult.focalPlaneIntensity}
                    width={subN}
                    height={subN}
                    mask={null}
                    colormap="hot"
                    unit="a.u."
                  />
                )}
              </div>

              {/* 3. Sx Slopes */}
              <OpticalCanvasView
                title="3. 解算信号 Sx (X方向斜率 + 垂直边缘)"
                subtitle="四子瞳差分归一化 | 水平方向相位梯度"
                data={simResult.sx}
                width={subN}
                height={subN}
                mask={engine.subPupilMask}
                colormap="jet"
                unit="slope"
                symmetricZero
              />

              {/* 4. Sy Slopes */}
              <OpticalCanvasView
                title="4. 解算信号 Sy (Y方向斜率 + 水平边缘)"
                subtitle="四子瞳差分归一化 | 竖直方向相位梯度"
                data={simResult.sy}
                width={subN}
                height={subN}
                mask={engine.subPupilMask}
                colormap="jet"
                unit="slope"
                symmetricZero
              />
            </div>
          ) : (
            <div className="max-w-2xl mx-auto w-full">
              {focusedChannel === 'opd' && (
                <OpticalCanvasView
                  title="出瞳光程差波前分布 (PUPIL OPD MAP)"
                  subtitle="4 扇区子镜 + 1 固定基准内镜"
                  data={simResult.pupilOpd}
                  width={fullN}
                  height={fullN}
                  mask={simResult.pupilMask}
                  colormap="jet"
                  unit="nm"
                  symmetricZero
                  highlightEdges
                />
              )}
              {focusedChannel === 'detector' && (
                <OpticalCanvasView
                  title="2. 探测器原始图像"
                  subtitle="PWFS 探测器像面 4 分出瞳像 | 动态衍射干涉图样"
                  data={simResult.detectorIntensity}
                  width={fullN}
                  height={fullN}
                  mask={null}
                  colormap="hot"
                  unit="a.u."
                />
              )}
              {focusedChannel === 'focal' && (
                <OpticalCanvasView
                  title="焦平面点扩散函数 (FOCAL PLANE PSF / 焦斑)"
                  subtitle="聚焦光场打在金字塔尖端 (0, 0) | 展现衍射 Airy 斑与四棱面分光"
                  data={simResult.focalPlaneIntensity}
                  width={subN}
                  height={subN}
                  mask={null}
                  colormap="hot"
                  unit="a.u."
                />
              )}
              {focusedChannel === 'sx' && (
                <OpticalCanvasView
                  title="3. 解算信号 Sx (X方向斜率 + 垂直边缘)"
                  subtitle="Sx = [(I_TR + I_BR) - (I_TL + I_BL)] ./ (I_norm + ε)"
                  data={simResult.sx}
                  width={subN}
                  height={subN}
                  mask={engine.subPupilMask}
                  colormap="jet"
                  unit="slope"
                  symmetricZero
                />
              )}
              {focusedChannel === 'sy' && (
                <OpticalCanvasView
                  title="4. 解算信号 Sy (Y方向斜率 + 水平边缘)"
                  subtitle="Sy = [(I_TL + I_TR) - (I_BL + I_BR)] ./ (I_norm + ε)"
                  data={simResult.sy}
                  width={subN}
                  height={subN}
                  mask={engine.subPupilMask}
                  colormap="jet"
                  unit="slope"
                  symmetricZero
                />
              )}
              {focusedChannel === 'hilbert' && (
                <OpticalCanvasView
                  title="纯净平移边缘希尔伯特条纹 (RESIDUAL HILBERT FRINGES)"
                  subtitle="扣除各子镜面内平均倾斜背景 ➔ 隔离纯平移边缘尖峰"
                  data={simResult.sxResidual}
                  width={subN}
                  height={subN}
                  mask={engine.subPupilMask}
                  colormap="seismic"
                  unit="delta"
                  symmetricZero
                />
              )}
            </div>
          )}

          {/* Convergence Telemetry Chart */}
          <ConvergenceChart history={history} targetRmsThreshold={0.8} />
        </div>

        {/* Right Column: Physical Mirror Diagram & Actuator Controls (4 cols on XL) */}
        <div className="xl:col-span-4 flex flex-col space-y-3">
          {/* Segmented Mirror Schematic Diagram */}
          <SegmentedMirrorDiagram
            states={currentStates}
            actuators={actuators}
            selectedActuatorId={selectedActuatorId}
            onSelectActuator={setSelectedActuatorId}
            onNudgeActuator={handleNudgeActuator}
            onSelectQuadrant={setActiveQuadrant}
            activeQuadrant={activeQuadrant}
          />

          {/* Actuator & Modal Control Console */}
          <ActuatorControlConsole
            states={currentStates}
            actuators={actuators}
            onUpdatePtt={handleUpdatePtt}
            onUpdateActuator={handleUpdateActuator}
            onApplyPreset={handleApplyPreset}
            onResetToZero={handleResetToZero}
            activeQuadrant={activeQuadrant}
            onSelectQuadrant={setActiveQuadrant}
            isClosedLoopRunning={isClosedLoopRunning}
          />

          {/* Last Iteration Feedback Adjustment Telemetry */}
          {lastDeltas && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>上一拍控制解算量 (ΔModes & ΔActuators)</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">闭环正常</span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Q1 Δ(P, Tilt, Tip):</span>
                  <span className="text-slate-200 tabular-nums">
                    {lastDeltas.modes[0]?.toFixed(2)} nm, {lastDeltas.modes[1]?.toFixed(2)} μrad, {lastDeltas.modes[2]?.toFixed(2)} μrad
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Q2 Δ(P, Tilt, Tip):</span>
                  <span className="text-slate-200 tabular-nums">
                    {lastDeltas.modes[3]?.toFixed(2)} nm, {lastDeltas.modes[4]?.toFixed(2)} μrad, {lastDeltas.modes[5]?.toFixed(2)} μrad
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Q3 Δ(P, Tilt, Tip):</span>
                  <span className="text-slate-200 tabular-nums">
                    {lastDeltas.modes[6]?.toFixed(2)} nm, {lastDeltas.modes[7]?.toFixed(2)} μrad, {lastDeltas.modes[8]?.toFixed(2)} μrad
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Q4 Δ(P, Tilt, Tip):</span>
                  <span className="text-slate-200 tabular-nums">
                    {lastDeltas.modes[9]?.toFixed(2)} nm, {lastDeltas.modes[10]?.toFixed(2)} μrad, {lastDeltas.modes[11]?.toFixed(2)} μrad
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* SVD Analysis Modal */}
      <SvdAnalysisModal
        isOpen={isSvdModalOpen}
        onClose={() => setIsSvdModalOpen(false)}
        calibration={calibrationData}
      />

      {/* Theory & Physical Derivation Handbook */}
      <TheoryHandbookModal
        isOpen={isHandbookOpen}
        onClose={() => setIsHandbookOpen(false)}
      />
    </div>
  );
}

export default App;
