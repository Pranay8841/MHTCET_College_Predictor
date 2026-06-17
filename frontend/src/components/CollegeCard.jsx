import React from 'react';
import { getChanceDisplay } from '../utils/categoryOptions';

function CollegeCard({ prediction, index }) {
  const isJosaa = prediction.studentRank !== null && prediction.studentRank !== undefined;
  const chance = getChanceDisplay(prediction.chanceLabel);
  const diff = prediction.percentileDiff;
  const diffFormatted = isJosaa
    ? (diff >= 0 ? `+${diff}` : `${diff}`)
    : (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));

  return (
    <div
      className="college-card"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
    >
      {/* Header: College Name + Chance Badge */}
      <div className="college-card-header">
        <div style={{ flex: 1 }}>
          <div className="college-name">{prediction.collegeName}</div>
          <div className="college-code">Code: {prediction.collegeCode}</div>
        </div>
        <span className={`badge ${chance.className}`}>
          {chance.emoji} {prediction.chanceLabel}
        </span>
      </div>

      {/* Branch */}
      <div className="college-branch">
        📚 {prediction.branchName}
      </div>

      {/* Meta Tags */}
      <div className="college-meta">
        <span className="meta-tag">🏛️ {prediction.collegeType || 'N/A'}</span>
        <span className="meta-tag">📍 {prediction.category}</span>
        <span className="meta-tag">
          {isJosaa
            ? `🌐 Quota: ${prediction.seatBlockType}`
            : prediction.seatBlockType.includes('State')
              ? '🌐 State Level'
              : prediction.seatBlockType.includes('Other')
                ? '🔄 Other University'
                : '🏠 Home University'}
        </span>
      </div>

      {/* Cutoff Data */}
      <div className="college-cutoff-row">
        <div className="cutoff-item">
          <div className="cutoff-label">{isJosaa ? 'Closing Rank' : 'Cutoff'}</div>
          <div className="cutoff-value" style={{ color: 'var(--color-text-primary)' }}>
            {isJosaa ? prediction.stage2MeritNo : (prediction.cutoffPercentile?.toFixed(2) ?? 'N/A')}
          </div>
        </div>
        <div className="cutoff-item">
          <div className="cutoff-label">{isJosaa ? 'Your Rank' : 'Your %ile'}</div>
          <div className="cutoff-value" style={{ color: 'var(--color-accent-light)' }}>
            {isJosaa ? prediction.studentRank : prediction.studentPercentile?.toFixed(2)}
          </div>
        </div>
        <div className="cutoff-item">
          <div className="cutoff-label">Margin</div>
          <div className={`cutoff-value ${diff >= 0 ? 'positive' : 'negative'}`}>
            {diffFormatted}
          </div>
        </div>
      </div>

      {/* Footer / Footer-info */}
      {isJosaa ? (
        prediction.cutoffMeritNo && (
          <div style={{
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>Opening Rank: {prediction.cutoffMeritNo}</span>
          </div>
        )
      ) : (
        prediction.stage2Percentile && (
          <div style={{
            marginTop: 'var(--space-3)',
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-text-muted)',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span>Stage II Cutoff: {prediction.stage2Percentile?.toFixed(2)}</span>
            <span>Merit: #{prediction.cutoffMeritNo || 'N/A'}</span>
          </div>
        )
      )}
    </div>
  );
}

export default CollegeCard;
