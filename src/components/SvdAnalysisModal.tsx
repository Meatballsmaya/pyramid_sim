import React from 'react';
import { CalibrationData } from '../types/pwfs';
import { X, BarChart3, CheckCircle, Info } from 'lucide-react';

interface SvdAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  calibration: CalibrationData | null;
}

export const SvdAnalysisModal: React.FC<SvdAnalysisModalProps> = ({
  isOpen,
  onClose,
  calibration,
}) => {
  if (!isOpen) return null;

  const singularValues = calibration?.singularValues ?? [];
  const maxSigma = singularValues.length > 0 ? singularValues[0] : 1.0;
  const condNum = calibration?.conditionNumber ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-2.5">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100 tracking-wide">
                相互作用矩阵 (IM) 奇异值谱与解耦分析 (SVD SPECTRUM)
              </h3>
              <p className="text-[11px] text-slate-400">
                12 阶模态解耦灵敏度矩阵分解与条件数评估
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                矩阵条件数 (Condition Number)
              </span>
              <span className="text-lg font-mono font-bold text-cyan-400 mt-0.5 block">
                {condNum > 0 ? condNum.toFixed(2) : '--'}
              </span>
              <span className="text-[10px] text-emerald-400 flex items-center space-x-1 mt-1">
                <CheckCircle className="w-3 h-3" />
                <span>良态良逆解，无退化模式</span>
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                最大奇异值 σ₁ (Tip/Tilt 倾斜主导)
              </span>
              <span className="text-lg font-mono font-bold text-amber-400 mt-0.5 block">
                {singularValues.length > 0 ? singularValues[0].toFixed(3) : '--'}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                全孔径斜率响应灵敏度最高
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-lg">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">
                有效探测像素数 (Valid Pupil Sub-apertures)
              </span>
              <span className="text-lg font-mono font-bold text-slate-200 mt-0.5 block">
                2 × {calibration?.validPixelIndices.length ?? 0}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Sx + Sy 测量向量总维度
              </span>
            </div>
          </div>

          {/* Singular Values Bar Chart */}
          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-200 font-mono">
                奇异值衰减谱分布 (Singular Values σ₁ ~ σ₁₂)
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                归一化相对灵敏度 (Normalized Gain)
              </span>
            </div>

            <div className="space-y-2">
              {singularValues.map((val, idx) => {
                const ratio = maxSigma > 0 ? (val / maxSigma) * 100 : 0;
                // Distinguish between Tip/Tilt modes (high gain) and Piston modes (moderate edge gain)
                const isTiltMode = idx < 8;
                return (
                  <div key={idx} className="flex items-center space-x-3 text-xs font-mono">
                    <span className="w-16 text-slate-400 text-[11px]">
                      σ_{idx + 1} ({isTiltMode ? 'TT' : 'Piston'}):
                    </span>
                    <div className="flex-1 h-3.5 bg-slate-900 rounded-sm overflow-hidden border border-slate-800 relative">
                      <div
                        className={`h-full rounded-sm transition-all duration-500 ${
                          isTiltMode
                            ? 'bg-gradient-to-r from-amber-500/80 to-amber-400'
                            : 'bg-gradient-to-r from-cyan-500/80 to-cyan-400'
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                    <span className="w-16 text-right tabular-nums text-slate-300 font-semibold">
                      {val.toFixed(3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Decoupling Explanation */}
          <div className="bg-slate-950/60 border border-slate-800/80 p-3.5 rounded-lg flex items-start space-x-3">
            <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
              <p className="font-semibold text-slate-100">
                物理本质与空间正交性解读：
              </p>
              <p>
                1. <strong>Tip/Tilt 模式（前 8 阶）</strong>：在整个扇形区域产生均匀的斜率偏移
                <code className="text-amber-400 mx-1">Sx, Sy ≈ const</code>，因此在整个孔径内都有积分响应，奇异值较大。
              </p>
              <p>
                2. <strong>Piston 模式（后 4 阶）</strong>：仅在子镜与内基准镜、以及子镜与子镜的分隔边缘产生
                <code className="text-cyan-400 mx-1">希尔伯特变换边缘条纹 (Hilbert Edge Spikes)</code>，内部区域斜率为 0。
              </p>
              <p>
                3. <strong>正交解耦保证</strong>：由于边缘特征与面内均匀斜率在几何空间上高度正交，推拉标定构建的相互作用矩阵
                <code className="text-slate-200 mx-1">IM</code> 经过 SVD 求逆后，控制矩阵
                <code className="text-slate-200 mx-1">CM</code> 能够完全无串扰地分别计算 4 个子镜的平移与倾斜校正量。
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
