import React from 'react';
import { CircuitBreakersResponse, DailyAnalyticsPoint } from '../../api/types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  TrendingUp, 
  Activity, 
  Layers, 
  DollarSign,
  Compass
} from 'lucide-react';

interface BentoSummaryProps {
  latestPoint?: DailyAnalyticsPoint;
  circuitBreakers?: CircuitBreakersResponse | null;
  onSelectStudio?: (studio: 'valuation' | 'lttd' | 'mttd' | 'ichimoku') => void;
}

export const BentoSummary: React.FC<BentoSummaryProps> = ({ 
  latestPoint, 
  circuitBreakers,
  onSelectStudio 
}) => {
  if (!latestPoint || !circuitBreakers) {
    return (
      <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading real-time quantitative bento telemetry...
      </div>
    );
  }

  const valScore = latestPoint.valuation_composite;
  const isBubble = valScore >= 1.50 || circuitBreakers.valuation_circuit_breaker.is_bubble_risk;
  const isDiscount = valScore <= -1.00 || circuitBreakers.valuation_circuit_breaker.is_deep_discount;

  const lttdRegime = latestPoint.lttd_regime || circuitBreakers.lttd_macro_override.regime;
  const isSidewaysOverride = lttdRegime === 'SIDEWAYS' || circuitBreakers.lttd_macro_override.is_sideways_override;

  const mttdImo = latestPoint.mttd_imo;
  const { er_gate_open, shannon_entropy_gate_open, chikou_momentum_exit } = circuitBreakers.mttd_consensus_gates;

  const ichimokuImo = latestPoint.ichimoku_imo;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '20px',
      marginBottom: '8px'
    }}>
      {/* 1. Valuation Composite Card */}
      <div 
        className={`glass-card ${isBubble ? 'glow-danger' : isDiscount ? 'glow-cyan' : ''}`}
        onClick={() => onSelectStudio?.('valuation')}
        style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Valuation Pillar
            </span>
            <DollarSign size={18} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: isBubble ? 'var(--status-danger)' : isDiscount ? 'var(--accent-cyan)' : 'var(--text-main)' }}>
            {valScore > 0 ? `+${valScore.toFixed(4)}` : valScore.toFixed(4)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Scale [-2.00 to +2.00] • 17 Indicators
          </div>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isBubble ? (
            <>
              <AlertTriangle size={16} style={{ color: 'var(--status-danger)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-danger)' }}>BUBBLE RISK (Score ≥ +1.50)</span>
            </>
          ) : isDiscount ? (
            <>
              <CheckCircle2 size={16} style={{ color: 'var(--accent-cyan)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-cyan)' }}>DEEP DISCOUNT (Score ≤ -1.00)</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
              <span style={{ fontSize: '12px', color: 'var(--status-success)' }}>FAIR VALUE / NEUTRAL</span>
            </>
          )}
        </div>
      </div>

      {/* 2. LTTD Regime (3-State Gaussian HMM) Card */}
      <div 
        className={`glass-card ${isSidewaysOverride ? 'glow-gold' : ''}`}
        onClick={() => onSelectStudio?.('lttd')}
        style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              LTTD Regime (HMM)
            </span>
            <TrendingUp size={18} style={{ color: isSidewaysOverride ? 'var(--accent-gold)' : 'var(--status-success)' }} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: lttdRegime === 'BULL' ? 'var(--status-success)' : lttdRegime === 'BEAR' ? 'var(--status-danger)' : 'var(--accent-gold)' }}>
            {lttdRegime}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Gaussian HMM • Returns & 20d Volatility
          </div>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isSidewaysOverride ? (
            <>
              <ShieldAlert size={16} style={{ color: 'var(--accent-gold)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-gold)' }}>OVERRIDE: 0.0% CASH EXPOSURE</span>
            </>
          ) : (
            <>
              <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
              <span style={{ fontSize: '12px', color: 'var(--status-success)' }}>Exposure Multiplier: {circuitBreakers.lttd_macro_override.exposure_multiplier * 100}%</span>
            </>
          )}
        </div>
      </div>

      {/* 3. MTTD Console (10 Statistical Families) Card */}
      <div 
        className="glass-card"
        onClick={() => onSelectStudio?.('mttd')}
        style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              MTTD Consensus (IMO)
            </span>
            <Activity size={18} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: mttdImo > 0.2 ? 'var(--status-success)' : mttdImo < -0.2 ? 'var(--status-danger)' : 'var(--text-main)' }}>
            {mttdImo > 0 ? `+${mttdImo.toFixed(4)}` : mttdImo.toFixed(4)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            10 Statistical Families Consensus [-1, +1]
          </div>
        </div>
        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontFamily: 'JetBrains Mono' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ER Gate (≥0.20):</span>
            <span style={{ color: er_gate_open ? 'var(--status-success)' : 'var(--status-danger)' }}>{er_gate_open ? 'PASSED' : 'BLOCKED'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Shannon Entropy (≤2.30):</span>
            <span style={{ color: shannon_entropy_gate_open ? 'var(--status-success)' : 'var(--status-danger)' }}>{shannon_entropy_gate_open ? 'PASSED' : 'HIGH NOISE'}</span>
          </div>
        </div>
      </div>

      {/* 4. Ichimoku Denoised Oscillator Card */}
      <div 
        className="glass-card"
        onClick={() => onSelectStudio?.('ichimoku')}
        style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ichimoku SuperSmoother
            </span>
            <Layers size={18} style={{ color: '#0055ff' }} />
          </div>
          <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'JetBrains Mono', color: ichimokuImo > 0 ? 'var(--accent-cyan)' : 'var(--status-danger)' }}>
            {ichimokuImo > 0 ? `+${ichimokuImo.toFixed(4)}` : ichimokuImo.toFixed(4)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            Ehlers 2-pole IIR Bounded tanh
          </div>
        </div>
        <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'JetBrains Mono' }}>
          <span style={{ color: 'var(--text-muted)' }}>Cloud State:</span>
          <span style={{ color: ichimokuImo > 0.15 ? 'var(--status-success)' : ichimokuImo < -0.15 ? 'var(--status-danger)' : 'var(--accent-gold)', fontWeight: 600 }}>
            {ichimokuImo > 0.15 ? 'BULL CLOUD' : ichimokuImo < -0.15 ? 'BEAR CLOUD' : 'NEUTRAL CLOUD'}
          </span>
        </div>
      </div>
    </div>
  );
};
