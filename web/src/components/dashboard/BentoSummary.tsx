import type React from 'react';
import { useState, useRef } from 'react';
import type { CircuitBreakersResponse, DailyAnalyticsPoint } from '../../api/types';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  TrendingUp, 
  Activity, 
  Layers, 
  DollarSign,
  ArrowRight,
  Terminal,
  Cpu,
  Database,
  Lock
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

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
  const [activeAccordion, setActiveAccordion] = useState<'valuation' | 'lttd' | 'mttd' | 'ichimoku'>('valuation');
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const bentoRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // 1. Hero entrance animation
    if (heroRef.current) {
      gsap.fromTo(
        heroRef.current.children,
        { y: 35, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out' }
      );
    }

    // 2. Bento Grid staggered reveal on scroll
    if (bentoRef.current) {
      gsap.fromTo(
        bentoRef.current.children,
        { y: 40, opacity: 0, scale: 0.98 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: bentoRef.current,
            start: 'top 85%',
          },
        }
      );
    }
  }, { scope: containerRef });

  if (!latestPoint || !circuitBreakers) {
    return (
      <div className="glass-card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Geist Mono, monospace' }}>
        Initializing CausalFilter $t-1$ & SQLite WAL Telemetry...
      </div>
    );
  }

  const toNum = (val: any): number => typeof val === 'object' && val !== null ? Number(val.score ?? val.oscillator ?? 0) : Number(val ?? 0);
  const valScore = toNum(latestPoint.valuation_composite);
  const isBubble = valScore >= 1.50 || circuitBreakers.valuation_circuit_breaker.is_bubble_risk;
  const isDiscount = valScore <= -1.00 || circuitBreakers.valuation_circuit_breaker.is_deep_discount;

  const lttdRegime = typeof latestPoint.lttd_regime === 'object' && latestPoint.lttd_regime !== null ? (latestPoint.lttd_regime as any).regime : (latestPoint.lttd_regime || circuitBreakers.lttd_macro_override.regime);
  const isSidewaysOverride = lttdRegime === 'SIDEWAYS' || circuitBreakers.lttd_macro_override.is_sideways_override;

  const mttdImo = toNum(latestPoint.mttd_imo);
  const { er_gate_open, shannon_entropy_gate_open } = circuitBreakers.mttd_consensus_gates;

  const ichimokuImo = toNum(latestPoint.ichimoku_imo);

  // Marquee items
  const statisticalFamilies = [
    'Smoothing Family', 'Filtering Family', 'Regression Family', 'Spectral Family', 
    'Fractal Family', 'GARCH Volatility', 'Shannon Entropy', 'Chaos Theory', 
    'Bayesian Inference', 'ML-Hybrid Consensus', 'CausalFilter t-1', 'MasterOHLCV Canonical'
  ];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
      
      {/* ─── ATTENTION: Cinematic Center Hero Showcase ─── */}
      <div 
        ref={heroRef}
        style={{
          width: '100%',
          maxWidth: '1152px',
          margin: '0 auto',
          padding: '24px 16px 12px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          position: 'relative',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-panel)', color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'Geist Mono, JetBrains Mono, monospace', fontWeight: 600 }}>
          <Lock size={12} style={{ color: 'var(--accent)' }} />
          <span>ZERO LOOKAHEAD BIAS ($t-1$) · WAL CONCURRENCY :8910</span>
        </div>

        <h2 style={{
          fontSize: 'clamp(32px, 4.8vw, 54px)',
          fontWeight: 800,
          letterSpacing: '-1.4px',
          lineHeight: '1.08',
          color: 'var(--text-main)',
          fontFamily: 'Geist, -apple-system, BlinkMacSystemFont, sans-serif',
          maxWidth: '860px',
          margin: '4px 0'
        }}>
          Unified 4-System Quantitative Defense &amp; High-End Financial Terminal.
        </h2>

        <p style={{
          fontSize: 'clamp(14px, 1.5vw, 16px)',
          color: 'var(--text-dim)',
          maxWidth: '650px',
          lineHeight: '1.5',
          fontFamily: 'Geist, sans-serif'
        }}>
          Macroeconomic piecewise linear interpolation, 3-State Gaussian HMM regime filters, and multi-principle stationary consensus.
        </p>

        {/* High-Contrast Dual CTAs (Anti-wrap single-line discipline) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '14px', marginTop: '12px' }}>
          <button
            onClick={() => onSelectStudio?.('valuation')}
            className="tactile-btn tactile-btn-primary"
          >
            <span>LAUNCH VALUATION PILLAR</span>
            <ArrowRight size={14} />
          </button>

          <button
            onClick={() => onSelectStudio?.('lttd')}
            className="tactile-btn tactile-btn-secondary"
          >
            <Terminal size={14} style={{ color: 'var(--accent)' }} />
            <span>EXPLORE QUANT DEFENSE</span>
          </button>
        </div>
      </div>

      {/* ─── INTEREST: Gapless Interlocking Bento Grid (grid-flow-dense) ─── */}
      <div ref={bentoRef} className="bento-dense-grid">
        
        {/* 1. Valuation Composite Pillar (Span 2x2) */}
        <div 
          className={`glass-card hover-physics-card bento-span-2-2 ${isBubble ? 'glow-danger' : isDiscount ? 'glow-accent' : ''}`}
          onClick={() => onSelectStudio?.('valuation')}
          style={{ padding: '24px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '230px' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', fontFamily: 'Geist Mono, JetBrains Mono, monospace' }}>
                  Macro Valuation Pillar
                </span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(255,255,255,0.06)', fontFamily: 'Geist Mono, monospace', color: 'var(--text-dim)' }}>
                  17 INDICATORS
                </span>
              </div>
              <DollarSign size={18} style={{ color: 'var(--accent)' }} />
            </div>

            <div style={{ fontSize: 'clamp(34px, 4.2vw, 46px)', fontWeight: 800, fontFamily: 'Geist Mono, JetBrains Mono, monospace', color: isBubble ? 'var(--status-danger)' : isDiscount ? 'var(--accent)' : 'var(--text-main)', letterSpacing: '-1.5px', lineHeight: '1.0' }}>
              {valScore > 0 ? `+${valScore.toFixed(4)}` : valScore.toFixed(4)}
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px', lineHeight: '1.4' }}>
              Piecewise linear interpolation bounded to [-2.00, +2.00]. Acts as the canonical primary macro circuit breaker when score crosses bubble threshold.
            </p>
          </div>

          <div>
            {/* Progress Bar Scale */}
            <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--bg-root)', borderRadius: '2px', overflow: 'hidden', margin: '16px 0 14px 0', position: 'relative' }}>
              <div style={{
                width: `${Math.max(5, Math.min(100, ((valScore + 2.0) / 4.0) * 100))}%`,
                height: '100%',
                backgroundColor: isBubble ? 'var(--status-danger)' : isDiscount ? 'var(--accent)' : 'var(--status-success)',
                transition: 'width 0.5s ease'
              }} />
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isBubble ? (
                  <>
                    <AlertTriangle size={15} style={{ color: 'var(--status-danger)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-danger)', fontFamily: 'Geist Mono, monospace' }}>BUBBLE RISK (≥ +1.50)</span>
                  </>
                ) : isDiscount ? (
                  <>
                    <CheckCircle2 size={15} style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace' }}>DEEP DISCOUNT (≤ -1.00)</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} style={{ color: 'var(--status-success)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--status-success)', fontFamily: 'Geist Mono, monospace' }}>FAIR VALUE · CANONICAL OHLCV</span>
                  </>
                )}
              </div>

              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: 'Geist Mono, monospace' }}>
                Studio Details <ArrowRight size={12} />
              </span>
            </div>
          </div>
        </div>

        {/* 2. LTTD Regime HMM Card (Span 1x1) */}
        <div 
          className={`glass-card hover-physics-card bento-span-1-1 ${isSidewaysOverride ? 'glow-accent' : ''}`}
          onClick={() => onSelectStudio?.('lttd')}
          style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: 'Geist Mono, monospace' }}>
                LTTD Regime (HMM)
              </span>
              <TrendingUp size={16} style={{ color: isSidewaysOverride ? 'var(--accent)' : 'var(--status-success)' }} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Geist Mono, JetBrains Mono, monospace', color: lttdRegime === 'BULL' ? 'var(--status-success)' : lttdRegime === 'BEAR' ? 'var(--status-danger)' : 'var(--accent)', letterSpacing: '-0.8px' }}>
              {lttdRegime}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              3-State Gaussian HMM · Log Returns &amp; 20d Vol
            </div>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isSidewaysOverride ? (
              <>
                <ShieldAlert size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace' }}>OVERRIDE: 0.0% EXPOSURE</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} style={{ color: 'var(--status-success)' }} />
                <span style={{ fontSize: '11px', color: 'var(--status-success)', fontFamily: 'Geist Mono, monospace' }}>Exposure Multiplier: {circuitBreakers.lttd_macro_override.exposure_multiplier * 100}%</span>
              </>
            )}
          </div>
        </div>

        {/* 3. MTTD Consensus IMO Card (Span 1x2) */}
        <div 
          className="glass-card hover-physics-card bento-span-1-2"
          onClick={() => onSelectStudio?.('mttd')}
          style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '230px' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: 'Geist Mono, monospace' }}>
                MTTD Consensus (v2)
              </span>
              <Activity size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Geist Mono, JetBrains Mono, monospace', color: mttdImo > 0.2 ? 'var(--status-success)' : mttdImo < -0.2 ? 'var(--status-danger)' : 'var(--text-main)', letterSpacing: '-0.8px' }}>
              {mttdImo > 0 ? `+${mttdImo.toFixed(4)}` : mttdImo.toFixed(4)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Consensus across 10 Statistical Families [-1, +1]
            </div>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', fontFamily: 'Geist Mono, monospace' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>ER Gate (≥0.20):</span>
              <span style={{ fontWeight: 600, color: er_gate_open ? 'var(--status-success)' : 'var(--status-danger)' }}>{er_gate_open ? 'PASSED' : 'BLOCKED'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Shannon Entropy:</span>
              <span style={{ fontWeight: 600, color: shannon_entropy_gate_open ? 'var(--status-success)' : 'var(--status-danger)' }}>{shannon_entropy_gate_open ? 'PASSED' : 'HIGH NOISE'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Open Console</span>
              <ArrowRight size={12} style={{ color: 'var(--accent)' }} />
            </div>
          </div>
        </div>

        {/* 4. Ichimoku SuperSmoother Card (Span 1x1) */}
        <div 
          className="glass-card hover-physics-card bento-span-1-1"
          onClick={() => onSelectStudio?.('ichimoku')}
          style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: 'Geist Mono, monospace' }}>
                Ichimoku SuperSmoother
              </span>
              <Layers size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'Geist Mono, JetBrains Mono, monospace', color: ichimokuImo > 0 ? 'var(--accent)' : 'var(--status-danger)', letterSpacing: '-0.8px' }}>
              {ichimokuImo > 0 ? `+${ichimokuImo.toFixed(4)}` : ichimokuImo.toFixed(4)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
              Ehlers 2-pole IIR stationary bounded tanh
            </div>
          </div>

          <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'Geist Mono, monospace' }}>
            <span style={{ color: 'var(--text-muted)' }}>Cloud State:</span>
            <span style={{ color: ichimokuImo > 0.15 ? 'var(--status-success)' : ichimokuImo < -0.15 ? 'var(--status-danger)' : 'var(--accent)', fontWeight: 700 }}>
              {ichimokuImo > 0.15 ? 'BULL CLOUD' : ichimokuImo < -0.15 ? 'BEAR CLOUD' : 'NEUTRAL'}
            </span>
          </div>
        </div>

      </div>

      {/* ─── DESIRE: Hardware-Accelerated Infinite Marquee ─── */}
      <div className="marquee-container">
        <div className="marquee-track">
          {[...statisticalFamilies, ...statisticalFamilies].map((family, idx) => (
            <span key={idx} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', fontFamily: 'Geist Mono, monospace', display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)' }} />
              {family}
            </span>
          ))}
        </div>
      </div>

      {/* ─── DESIRE: 4-Slice Interactive Horizontal Accordion Panel ─── */}
      <div style={{ width: '100%', maxWidth: '1152px', margin: '0 auto' }}>
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'Geist, sans-serif' }}>
              Orchestrated 4-Layer Architecture Specifications
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'Geist Mono, monospace' }}>
              Hover or click any system slice to expand architectural mathematics & access sandbox
            </div>
          </div>
          <Database size={16} style={{ color: 'var(--text-muted)' }} />
        </div>

        <div className="accordion-slice-panel">
          {/* Slice 1: Valuation */}
          <div 
            className={`accordion-slice ${activeAccordion === 'valuation' ? 'active' : ''}`}
            onMouseEnter={() => setActiveAccordion('valuation')}
            onClick={() => onSelectStudio?.('valuation')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: activeAccordion === 'valuation' ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.8px' }}>
                  LAYER 01
                </span>
                <DollarSign size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Geist, sans-serif' }}>
                Valuation Pillar
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: isBubble ? 'var(--status-danger)' : isDiscount ? 'var(--accent)' : 'var(--status-success)', fontFamily: 'Geist Mono, JetBrains Mono, monospace', marginTop: '6px' }}>
                Score: {valScore > 0 ? `+${valScore.toFixed(4)}` : valScore.toFixed(4)}
              </div>
              {activeAccordion === 'valuation' && (
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px', lineHeight: '1.5' }}>
                  Macroeconomic valuation score piecewise linear interpolated into [-2.0, +2.0] across 17 Fundamental, Technical, and Sentiment metrics. Governs long-term structural bubble risk (&ge; +1.50) vs deep value accumulation (&le; -1.00).
                </p>
              )}
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: activeAccordion === 'valuation' ? 'var(--text-main)' : 'var(--text-dim)', fontFamily: 'Geist Mono, monospace' }}>
              <span>Valuation Studio</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Slice 2: LTTD */}
          <div 
            className={`accordion-slice ${activeAccordion === 'lttd' ? 'active' : ''}`}
            onMouseEnter={() => setActiveAccordion('lttd')}
            onClick={() => onSelectStudio?.('lttd')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: activeAccordion === 'lttd' ? 'var(--status-success)' : 'var(--text-muted)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.8px' }}>
                  LAYER 02
                </span>
                <TrendingUp size={16} style={{ color: 'var(--status-success)' }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Geist, sans-serif' }}>
                LTTD HMM Lab
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: lttdRegime === 'BULL' ? 'var(--status-success)' : lttdRegime === 'BEAR' ? 'var(--status-danger)' : 'var(--accent)', fontFamily: 'Geist Mono, JetBrains Mono, monospace', marginTop: '6px' }}>
                State: {lttdRegime} ({circuitBreakers.lttd_macro_override.exposure_multiplier * 100}%)
              </div>
              {activeAccordion === 'lttd' && (
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px', lineHeight: '1.5' }}>
                  Orthogonal trend classification via 3-State Gaussian Hidden Markov Model (BULL, BEAR, SIDEWAYS). When P(Sideways) &gt; 0.60, forces strict 0.0 exposure override to prevent chop degradation on mid-term strategies.
                </p>
              )}
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: activeAccordion === 'lttd' ? 'var(--text-main)' : 'var(--text-dim)', fontFamily: 'Geist Mono, monospace' }}>
              <span>LTTD Lab</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Slice 3: MTTD */}
          <div 
            className={`accordion-slice ${activeAccordion === 'mttd' ? 'active' : ''}`}
            onMouseEnter={() => setActiveAccordion('mttd')}
            onClick={() => onSelectStudio?.('mttd')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: activeAccordion === 'mttd' ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.8px' }}>
                  LAYER 03
                </span>
                <Activity size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Geist, sans-serif' }}>
                MTTD Consensus
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: mttdImo > 0.2 ? 'var(--status-success)' : mttdImo < -0.2 ? 'var(--status-danger)' : 'var(--text-main)', fontFamily: 'Geist Mono, JetBrains Mono, monospace', marginTop: '6px' }}>
                IMO: {mttdImo > 0 ? `+${mttdImo.toFixed(4)}` : mttdImo.toFixed(4)} ({er_gate_open ? 'PASS' : 'BLOCK'})
              </div>
              {activeAccordion === 'mttd' && (
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px', lineHeight: '1.5' }}>
                  Multi-principle consensus oscillator [-1.0, +1.0] across 10 Statistical Families. Governed strictly by three logic gates: Efficiency Ratio (ER &ge; 0.20), Shannon Entropy (H &le; 2.30), and Chikou Momentum Exit.
                </p>
              )}
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: activeAccordion === 'mttd' ? 'var(--text-main)' : 'var(--text-dim)', fontFamily: 'Geist Mono, monospace' }}>
              <span>MTTD Console</span>
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Slice 4: Ichimoku */}
          <div 
            className={`accordion-slice ${activeAccordion === 'ichimoku' ? 'active' : ''}`}
            onMouseEnter={() => setActiveAccordion('ichimoku')}
            onClick={() => onSelectStudio?.('ichimoku')}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: activeAccordion === 'ichimoku' ? '#3B82F6' : 'var(--text-muted)', fontFamily: 'Geist Mono, monospace', letterSpacing: '0.8px' }}>
                  LAYER 04
                </span>
                <Layers size={16} style={{ color: '#3B82F6' }} />
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'Geist, sans-serif' }}>
                Ichimoku Quant
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: ichimokuImo > 0 ? '#3B82F6' : 'var(--status-danger)', fontFamily: 'Geist Mono, JetBrains Mono, monospace', marginTop: '6px' }}>
                SSmoother: {ichimokuImo > 0 ? `+${ichimokuImo.toFixed(4)}` : ichimokuImo.toFixed(4)}
              </div>
              {activeAccordion === 'ichimoku' && (
                <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '8px', lineHeight: '1.5' }}>
                  Stationary bounded tanh oscillator transforming non-stationary cloud components (S_TK, S_Cloud, S_Future, S_Chikou) filtered through Ehlers 2-pole SuperSmoother IIR transfer function for zero-lag noise removal.
                </p>
              )}
            </div>

            <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: activeAccordion === 'ichimoku' ? 'var(--text-main)' : 'var(--text-dim)', fontFamily: 'Geist Mono, monospace' }}>
              <span>Ichimoku Terminal</span>
              <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
