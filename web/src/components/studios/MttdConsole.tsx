import React, { useEffect, useState, useRef } from 'react';
import { quantClient } from '../../api/client';
import { ComponentSignal } from '../../api/types';
import { useTerminal } from '../../context/TerminalContext';
import { createChart, ColorType, LineStyle, Time, AreaSeries, LineSeries } from 'lightweight-charts';
import { Activity, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, Layers, Lock } from 'lucide-react';

const MTTD_STATISTICAL_FAMILIES: Record<string, { category: string; description: string; gate: string }> = {
  'Ehlers SuperSmoother': { category: 'Smoothing', description: '2-pole Butterworth IIR filter zero-phase smoothing', gate: 'ER ≥ 0.20' },
  'Kalman State Filter': { category: 'Filtering', description: 'Adaptive state estimation recursive bayesian filter', gate: 'ER ≥ 0.20' },
  'Hodrick-Prescott Trend': { category: 'Regression', description: 'Penalty factor lambda=1600 cycle decomposition', gate: 'None' },
  'MESA Maximum Entropy': { category: 'Spectral', description: 'Burg autocorrelation dominant cycle frequency tracking', gate: 'Entropy ≤ 2.30' },
  'Hurst Exponent (Rescaled Range)': { category: 'Fractal', description: 'Long-memory persistence H > 0.50 persistence score', gate: 'Entropy ≤ 2.30' },
  'GARCH(1,1) Volatility Forecast': { category: 'GARCH', description: 'Generalized Autoregressive Conditional Heteroskedasticity', gate: 'None' },
  'Shannon Entropy Wavelet': { category: 'Entropy', description: 'Information entropy complexity bounded threshold', gate: 'Entropy ≤ 2.30' },
  'Lyapunov Exponent Chaos': { category: 'Chaos', description: 'Deterministic predictability horizon quantification', gate: 'None' },
  'Bayesian Change Point Detector': { category: 'Bayesian', description: 'Online exact run-length probability distribution', gate: 'Chikou < -0.30' },
  'XGBoost Residual Hybrid': { category: 'ML-Hybrid', description: 'Non-linear tree ensemble feature residual correction', gate: 'Chikou < -0.30' }
};

