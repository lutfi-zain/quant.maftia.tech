import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { quantClient } from '../../api/client';
import type { ComponentSignal } from '../../api/types';
import { useTerminal } from '../../context/TerminalContext';
import { createChart, ColorType, CrosshairMode, type Time, LineStyle, CandlestickSeries, AreaSeries, PriceScaleMode } from 'lightweight-charts';
import { AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { Sparkline } from '../../components/Sparkline';
import { MetricDetailChart } from './MetricDetailChart';
import { exportChartPng } from '../../lib/exportPng';

type MaxP = null | 'btc' | 'val';

interface MI { name: string; category: string; description: string; dbName: string; }
const META: Record<string, MI> = {
  mvrv_z: { name: 'MVRV Z-Score', category: 'Fundamental', description: 'Market Value to Realized Value Z-score', dbName: 'mvrv_z' },
  pi_cycle_top: { name: 'Pi Cycle Top', category: 'Technical', description: '111d/350d SMA intersection', dbName: 'pi_cycle_top' },
  fear_greed_cmc: { name: 'Fear & Greed (CMC)', category: 'Sentiment', description: 'Market sentiment composite', dbName: 'fear_greed_cmc' },
  fear_greed_og: { name: 'Fear & Greed (OG)', category: 'Sentiment', description: 'Alternative sentiment data', dbName: 'fear_greed_og' },
  aviv_nupl: { name: 'NUPL (AVIV)', category: 'Sentiment', description: 'Realized profit/loss ratio', dbName: 'aviv_nupl' },
  aviv_ratio: { name: 'Aviv Ratio', category: 'Fundamental', description: 'Value-in/value-out ratio', dbName: 'aviv_ratio' },
  ahr999: { name: 'AHR999 Index', category: 'Fundamental', description: 'Accumulation index', dbName: 'ahr999' },
  cvdd_ratio: { name: 'CVDD Ratio', category: 'Fundamental', description: 'Cumulative value destroyed ratio', dbName: 'cvdd_ratio' },
  dvrsi: { name: 'DVRSI', category: 'Technical', description: 'Dynamic volatility-adjusted RSI', dbName: 'dvrsi' },
  lth_sth_sopr_ratio: { name: 'LTH/STH SOPR', category: 'Fundamental', description: 'Long vs short holder SOPR', dbName: 'lth_sth_sopr_ratio' },
  risk_metrics: { name: 'Risk Metrics', category: 'Sentiment', description: 'Risk assessment composite', dbName: 'risk_metrics' },
  sharpe_ratio_52w: { name: 'Sharpe (52W)', category: 'Technical', description: '52-week risk-adjusted return', dbName: 'sharpe_ratio_52w' },
  terminal_price_ratio: { name: 'Terminal Price', category: 'Fundamental', description: 'Price vs terminal model', dbName: 'terminal_price_ratio' },
  two_year_ma: { name: '2Y MA', category: 'Technical', description: 'Two-year MA multiplier', dbName: 'two_year_ma' },
  unrealized_sell_risk: { name: 'Sell Risk', category: 'Sentiment', description: 'Unrealized profit spend risk', dbName: 'unrealized_sell_risk' },
  vpli: { name: 'VPLI', category: 'Technical', description: 'Volume price lock-in', dbName: 'vpli' },
  williams_r: { name: 'Williams %R', category: 'Technical', description: 'Overbought/oversold momentum', dbName: 'williams_r' },
};

export const ValuationStudio: React.FC = () => {
  const { dailyData } = useTerminal();
  const [components, setComponents] = useState<ComponentSignal[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [isLogScale, setIsLogScale] = useState(true);
  const [maximized, setMaximized] = useState<MaxP>(null);
  const [sparklineData, setSparklineData] = useState<Record<string, any[]>>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const btcRef = useRef<HTMLDivElement>(null);
  const valRef = useRef<HTMLDivElement>(null);
  const chartsRef = useRef<{ b: any; v: any }>({ b: null, v: null });
  const dataRef = useRef(dailyData);

  useEffect(() => { dataRef.current = dailyData; }, [dailyData]);

  useEffect(() => {
    let cancelled = false;
    quantClient.getComponents('VALUATION').then((d) => {
      if (cancelled) return;
      setComponents(d);
      const m: Record<string, any[]> = {};
      for (const x of d) {
        if (!(x.component_name in META)) continue;
        if (!m[x.component_name]) m[x.component_name] = [];
        m[x.component_name].push({ date: x.date, value: x.normalized_score });
      }
      setSparklineData(m);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dataRef.current.length || !btcRef.current || !valRef.current) return;
    const dd = dataRef.current;
    const opts = {
      layout: { background: { type: ColorType.Solid, color: '#0B1220' }, textColor: '#94A3B8' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      rightPriceScale: { minimumWidth: 85, autoScale: true },
      timeScale: { borderColor: 'rgba(30,41,59,0.8)' },
      crosshair: { mode: CrosshairMode.Normal },
    };
    const w = wrapperRef.current?.clientWidth || 900;
    const btcC = createChart(btcRef.current, { ...opts, width: w, height: 300, timeScale: { ...opts.timeScale, visible: false } });
    btcC.priceScale('right').applyOptions({ mode: PriceScaleMode.Logarithmic });
    btcC.addSeries(CandlestickSeries, { upColor: '#22C55E', downColor: '#EF4444', borderVisible: false })
      .setData(dd.map((p: any) => ({ time: p.date as Time, open: p.open, high: p.high, low: p.low, close: p.close })));
    const vC = createChart(valRef.current, { ...opts, width: w, height: 240, timeScale: { ...opts.timeScale, visible: true } });
    const vs = vC.addSeries(AreaSeries, { topColor: 'rgba(96,165,250,0.35)', bottomColor: 'rgba(96,165,250,0.02)', lineColor: '#60A5FA', lineWidth: 2 });
    vs.createPriceLine({ price: 1.5, color: '#EF4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Bubble' });
    vs.createPriceLine({ price: -1.0, color: '#22C55E', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Discount' });
    vs.setData(dd.map((p: any) => ({ time: p.date as Time, value: p.valuation_composite })));
    chartsRef.current = { b: btcC, v: vC };
    btcC.timeScale().fitContent();
    const ro = new ResizeObserver(() => {
      if (wrapperRef.current) { btcC.applyOptions({ width: wrapperRef.current.clientWidth }); vC.applyOptions({ width: wrapperRef.current.clientWidth }); }
    });
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => { ro.disconnect(); btcC.remove(); vC.remove(); chartsRef.current = { b: null, v: null }; };
  }, []);

  useEffect(() => {
    const chart = chartsRef.current.b;
    if (!chart) return;
    chart.priceScale('right').applyOptions({ mode: isLogScale ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal });
  });

  useEffect(() => {
    const { b, v } = chartsRef.current;
    if (!b) return;
    const h = maximized === 'btc' ? { b: window.innerHeight || 900, v: 0 } : maximized === 'val' ? { b: Math.floor((window.innerHeight || 900) * 0.65), v: Math.floor((window.innerHeight || 900) * 0.35) } : { b: 300, v: 240 };
    const w = wrapperRef.current?.clientWidth || 900;
    b.resize(w, h.b);
    if (v) v.resize(w, h.v);
  });

  const toNum = (v: any): number => typeof v === 'object' && v !== null ? Number(v.score ?? v.oscillator ?? v.normalized_score ?? 0) : Number(v ?? 0);
  const sc = dailyData.length > 0 ? toNum(dailyData[dailyData.length - 1].valuation_composite) : 0;
  const isBubble = sc >= 1.5;
  const isDiscount = sc <= -1.0;

  return (
    <div className={maximized !== null ? 'chart-fullscreen-active' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#60A5FA', textTransform: 'uppercase' }}>PILLAR 1 TELEMETRY</span>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>17-Indicator Piecewise Linear Valuation Model</h2>
          <p style={{ fontSize: '13px', color: '#64748B' }}>{components.length} components loaded</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ fontFamily: 'JetBrains Mono', textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748B' }}>COMPOSITE SCORE</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: isBubble ? '#EF4444' : isDiscount ? '#22C55E' : '#e2e8f0' }}>
              {sc > 0 ? `+${sc.toFixed(4)}` : sc.toFixed(4)}
            </div>
          </div>
          <div className="glass-card" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isBubble ? <><AlertTriangle size={18} style={{ color: '#EF4444' }} /><span style={{ fontWeight: 700, color: '#EF4444', fontSize: '13px' }}>BUBBLE FILTER ACTIVE</span></>
              : isDiscount ? <><CheckCircle2 size={18} style={{ color: '#22C55E' }} /><span style={{ fontWeight: 700, color: '#22C55E', fontSize: '13px' }}>ACCUMULATION ZONE</span></>
              : <><CheckCircle2 size={18} style={{ color: '#22C55E' }} /><span style={{ fontWeight: 700, fontSize: '13px' }}>FAIR MARKET CYCLE ZONE</span></>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        {maximized !== null && <button className="icon-btn" onClick={() => setMaximized(null)}>Restore</button>}
        <button className="icon-btn" onClick={() => exportChartPng([btcRef.current, valRef.current])} title="Save chart as PNG">📸 SAVE PNG</button>
        <div className="toggle-group">
          <button className={`toggle-btn ${!isLogScale ? 'active' : ''}`} onClick={() => setIsLogScale(false)}>LIN</button>
          <button className={`toggle-btn ${isLogScale ? 'active' : ''}`} onClick={() => setIsLogScale(true)}>LOG</button>
        </div>
      </div>

      {selectedMetric ? (
        <MetricDetailChart metricName={selectedMetric} onClose={() => setSelectedMetric(null)} />
      ) : (
        <div className="chart-panel" ref={wrapperRef}>
          <div className="chart-subplot">
            <div ref={btcRef} style={{ width: '100%', height: maximized === 'btc' ? `${window.innerHeight || 900}px` : '300px' }} />
          </div>
          <div className="chart-subplot">
            <div ref={valRef} style={{ width: '100%', height: '240px' }} />
          </div>
        </div>
      )}

      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Layers size={18} style={{ color: '#60A5FA' }} /><span style={{ fontWeight: 600, fontSize: '15px' }}>Piecewise Linear Component Matrix</span></div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['All', 'Fundamental', 'Technical', 'Sentiment'].map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} style={{ padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>{cat}</button>
            ))}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-panel)', fontSize: '11px', textTransform: 'uppercase', fontFamily: 'JetBrains Mono', color: 'var(--text-dim)' }}>
              <th style={{ padding: '12px 8px' }}>Indicator</th>
              <th style={{ padding: '12px 8px' }}>Category</th>
              <th style={{ padding: '12px 8px' }}>Trend</th>
              <th style={{ padding: '12px 8px', textAlign: 'right' }}>Score</th>
              <th style={{ padding: '12px 8px', textAlign: 'center' }}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(new Map(components.map(c => [c.component_name, c])).values()).filter(c => selectedCategory === 'All' || (META[c.component_name]?.category === selectedCategory)).map((c) => {
              const dir = c.signal_direction;
              const spColor = dir === 1 ? '#EF4444' : dir === -1 ? '#22C55E' : '#64748B';
              return (
                <tr key={c.component_name} onClick={() => setSelectedMetric(c.component_name)} style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '13px' }}>
                  <td style={{ padding: '14px 8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {META[c.component_name]?.name || c.component_name}
                    <span style={{ fontSize: '9px', color: 'var(--text-dim)', marginLeft: '6px', opacity: 0.5, fontFamily: 'JetBrains Mono' }}>{c.component_name}</span>
                  </td>
                  <td style={{ padding: '14px 8px' }}>{META[c.component_name]?.category || 'N/A'}</td>
                  <td style={{ padding: '14px 8px', verticalAlign: 'middle' }}>
                    <Sparkline data={sparklineData[c.component_name] || []} color={spColor} />
                  </td>
                  <td style={{ padding: '14px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>{(c.normalized_score * 2).toFixed(3)}</td>
                  <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px',
                      backgroundColor: dir === 1 ? 'rgba(239,68,68,0.15)' : dir === -1 ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
                      color: dir === 1 ? '#EF4444' : dir === -1 ? '#60A5FA' : '#64748B' }}>
                      {dir === 1 ? 'OVER' : dir === -1 ? 'DISCOUNT' : 'NEUTRAL'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
