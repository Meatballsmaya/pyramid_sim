import React, { useState } from 'react';
import { X, BookOpen, Layers, Cpu, Compass, Activity } from 'lucide-react';

interface TheoryHandbookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TheoryHandbookModal: React.FC<TheoryHandbookModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'pwfs' | 'hilbert' | 'matrix' | 'actuators'>('pwfs');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-3">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100 tracking-wide">
                PWFS 拼接子镜精共相共焦工程原理与控制手册
              </h3>
              <p className="text-[11px] text-slate-400">
                Pyramid Wavefront Sensor Co-phasing & Modal Decoupling Reference
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6">
          <button
            onClick={() => setActiveTab('pwfs')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'pwfs'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>1. PWFS 4f 光学原理</span>
          </button>
          <button
            onClick={() => setActiveTab('hilbert')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'hilbert'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>2. 边缘希尔伯特变换 (Piston 传感)</span>
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'matrix'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>3. 推拉标定与控制矩阵 (IM & CM)</span>
          </button>
          <button
            onClick={() => setActiveTab('actuators')}
            className={`flex items-center space-x-2 py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'actuators'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>4. 12 促动器几何映射闭环</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-300">
          {activeTab === 'pwfs' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>金字塔波前传感器 (PWFS) 4f 傅里叶光学系统</span>
              </h4>
              <p>
                PWFS 是一种焦平面波前传感器。光路系统结构如下：
              </p>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300">
                出瞳平面 E_pupil(x,y) ──[透镜 L1]──► 焦平面 (金字塔顶点) ──[中继透镜 L2]──► 探测器平面 (4个出瞳像)
              </div>
              <p>
                在焦平面处，放置一个具有 4 个折射面的玻璃金字塔棱镜。焦平面的光场经金字塔的 4 个面产生方向不同的空间相位偏折：
              </p>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[11px]">
                Mask(u, v) = exp( -i · 2π/N · s · (|u| + |v|) )
              </div>
              <p>
                通过中继透镜成像后，在探测器上形成 4 个分离的出瞳图像：
                <code className="text-amber-300 mx-1">I_TL, I_TR, I_BL, I_BR</code>。
                通过横向和纵向差分归一化，得到出瞳波前的双向斜率信号：
              </p>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 font-mono text-[11px] text-emerald-300">
                Sx(x,y) = [(I_TR + I_BR) - (I_TL + I_BL)] / (I_total + ε)<br />
                Sy(x,y) = [(I_TL + I_TR) - (I_BL + I_BR)] / (I_total + ε)
              </div>
            </div>
          )}

          {activeTab === 'hilbert' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-100">
                为什么 PWFS 能检测平移误差 (Piston)？—— 希尔伯特变换
              </h4>
              <p>
                传统哈特曼传感器 (SHWFS) 只能测量连续波前的局部梯度，对拼接子镜间的离散阶跃（Piston）完全不敏感。
                但 PWFS 本质上是一个<strong>刀口检验法 (Foucault knife-edge test)</strong> 的 2D 推广。
              </p>
              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-lg space-y-2">
                <p className="font-semibold text-slate-200">物理推导核心：</p>
                <p>
                  在弱像差近似下（线性捕获区间内），金字塔棱脊对光瞳平面的相位滤波作用相当于一个
                  <span className="text-cyan-400 font-bold mx-1">希尔伯特变换 (Hilbert Transform)</span>：
                </p>
                <div className="font-mono text-cyan-300 bg-slate-900 p-2 rounded text-[11px]">
                  S_x(x, y) ∝ ℋ_x{'{'}φ(x, y){'}'} = (1 / π) ∫ [ φ(x', y) / (x - x') ] dx'
                </div>
                <p>
                  当两块拼接子镜交界处存在平移阶跃 <code className="text-amber-300">Δφ = 4π·Δz / λ</code> 时：
                </p>
                <div className="font-mono text-amber-300 bg-slate-900 p-2 rounded text-[11px]">
                  φ(x) = Δφ · sign(x) ──► ℋ{'{'}sign(x){'}'} ∝ (2 / π) · ln|x|
                </div>
              </div>
              <p>
                因此，平移误差在子镜边缘产生极其鲜明、对称的<strong className="text-cyan-300">明暗干涉尖峰条纹</strong>！
                本应用界面中的「残差希尔伯特条纹视图」，正是扣除了整块子镜的平均斜率后，清晰呈现的纯净平移干涉尖峰！
              </p>
            </div>
          )}

          {activeTab === 'matrix' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-100">
                推拉标定与控制矩阵 (Interaction & Control Matrix)
              </h4>
              <p>
                为了消除 Piston 与 Tip/Tilt 之间的潜在耦合，系统采用<strong>模态控制法 (Modal Control)</strong>：
              </p>
              <div className="space-y-2">
                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                  <span className="font-semibold text-cyan-400 block">1. 差分推拉标定 (Push-Pull Calibration):</span>
                  <p className="text-[11px]">
                    对 12 个正交模态（4个扇区的 Piston, Tilt X, Tip Y），分别施加正微扰 <code className="text-slate-200">+Δm_j</code> 与负微扰 <code className="text-slate-200">-Δm_j</code>：
                  </p>
                  <div className="font-mono text-emerald-300 bg-slate-900 p-1.5 rounded text-[11px]">
                    col_j(IM) = [ S(+Δm_j) - S(-Δm_j) ] / (2 · Δm_j)
                  </div>
                  <p className="text-[11px] text-slate-400">
                    一阶差分能够完全消除探测器的偶数阶非对称性与零位直流偏置！
                  </p>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                  <span className="font-semibold text-amber-400 block">2. SVD 奇异值分解与求逆:</span>
                  <p className="text-[11px]">
                    相互作用矩阵 <code className="text-slate-200">IM</code> 尺寸为 <code className="text-slate-200">(2M) × 12</code>。
                    利用奇异值分解 <code className="text-slate-200">IM = U Σ V^T</code>，计算控制矩阵 <code className="text-slate-200">CM</code>：
                  </p>
                  <div className="font-mono text-cyan-300 bg-slate-900 p-1.5 rounded text-[11px]">
                    CM = (IM^T · IM + α·I)^(-1) · IM^T = V · diag(σ_i / (σ_i² + α)) · U^T
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                  <span className="font-semibold text-emerald-400 block">3. 实时闭环解算与负反馈调节:</span>
                  <p className="text-[11px]">
                    每一次闭环采样：
                  </p>
                  <div className="font-mono text-slate-200 bg-slate-900 p-1.5 rounded text-[11px]">
                    ΔModes = CM × (S_current - S_ref)<br />
                    ΔActuators = G × ΔModes<br />
                    Actuators^(k+1) = Actuators^(k) - gain × ΔActuators
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'actuators' && (
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-slate-100">
                12 压电促动器空间几何布局与刚体运动学映射
              </h4>
              <p>
                每一个扇形子镜由 3 个高精度压电陶瓷促动器 (Piezo Actuators) 构成三点平面支承：
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>促动器 1 (C_q1): 位于内弧圆周处 (r ≈ 0.34)</li>
                <li>促动器 2 (C_q2): 位于外弧低角度端 (r ≈ 0.82)</li>
                <li>促动器 3 (C_q3): 位于外弧高角度端 (r ≈ 0.82)</li>
              </ul>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
                <span className="font-semibold text-slate-200 block">小位移刚体几何转换矩阵 G_q：</span>
                <div className="font-mono text-cyan-300 bg-slate-900 p-2 rounded text-[11px]">
                  [ d_1 ] &nbsp; [ 1 &nbsp; (x_1 - x_c)·scale &nbsp; (y_1 - y_c)·scale ] &nbsp; [ Piston ]<br />
                  [ d_2 ] = [ 1 &nbsp; (x_2 - x_c)·scale &nbsp; (y_2 - y_c)·scale ] × [ Tilt_X ]<br />
                  [ d_3 ] &nbsp; [ 1 &nbsp; (x_3 - x_c)·scale &nbsp; (y_3 - y_c)·scale ] &nbsp; [ Tip_Y  ]
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  由于三点不共线，矩阵 G_q 严格可逆。通过 G_q^(-1)，12 个促动器的物理伸缩量与 4 个子镜的 PTT 模态之间完全一一映射！
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition"
          >
            完成阅读
          </button>
        </div>
      </div>
    </div>
  );
};