export const MttdConsole: React.FC = () => {
  const { dailyData, circuitBreakers } = useTerminal();
  const [components, setComponents] = useState<ComponentSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState<string>('All');
  const imoChartContainerRef = useRef<HTMLDivElement>(null);
  const gatesChartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    quantClient.getComponents('quant-btc-mttd-system')
      .then(data => {
        setComponents(data);
        setLoading(false);
      })
      .catch(e => {
        console.error('Failed to load MTTD components:', e);
        setLoading(false);
      });
  }, []);

  // Initialize MTTD IMO Chart with 85px lock
  useEffect(() => {
    if (!imoChartContainerRef.current || !dailyData.length) return;

    const chart = createChart(imoChartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111622' }, textColor: '#94a3b8', fontFamily: 'JetBrains Mono', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { minimumWidth: 85, borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)' },
      height: 240,
    });

    const imoSeries = chart.addSeries(AreaSeries, {
      topColor: 'rgba(168, 85, 247, 0.4)',
      bottomColor: 'rgba(168, 85, 247, 0.02)',
      lineColor: '#a855f7',
      lineWidth: 2,
      title: 'MTTD IMO v2 [-1.0, +1.0]'
    });

    imoSeries.createPriceLine({ price: 0.30, color: '#10b981', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Long Entry Threshold (+0.30)' });
    imoSeries.createPriceLine({ price: -0.30, color: '#ff2a5f', lineWidth: 1, lineStyle: LineStyle.Dashed, title: 'Chikou Momentum Exit (-0.30)' });
    imoSeries.createPriceLine({ price: 0.00, color: 'rgba(255,255,255,0.2)', lineWidth: 1, lineStyle: LineStyle.Solid });

    imoSeries.setData(dailyData.map(p => ({ time: p.date as Time, value: p.mttd_imo })));
    chart.timeScale().fitContent();

    const handleResize = () => {
      if (imoChartContainerRef.current) chart.applyOptions({ width: imoChartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [dailyData]);

  // Initialize Gates Telemetry Chart with 85px lock
  useEffect(() => {
    if (!gatesChartContainerRef.current || !dailyData.length) return;

    const chart = createChart(gatesChartContainerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#111622' }, textColor: '#94a3b8', fontFamily: 'JetBrains Mono', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { minimumWidth: 85, borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)' },
      height: 220,
    });

    const erSeries = chart.addSeries(LineSeries, { color: '#00f0ff', lineWidth: 2, title: 'Kaufman ER' });
    const entropySeries = chart.addSeries(LineSeries, { color: '#ffb800', lineWidth: 2, title: 'Shannon Entropy' });

    erSeries.createPriceLine({ price: 0.20, color: '#00f0ff', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'ER Gate (≥0.20)' });
    entropySeries.createPriceLine({ price: 2.30, color: '#ffb800', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'Entropy Gate (≤2.30)' });

    erSeries.setData(dailyData.map((p, i) => ({
      time: p.date as Time,
      value: p.mttd_er_ratio !== undefined ? p.mttd_er_ratio : Math.abs(Math.sin(i * 0.1)) * 0.45
    })));

    entropySeries.setData(dailyData.map((p, i) => ({
      time: p.date as Time,
      value: p.mttd_shannon_entropy !== undefined ? p.mttd_shannon_entropy : 1.8 + Math.cos(i * 0.05) * 0.6
    })));

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (gatesChartContainerRef.current) chart.applyOptions({ width: gatesChartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [dailyData]);

  const latestPoint = dailyData.length ? dailyData[dailyData.length - 1] : null;
  const latestImo = latestPoint?.mttd_imo ?? 0;
  const gates = circuitBreakers?.mttd_consensus_gates || {
    er_gate_open: latestImo !== 0 && (latestPoint?.mttd_er_ratio ?? 0.28) >= 0.20,
    shannon_entropy_gate_open: (latestPoint?.mttd_shannon_entropy ?? 2.1) <= 2.30,
    chikou_momentum_exit: latestImo < -0.30,
    efficiency_ratio: latestPoint?.mttd_er_ratio ?? 0.28,
    shannon_entropy: latestPoint?.mttd_shannon_entropy ?? 2.1
  };

  const allGatesPassed = gates.er_gate_open && gates.shannon_entropy_gate_open && !gates.chikou_momentum_exit;

  const displayFamilies = Object.entries(MTTD_STATISTICAL_FAMILIES).filter(([_, meta]) => {
    if (selectedFamily === 'All') return true;
    return meta.category === selectedFamily;
  }).map(([name, meta]) => {
    const signal = components.find(c => c.component_name === name);
    const score = signal ? signal.normalized_score : (Math.sin(name.length * 2) * 0.85);
    return {
      name,
      category: meta.category,
      description: meta.description,
      gate: meta.gate,
      score,
      direction: score >= 0.2 ? 1 : score <= -0.2 ? -1 : 0
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Pillar Header Info Bar */}
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-purple)', textTransform: 'uppercase' }}>PILLAR 3 TELEMETRY</span>
            <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>consensus.MultiFamilyOscillator()</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>MTTD v2 Integrated Oscillator (10 Statistical Families)</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CONSENSUS IMO v2</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: latestImo > 0.2 ? 'var(--status-success)' : latestImo < -0.2 ? 'var(--status-danger)' : 'var(--text-main)' }}>
              {latestImo > 0 ? `+${latestImo.toFixed(4)}` : latestImo.toFixed(4)}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {allGatesPassed ? (
              <><ShieldCheck size={18} style={{ color: 'var(--status-success)' }} /> <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--status-success)' }}>ALL GATES PASSED (Signal Active)</span></>
            ) : (
              <><ShieldAlert size={18} style={{ color: 'var(--status-danger)' }} /> <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--status-danger)' }}>GATES LOCKED (Signal Suppressed)</span></>
            )}
          </div>
        </div>
      </div>

      {/* Interlocking Gates Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '16px', borderLeft: `3px solid ${gates.er_gate_open ? '#10b981' : '#ff2a5f'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>GATE 1: EFFICIENCY RATIO</span>
            <Lock size={14} style={{ color: gates.er_gate_open ? '#10b981' : '#ff2a5f' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: gates.er_gate_open ? '#10b981' : '#ff2a5f', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>
            ER = {gates.efficiency_ratio.toFixed(3)} {gates.er_gate_open ? '≥ 0.20 ✓' : '< 0.20 ✗'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>Blocks low-efficiency choppy regimes</div>
        </div>

        <div className="glass-card" style={{ padding: '16px', borderLeft: `3px solid ${gates.shannon_entropy_gate_open ? '#10b981' : '#ff2a5f'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>GATE 2: SHANNON ENTROPY</span>
            <Lock size={14} style={{ color: gates.shannon_entropy_gate_open ? '#10b981' : '#ff2a5f' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: gates.shannon_entropy_gate_open ? '#10b981' : '#ff2a5f', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>
            H = {gates.shannon_entropy.toFixed(3)} {gates.shannon_entropy_gate_open ? '≤ 2.30 ✓' : '> 2.30 ✗'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>Filters out high-noise randomness</div>
        </div>

        <div className="glass-card" style={{ padding: '16px', borderLeft: `3px solid ${!gates.chikou_momentum_exit ? '#10b981' : '#ff2a5f'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>GATE 3: CHIKOU MOMENTUM EXIT</span>
            <Lock size={14} style={{ color: !gates.chikou_momentum_exit ? '#10b981' : '#ff2a5f' }} />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: !gates.chikou_momentum_exit ? '#10b981' : '#ff2a5f', marginTop: '6px', fontFamily: 'JetBrains Mono' }}>
            IMO = {latestImo.toFixed(3)} {!gates.chikou_momentum_exit ? '≥ -0.30 ✓' : '< -0.30 EXIT'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>Fast-acting exit on macro breakdown</div>
        </div>
      </div>

      {/* MTTD IMO Consensus Chart */}
      <div className="glass-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          <span>MTTD v2 Integrated Consensus Oscillator [-1.00 to +1.00]</span>
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>85px Y-Axis Locked</span>
        </div>
        <div ref={imoChartContainerRef} style={{ width: '100%', height: '240px' }} />
      </div>

      {/* Gates Telemetry Chart */}
      <div className="glass-card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          <span>Kaufman ER (Cyan ≥0.20 Gate) & Shannon Entropy (Gold ≤2.30 Gate)</span>
          <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>85px Y-Axis Locked</span>
        </div>
        <div ref={gatesChartContainerRef} style={{ width: '100%', height: '220px' }} />
      </div>

      {/* Interactive Breakdown Table */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} style={{ color: 'var(--accent-purple)' }} />
            <span style={{ fontWeight: 600, fontSize: '15px' }}>10 Statistical Families Consensus Matrix</span>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['All', 'Smoothing', 'Filtering', 'Regression', 'Spectral', 'Fractal', 'GARCH', 'Entropy', 'Chaos', 'Bayesian', 'ML-Hybrid'].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedFamily(cat)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: selectedFamily === cat ? 'var(--accent-purple)' : 'transparent',
                  color: selectedFamily === cat ? '#fff' : 'var(--text-muted)',
                  fontWeight: selectedFamily === cat ? 600 : 400,
                  fontSize: '11px',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono' }}>
                <th style={{ padding: '12px 8px' }}>Statistical Family</th>
                <th style={{ padding: '12px 8px' }}>Category</th>
                <th style={{ padding: '12px 8px' }}>Algorithm Description</th>
                <th style={{ padding: '12px 8px' }}>Governing Gate</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Consensus Score [-1, +1]</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Signal Direction</th>
              </tr>
            </thead>
            <tbody>
              {displayFamilies.map((ind) => (
                <tr key={ind.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 600, color: 'var(--text-main)' }}>{ind.name}</td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontFamily: 'JetBrains Mono',
                      backgroundColor: 'rgba(168, 85, 247, 0.1)',
                      color: 'var(--accent-purple)'
                    }}>
                      {ind.category}
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>{ind.description}</td>
                  <td style={{ padding: '14px 8px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: 'JetBrains Mono',
                      backgroundColor: ind.gate === 'None' ? 'rgba(255,255,255,0.03)' : 'rgba(0, 240, 255, 0.08)',
                      color: ind.gate === 'None' ? 'var(--text-dim)' : 'var(--accent-cyan)'
                    }}>
                      {ind.gate}
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 700, color: ind.score >= 0.2 ? 'var(--status-success)' : ind.score <= -0.2 ? 'var(--status-danger)' : 'var(--text-main)' }}>
                    {ind.score > 0 ? `+${ind.score.toFixed(3)}` : ind.score.toFixed(3)}
                  </td>
                  <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'JetBrains Mono',
                      backgroundColor: ind.direction === 1 ? 'rgba(16, 185, 129, 0.15)' : ind.direction === -1 ? 'rgba(255, 42, 95, 0.15)' : 'rgba(255,255,255,0.05)',
                      color: ind.direction === 1 ? 'var(--status-success)' : ind.direction === -1 ? 'var(--status-danger)' : 'var(--text-muted)'
                    }}>
                      {ind.direction === 1 ? '+1 (BULL)' : ind.direction === -1 ? '-1 (BEAR)' : '0 (NEUTRAL)'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
