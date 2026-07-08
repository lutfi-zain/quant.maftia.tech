import React, { useState } from 'react';
import { Sidebar, ActiveTab } from './Sidebar';

interface AppLayoutProps {
  children: (activeTab: ActiveTab) => React.ReactNode;
  wsStatus: 'Connected' | 'Reconnecting' | 'Disconnected';
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, wsStatus }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
      {/* Fixed Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} wsStatus={wsStatus} />

      {/* Main Content Area */}
      <main style={{
        marginLeft: '260px',
        flex: 1,
        minWidth: 0,
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Top Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: 'var(--text-main)' }}>
              {activeTab === 'dashboard' && 'Master Executive Dashboard'}
              {activeTab === 'valuation' && 'Valuation Pillar Studio (17 Indicators)'}
              {activeTab === 'lttd' && 'LTTD Lab (3-State Gaussian HMM)'}
              {activeTab === 'mttd' && 'MTTD Console (10 Statistical Families)'}
              {activeTab === 'ichimoku' && 'Ichimoku Terminal (SuperSmoother IIR)'}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Real-time quantitative consensus & interlocking defense metrics • Port :8765
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}>
              <span style={{ color: 'var(--accent-cyan)' }}>LOCK:</span>
              <span>85px Y-AXIS SYNC</span>
            </div>
            <div className="glass-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontFamily: 'JetBrains Mono' }}>
              <span style={{ color: '#10b981' }}>STORAGE:</span>
              <span>SQLite WAL</span>
            </div>
          </div>
        </header>

        {/* Dynamic Studio/Dashboard Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {children(activeTab)}
        </div>
      </main>
    </div>
  );
};
