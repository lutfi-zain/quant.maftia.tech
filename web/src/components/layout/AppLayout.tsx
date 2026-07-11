import React, { useState } from 'react';
import { Sidebar, ActiveTab } from './Sidebar';
import { BottomTabBar } from './BottomTabBar';
import { MobileHeader } from './MobileHeader';
import { useTerminal } from '../../context/TerminalContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { RefreshCw } from 'lucide-react';

interface AppLayoutProps {
  children: (activeTab: ActiveTab) => React.ReactNode;
  wsStatus: 'Connected' | 'Reconnecting' | 'Disconnected';
}

const PAGE_TITLES: Record<ActiveTab, string> = {
  dashboard: 'Master Executive Dashboard',
  valuation: 'Valuation Pillar Studio (17 Indicators)',
  lttd: 'LTTD Lab (3-State Gaussian HMM)',
  mttd: 'MTTD Console (10 Statistical Families)',
  ichimoku: 'Ichimoku Terminal (SuperSmoother IIR)',
};

export const AppLayout: React.FC<AppLayoutProps> = ({ children, wsStatus }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const { syncGap, isLoading, refreshData } = useTerminal();
  const isMobile = useIsMobile();

  const hasBehind = syncGap.gapDays > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-root)',
        width: '100%',
        overflowX: 'hidden',
      }}
    >
      {/* Desktop sidebar — hidden on mobile via CSS class */}
      {!isMobile && (
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} wsStatus={wsStatus} />
      )}

      {/* Mobile sticky header — rendered by MobileHeader, shown via CSS on mobile */}
      {isMobile && (
        <MobileHeader
          activeTab={activeTab}
          wsStatus={wsStatus}
          pageTitles={PAGE_TITLES}
        />
      )}

      {/* Main Content Area */}
      <main
        style={{
          marginLeft: isMobile ? '0' : '260px',
          flex: 1,
          width: isMobile ? '100%' : 'calc(100% - 260px)',
          minWidth: 0,
          padding: isMobile ? '12px 10px 68px 10px' : '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? '12px' : '24px',
        }}
      >
        {/* Desktop Top Header — hidden on mobile */}
        {!isMobile && (
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  letterSpacing: '-0.4px',
                  color: 'var(--text-main)',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {PAGE_TITLES[activeTab]}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '3px', fontFamily: 'JetBrains Mono' }}>
                Unified quantitative consensus & interlocking defense metrics · api.quant.maftia.tech:8765
              </p>
            </div>

            {/* Header Controls: Sync Gap Badge + Refresh Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Sync Status Badge */}
              <div className={`sync-badge ${hasBehind ? 'behind' : 'current'}`}>
                {hasBehind ? (
                  <>
                    <span style={{ fontSize: '10px' }}>⚠</span>
                    <span>{syncGap.gapDays} day{syncGap.gapDays !== 1 ? 's' : ''} behind</span>
                  </>
                ) : syncGap.clientDate ? (
                  <>
                    <span style={{ fontSize: '10px' }}>✓</span>
                    <span>Data current · {syncGap.clientDate}</span>
                  </>
                ) : null}
              </div>

              {/* Sync / Refetch Button */}
              <button
                className="sync-btn"
                onClick={refreshData}
                disabled={isLoading}
                title="Refetch all data from server"
              >
                <RefreshCw
                  size={12}
                  style={isLoading ? { animation: 'spin 0.8s linear infinite' } : undefined}
                />
                <span>{isLoading ? 'Syncing…' : 'Sync Data'}</span>
              </button>
            </div>
          </header>
        )}

        {/* Dynamic Studio/Dashboard Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {children(activeTab)}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      {isMobile && (
        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  );
};
