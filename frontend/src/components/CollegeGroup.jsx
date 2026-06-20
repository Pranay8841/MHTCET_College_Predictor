import React, { useState } from 'react';
import { getChanceDisplay } from '../utils/categoryOptions';

/**
 * CollegeGroup renders a single college with all its matching branches
 * in a table format, similar to the reference image layout.
 */
function CollegeGroup({ college, branches, index, isJosaa, isRankSearch }) {
  const [expanded, setExpanded] = useState(true);

  // Determine best chance among all branches for the header badge
  const chanceOrder = { High: 0, Medium: 1, Low: 2 };
  const bestChance = branches.reduce((best, b) => {
    const order = chanceOrder[b.chanceLabel] ?? 3;
    return order < (chanceOrder[best] ?? 3) ? b.chanceLabel : best;
  }, branches[0]?.chanceLabel || 'Low');
  const bestChanceDisplay = getChanceDisplay(bestChance);

  // College info from the first branch
  const collegeCode = branches[0]?.collegeCode || '';
  const collegeType = branches[0]?.collegeType || 'N/A';

  return (
    <div
      className="college-group"
      style={{ animationDelay: `${Math.min(index * 0.06, 0.5)}s` }}
    >
      {/* College Header */}
      <div
        className="college-group-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="college-group-rank">{index + 1}</div>
        <div className="college-group-info">
          <div className="college-group-name">{college}</div>
          <div className="college-group-meta">
            <span className="meta-tag">🏛️ {collegeType}</span>
            <span className="meta-tag">🔢 Code: {collegeCode}</span>
            <span className="meta-tag">📚 {branches.length} Branch{branches.length > 1 ? 'es' : ''}</span>
          </div>
        </div>
        <div className="college-group-header-right">
          <span className={`badge ${bestChanceDisplay.className}`}>
            {bestChanceDisplay.emoji} {bestChanceDisplay.text}
          </span>
          <span className={`college-group-chevron ${expanded ? 'expanded' : ''}`}>
            ▾
          </span>
        </div>
      </div>

      {/* Branch Table */}
      {expanded && (
        <div className="college-group-body">
          <div className="college-table-wrapper">
            <table className="college-table">
              <thead>
                <tr>
                  <th>Branch</th>
                  {isJosaa && <th>Quota</th>}
                  {isRankSearch ? (
                    isJosaa ? (
                      <>
                        <th>Opening Rank</th>
                        <th>Closing Rank</th>
                        <th>Your Rank</th>
                      </>
                    ) : (
                      <>
                        <th>Cutoff Rank</th>
                        <th>Your Rank</th>
                        <th>Cutoff %ile</th>
                      </>
                    )
                  ) : (
                    <>
                      <th>Cutoff %ile</th>
                      <th>Your %ile</th>
                    </>
                  )}
                  <th>Margin</th>
                  <th>Chance</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((prediction, bIdx) => {
                  const chance = getChanceDisplay(prediction.chanceLabel);
                  const diff = prediction.percentileDiff;
                  const isRankDiff = isJosaa || isRankSearch;
                  const diffFormatted = isRankDiff
                    ? (diff >= 0 ? `+${diff}` : `${diff}`)
                    : (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));

                  return (
                    <tr key={`${prediction.branchCode}-${prediction.category}-${bIdx}`}>
                      <td className="branch-cell">
                        <span className="branch-name">{prediction.branchName}</span>
                      </td>
                      {isJosaa && (
                        <td>
                          <span className="meta-tag small">{prediction.seatBlockType}</span>
                        </td>
                      )}
                      {isRankSearch ? (
                        isJosaa ? (
                          <>
                            <td className="number-cell">{prediction.cutoffMeritNo || '—'}</td>
                            <td className="number-cell">{prediction.stage2MeritNo || '—'}</td>
                            <td className="number-cell highlight">{prediction.studentRank || '—'}</td>
                          </>
                        ) : (
                          <>
                            <td className="number-cell">{prediction.cutoffMeritNo || '—'}</td>
                            <td className="number-cell highlight">{prediction.studentRank || '—'}</td>
                            <td className="number-cell">{prediction.cutoffPercentile?.toFixed(2) ?? '—'}</td>
                          </>
                        )
                      ) : (
                        <>
                          <td className="number-cell">{prediction.cutoffPercentile?.toFixed(2) ?? '—'}</td>
                          <td className="number-cell highlight">{prediction.studentPercentile?.toFixed(2) ?? '—'}</td>
                        </>
                      )}
                      <td className={`number-cell ${diff >= 0 ? 'positive' : 'negative'}`}>
                        {diffFormatted}
                      </td>
                      <td>
                        <span className={`badge badge-sm ${chance.className}`}>
                          {chance.emoji} {prediction.chanceLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollegeGroup;
