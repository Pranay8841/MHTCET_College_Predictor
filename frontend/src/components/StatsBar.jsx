import React from 'react';

function StatsBar({ stats, total }) {
  if (!stats) return null;

  const items = [
    {
      label: 'Total Colleges',
      value: total,
      color: 'var(--color-accent)',
      icon: '🏫'
    },
    {
      label: 'High Chance',
      value: stats.high || 0,
      color: 'var(--color-chance-high)',
      icon: '🟢'
    },
    {
      label: 'Medium Chance',
      value: stats.medium || 0,
      color: 'var(--color-chance-medium)',
      icon: '🟡'
    },
    {
      label: 'Low Chance',
      value: stats.low || 0,
      color: 'var(--color-chance-low)',
      icon: '🔴'
    }
  ];

  return (
    <div className="stats-bar">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="stat-card"
          style={{ animationDelay: `${idx * 0.1}s`, animation: 'fadeInUp 0.5s ease both' }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
            {item.icon}
          </div>
          <div className="stat-value" style={{ color: item.color }}>
            {item.value}
          </div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export default StatsBar;
