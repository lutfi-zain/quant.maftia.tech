import React from 'react';
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';
import type { ActiveTab } from './Sidebar';

interface BottomTabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const TABS: { id: ActiveTab; label: string; icon: React.FC<{ size?: number }> }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'valuation', label: 'Valuation', icon: BarChart3 },
  { id: 'lttd', label: 'LTTD', icon: TrendingUp },
  { id: 'mttd', label: 'MTTD', icon: Activity },
  { id: 'ichimoku', label: 'Ichimoku', icon: Layers },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav className="mobile-bottom-tab-bar" aria-label="Main navigation">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            className={`mobile-tab-btn${isActive ? ' active' : ''}`}
            onClick={() => onTabChange(id)}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
};
