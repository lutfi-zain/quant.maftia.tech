import type React from 'react';
import { useState } from 'react';
import { RefreshCw, Radio, Menu, X } from 'lucide-react';
import type { ActiveTab } from './Sidebar';
import { useTerminal } from '../../context/TerminalContext';

interface MobileHeaderProps {
  activeTab: ActiveTab;
  wsStatus: 'Connected' | 'Reconnecting' | 'Disconnected';
  pageTitles: Record<ActiveTab, string>;
}

const SHORT_TITLES: Record<ActiveTab, string> = {
  dashboard:  'Executive Dashboard',
  valuation:  'Valuation Studio',
  lttd:       'LTTD Lab',
  mttd:       'MTTD Console',
  ichimoku:   'Ichimoku Terminal',
};

export const MobileHeader: React.FC<MobileHeaderProps> = ({ activeTab, wsStatus }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { syncGap, isLoading, refreshData, dailyData } = useTerminal();
  const hasBehind = syncGap.gapDays > 0;

  const earliestDate = dailyData.length > 0 ? dailyData[0].date : null;
  const latestDate   = dailyData.length > 0 ? dailyData[dailyData.length - 1].date : null;
  const totalDays    = dailyData.length;

  const wsColor =
    wsStatus === 'Connected'    ? 'var(--signal-bull)'    :
    wsStatus === 'Reconnecting' ? 'var(--signal-neutral)' :
                                  'var(--signal-bear)';

  return (
    <>
      {/* Sticky Header Bar */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <span className="mobile-header-title">{SHORT_TITLES[activeTab]}</span>
        {/* Sync controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div
            className={`sync-badge ${hasBehind ? 'behind' : 'current'}`}
            style={{ fontSize: '10px', padding: '3px 8px' }}
          >
            {hasBehind ? (
              <>
                <span style={{ fontSize: '9px' }}>⚠</span>
                <span>{syncGap.gapDays}d</span>
              </>
            ) : syncGap.clientDate ? (
              <>
                <span style={{ fontSize: '9px' }}>✓</span>
                <span>Live</span>
              </>
            ) : null}
          </div>
          <button className="sync-btn" onClick={refreshData} disabled={isLoading} title="Sync data">
            <RefreshCw size={12} style={isLoading ? { animation: 'spin 0.8s linear infinite' } : undefined} />
          </button>
        </div>
      </header>

      {/* Hamburger Drawer */}
      {drawerOpen && (
        <>
          <div className="mobile-drawer-backdrop" onClick={() => setDrawerOpen(false)} />
          <aside className="mobile-drawer">
            {/* Brand */}
            <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #00f0ff, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontFamily: 'JetBrains Mono', fontSize: '14px', boxShadow: '0 0 16px rgba(0, 240, 255, 0.25)' }}>
                  MQ
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', fontFamily: 'Geist, sans-serif' }}>
                    MAFTIA <span style={{ color: 'var(--accent)' }}>QUANT</span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                    v2.0 UNIFIED TERMINAL
                  </div>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Data Range */}
            {earliestDate && latestDate && (
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                  Data Range
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <div>{earliestDate} →</div>
                  <div>{latestDate}</div>
                  <div style={{ marginTop: '4px', color: syncGap.gapDays > 0 ? 'var(--status-warning)' : 'var(--signal-bull)', fontWeight: 600 }}>
                    {totalDays.toLocaleString()} trading days
                    {syncGap.gapDays > 0 && ` · ⚠ ${syncGap.gapDays}d gap`}
                  </div>
                </div>
              </div>
            )}

            {/* Gateway Status */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                  <Radio size={13} style={{ color: wsColor }} />
                  <span>API Gateway</span>
                </div>
                <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.04)', color: wsColor }}>
                  {wsStatus}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
                <span>PORT :8910</span>
                <span>CausalFilter t−1</span>
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
};
