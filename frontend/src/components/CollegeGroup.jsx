import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getChanceDisplay } from '../utils/categoryOptions';
import { fetchCollegeCutoffs } from '../utils/api';

/**
 * CollegeGroup renders a single college with all its matching branches
 * in a table format, similar to the reference image layout.
 */
function CollegeGroup({ college, branches, index, isJosaa, isRankSearch, queryParams }) {
  const [expanded, setExpanded] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [loadingCutoffs, setLoadingCutoffs] = useState(false);
  const [cutoffData, setCutoffData] = useState([]);
  const [modalError, setModalError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const triggerToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const handleOpenCutoffModal = async () => {
    setShowModal(true);
    setLoadingCutoffs(true);
    setModalError('');
    try {
      const params = {
        roundId: queryParams?.roundId,
        examId: queryParams?.examId || 'mhtcet',
        category: queryParams?.category,
        gender: queryParams?.gender,
        seatType: queryParams?.seatType,
        percentile: queryParams?.percentile,
        rank: queryParams?.rank
      };
      const response = await fetchCollegeCutoffs(collegeCode, params);
      setCutoffData(response.cutoffs || []);
    } catch (err) {
      console.error('Failed to load branch cutoffs:', err);
      setModalError(err.response?.data?.error || err.message || 'Failed to load branch cutoffs');
    } finally {
      setLoadingCutoffs(false);
    }
  };

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

      {/* College Group Action Buttons */}
      <div className="college-group-actions">
        <button
          className="btn-action btn-placement"
          onClick={(e) => {
            e.stopPropagation();
            triggerToast("💼 Placement stats for this college are coming soon!");
          }}
        >
          💼 <span className="btn-text-desktop">See </span>Placement
        </button>
        <button
          className="btn-action btn-cutoff"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenCutoffModal();
          }}
        >
          📄 <span className="btn-text-desktop">See </span>Cutoff
        </button>
        <button
          className="btn-action btn-fees"
          onClick={(e) => {
            e.stopPropagation();
            triggerToast("🪙 Fees / Seat details for this college are coming soon!");
          }}
        >
          🪙 <span className="btn-text-desktop">See </span>Fees / Seat
        </button>
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

      {/* Modal Overlay */}
      {showModal && createPortal(
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{college}</h3>
                <div className="modal-subtitle">
                  <span>🏛️ {collegeType}</span>
                  <span style={{ marginLeft: 'var(--space-3)' }}>🔢 Code: {collegeCode}</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowModal(false)} aria-label="Close modal">✕</button>
            </div>
            
            <div className="modal-body">
              {loadingCutoffs ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12)' }}>
                  <div className="animate-spin" style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>⏳</div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Loading branch cutoffs...</div>
                </div>
              ) : modalError ? (
                <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
                  <div className="empty-state-icon">❌</div>
                  <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Failed to load cutoffs</h4>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{modalError}</p>
                  <button className="btn btn-secondary btn-sm" onClick={handleOpenCutoffModal}>🔄 Retry</button>
                </div>
              ) : cutoffData.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
                  <div className="empty-state-icon">🔍</div>
                  <h4 style={{ color: 'var(--color-text-primary)' }}>No Cutoff Records Found</h4>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    No branch cutoffs match the category/seat type profile in this round.
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
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
                        {cutoffData.map((cutoff, cIdx) => {
                          const chance = getChanceDisplay(cutoff.chanceLabel);
                          const diff = cutoff.percentileDiff;
                          const isRankDiff = isJosaa || isRankSearch;
                          const diffFormatted = isRankDiff
                            ? (diff >= 0 ? `+${diff}` : `${diff}`)
                            : (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));
                          
                          return (
                            <tr key={`${cutoff.branchCode}-${cIdx}`}>
                              <td className="branch-cell">
                                <span className="branch-name">{cutoff.branchName}</span>
                              </td>
                              {isJosaa && (
                                <td>
                                  <span className="meta-tag small">{cutoff.seatBlockType}</span>
                                </td>
                              )}
                              {isRankSearch ? (
                                isJosaa ? (
                                  <>
                                    <td className="number-cell">{cutoff.cutoffMeritNo || '—'}</td>
                                    <td className="number-cell">{cutoff.stage2MeritNo || '—'}</td>
                                    <td className="number-cell highlight">{queryParams?.rank || '—'}</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="number-cell">{cutoff.cutoffMeritNo || '—'}</td>
                                    <td className="number-cell highlight">{queryParams?.rank || '—'}</td>
                                    <td className="number-cell">{cutoff.cutoffPercentile?.toFixed(2) ?? '—'}</td>
                                  </>
                                )
                              ) : (
                                <>
                                  <td className="number-cell">{cutoff.cutoffPercentile?.toFixed(2) ?? '—'}</td>
                                  <td className="number-cell highlight">{queryParams?.percentile || '—'}</td>
                                </>
                              )}
                              <td className={`number-cell ${diff >= 0 ? 'positive' : 'negative'}`}>
                                {diffFormatted}
                              </td>
                              <td>
                                <span className={`badge badge-sm ${chance.className}`}>
                                  {chance.emoji} {cutoff.chanceLabel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile List View */}
                  <div className="mobile-cutoff-list">
                    {cutoffData.map((cutoff, cIdx) => {
                      const chance = getChanceDisplay(cutoff.chanceLabel);
                      const diff = cutoff.percentileDiff;
                      const isRankDiff = isJosaa || isRankSearch;
                      const diffFormatted = isRankDiff
                        ? (diff >= 0 ? `+${diff}` : `${diff}`)
                        : (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));

                      return (
                        <div key={`${cutoff.branchCode}-${cIdx}`} className="mobile-cutoff-card">
                          <div className="mobile-cutoff-card-header">
                            <span className="mobile-branch-name">{cutoff.branchName}</span>
                            <span className={`badge badge-sm ${chance.className}`} style={{ marginLeft: 'var(--space-2)' }}>
                              {chance.emoji} {cutoff.chanceLabel}
                            </span>
                          </div>

                          {isJosaa && (
                            <div style={{ marginBottom: 'var(--space-2)' }}>
                              <span className="meta-tag small">{cutoff.seatBlockType}</span>
                            </div>
                          )}

                          <div className="mobile-cutoff-grid">
                            <div className="mobile-cutoff-grid-item">
                              <span className="grid-label">
                                {isRankSearch ? (isJosaa ? 'Closing' : 'Cutoff') : 'Cutoff'}
                              </span>
                              <span className="grid-value">
                                {isRankSearch
                                  ? (isJosaa ? cutoff.stage2MeritNo || '—' : cutoff.cutoffMeritNo || '—')
                                  : (cutoff.cutoffPercentile?.toFixed(2) ?? '—')}
                              </span>
                            </div>

                            <div className="mobile-cutoff-grid-item">
                              <span className="grid-label">
                                {isRankSearch ? 'Your Rank' : 'Your %ile'}
                              </span>
                              <span className="grid-value highlight">
                                {isRankSearch ? queryParams?.rank || '—' : queryParams?.percentile || '—'}
                              </span>
                            </div>

                            <div className="mobile-cutoff-grid-item">
                              <span className="grid-label">Margin</span>
                              <span className={`grid-value ${diff >= 0 ? 'positive' : 'negative'}`}>
                                {diffFormatted}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-footer" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default CollegeGroup;
