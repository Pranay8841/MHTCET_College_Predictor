import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { getChanceDisplay } from '../utils/categoryOptions';
import { fetchCollegeCutoffs, fetchCollegeDetails } from '../utils/api';
import { useShortlist } from '../context/ShortlistContext';
import { getEnrichedCollegeData } from '../utils/collegeEnrichment';

/**
 * Sparkline component to draw dynamic SVG line trends for cutoff changes.
 */
function Sparkline({ data, isRank }) {
  if (!data || data.length < 2) return <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>—</span>;

  // Filter out rounds with no cutoff data
  const validData = data.filter(d => d.value !== null && d.value !== undefined);
  if (validData.length < 2) return <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>—</span>;

  const plotValues = isRank ? validData.map(d => -d.value) : validData.map(d => d.value);

  const min = Math.min(...plotValues);
  const max = Math.max(...plotValues);
  const range = max - min === 0 ? 1 : max - min;

  const width = 60;
  const height = 18;
  const padding = 3;
  const svgPoints = plotValues.map((p, idx) => {
    const x = padding + (idx / (plotValues.length - 1)) * (width - 2 * padding);
    const y = padding + (1 - (p - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="sparkline-wrapper">
      <svg width={width} height={height} className="sparkline">
        <polyline
          fill="none"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1.5"
          strokeDasharray="2,2"
          points={`${padding},${height/2} ${width-padding},${height/2}`}
        />
        <polyline
          fill="none"
          stroke="var(--color-primary-light)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={svgPoints}
        />
        {plotValues.map((p, idx) => {
          const x = padding + (idx / (plotValues.length - 1)) * (width - 2 * padding);
          const y = padding + (1 - (p - min) / range) * (height - 2 * padding);
          
          // CAP Round specific color-coding:
          // CAP Round I: Blue (#3b82f6)
          // CAP Round II: Saffron/Orange (#ff6b2b)
          // CAP Round III: Purple (#a78bfa)
          // CAP Round IV: Green (#10b981)
          const colors = ['#3b82f6', '#ff6b2b', '#a78bfa', '#10b981'];
          const pointColor = colors[idx % colors.length];

          const item = validData[idx];
          const displayVal = isRank ? item.value : item.value.toFixed(2);

          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r="3.5"
              fill={pointColor}
              stroke="#0a0e1a"
              strokeWidth="1.5"
              style={{ transition: 'r 0.1s ease', cursor: 'pointer' }}
            >
              <title>{item.roundName}: {displayVal}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * CollegeGroup renders a single college with all its matching branches
 * in a table format, similar to the reference image layout.
 */
function CollegeGroup({ college, branches, index, isJosaa, isRankSearch, queryParams, isCompared, onToggleCompare }) {
  const [expanded, setExpanded] = useState(true);
  const [modalType, setModalType] = useState(null); // 'cutoff', 'comparison', or null
  const [loadingCutoffs, setLoadingCutoffs] = useState(false);
  const [cutoffData, setCutoffData] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [multiRoundData, setMultiRoundData] = useState([]);
  const [modalError, setModalError] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [enrichedDetails, setEnrichedDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const handleOpenEnrichedModal = async (type) => {
    setModalType(type);
    if (enrichedDetails) return; // already loaded!
    
    setLoadingDetails(true);
    setModalError('');
    try {
      const response = await fetchCollegeDetails(collegeCode, { 
        collegeName: college, 
        collegeType 
      });
      setEnrichedDetails(response);
    } catch (err) {
      console.error('Failed to load college details from scraper:', err);
      // Fallback to local synchronous heuristics
      setEnrichedDetails(getEnrichedCollegeData(collegeCode, college, collegeType));
    } finally {
      setLoadingDetails(false);
    }
  };

  const parsedPercentile = queryParams?.percentile ? parseFloat(queryParams.percentile) : null;
  const studentPercentileFormatted = (parsedPercentile !== null && !isNaN(parsedPercentile)) ? parsedPercentile.toFixed(2) : '—';

  const { addToShortlist, removeFromShortlist, isShortlisted } = useShortlist();

  const handleToggleShortlist = (e, prediction) => {
    e.stopPropagation();
    const fullPrediction = {
      ...prediction,
      collegeCode: prediction.collegeCode || collegeCode,
      collegeName: prediction.collegeName || college
    };
    if (isShortlisted(fullPrediction, queryParams)) {
      removeFromShortlist(fullPrediction, queryParams);
      triggerToast("⭐ Removed from shortlist");
    } else {
      const added = addToShortlist(fullPrediction, queryParams);
      if (added) {
        triggerToast("⭐ Added to shortlist");
      }
    }
  };

  const triggerToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const handleOpenModal = async (type) => {
    setModalType(type);
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
      setRounds(response.rounds || []);
      setMultiRoundData(response.multiRoundData || []);
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
  const homeUniversity = branches[0]?.homeUniversity || '';

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
        <div className="college-group-compare" onClick={(e) => e.stopPropagation()}>
          <label className="compare-checkbox-label" title="Select for comparison">
            <input
              type="checkbox"
              checked={isCompared || false}
              onChange={() => onToggleCompare({
                collegeCode,
                collegeName: college,
                collegeType,
                homeUniversity,
                branches
              })}
            />
            <span className="compare-checkbox-custom"></span>
            <span className="compare-text">Compare</span>
          </label>
        </div>
        <div className="college-group-info">
          <div className="college-group-name">{college}</div>
          <div className="college-group-meta">
            <span className="meta-tag">🏛️ {collegeType}</span>
            {homeUniversity && <span className="meta-tag">📍 {homeUniversity}</span>}
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
            handleOpenEnrichedModal('placement');
          }}
        >
          💼 <span className="btn-text-desktop">See </span>Placement
        </button>
        <button
          className="btn-action btn-cutoff"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenModal('cutoff');
          }}
        >
          📄 <span className="btn-text-desktop">See </span>Cutoff
        </button>
        <button
          className="btn-action btn-comparison"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenModal('comparison');
          }}
        >
          📈 <span className="btn-text-desktop">See </span>Comparison
        </button>
        <button
          className="btn-action btn-fees"
          onClick={(e) => {
            e.stopPropagation();
            handleOpenEnrichedModal('fees');
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
                  <th style={{ textAlign: 'center', width: '85px' }}>Shortlist</th>
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

                  const isItemShortlisted = isShortlisted({ ...prediction, collegeCode, collegeName: college }, queryParams);

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
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className={`btn-shortlist-toggle ${isItemShortlisted ? 'shortlisted' : ''}`}
                          onClick={(e) => handleToggleShortlist(e, prediction)}
                          title={isItemShortlisted ? "Remove from shortlist" : "Add to shortlist"}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '1.25rem',
                            padding: 'var(--space-1) var(--space-2)',
                            color: isItemShortlisted ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            transition: 'transform var(--transition-fast)'
                          }}
                        >
                          {isItemShortlisted ? '★' : '☆'}
                        </button>
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
      {modalType && createPortal(
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title">
                  {college} {
                    modalType === 'comparison' ? '— Round-wise Comparison' : 
                    modalType === 'placement' ? '— Placement Stats' :
                    modalType === 'fees' ? '— Fees & Details' :
                    '— Cutoffs'
                  }
                </h3>
                <div className="modal-subtitle">
                  <span>🏛️ {collegeType}</span>
                  <span style={{ marginLeft: 'var(--space-3)' }}>🔢 Code: {collegeCode}</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setModalType(null)} aria-label="Close modal">✕</button>
            </div>

            <div className="modal-body">
              {modalType === 'placement' || modalType === 'fees' ? (
                loadingDetails ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12)' }}>
                    <div className="animate-spin" style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>⏳</div>
                    <div style={{ color: 'var(--color-text-secondary)' }}>Searching web for latest details...</div>
                  </div>
                ) : enrichedDetails ? (
                  (() => {
                    const enriched = enrichedDetails;
                    if (modalType === 'placement') {
                      return (
                        <div className="enriched-details-modal">
                          <div className="enriched-stat-card-grid">
                            <div className="enriched-stat-card">
                              <span className="stat-label">Average Package</span>
                              <span className="stat-value highlight-avg">{enriched.averagePackage || 'N/A'}</span>
                            </div>
                            <div className="enriched-stat-card">
                              <span className="stat-label">Highest Package</span>
                              <span className="stat-value highlight-highest">{enriched.highestPackage || 'N/A'}</span>
                            </div>
                          </div>
                          
                          <div className="enriched-recruiters-section">
                            <h4 className="section-title">Top Recruiters</h4>
                            <div className="recruiters-tags">
                              {enriched.topRecruiters?.map((r, ri) => (
                                <span key={ri} className="recruiter-tag">{r}</span>
                              ))}
                            </div>
                          </div>

                          {enriched.isEstimated && (
                            <div className="estimated-notice">
                              💡 Placements stats are estimated based on college type, affiliation, and historical placement records for this tier of institutions.
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <div className="enriched-details-modal">
                          <div className="enriched-stat-card-grid">
                            <div className="enriched-stat-card">
                              <span className="stat-label">Total Tuition Fees (Approx.)</span>
                              <span className="stat-value highlight-fees">{enriched.totalFees || 'N/A'}</span>
                            </div>
                            <div className="enriched-stat-card">
                              <span className="stat-label">College Type</span>
                              <span className="stat-value">{collegeType}</span>
                            </div>
                          </div>

                          <div className="enriched-details-list">
                            <div className="enriched-detail-row">
                              <span className="detail-label">📍 Affiliating University</span>
                              <span className="detail-value">{homeUniversity || 'State Level'}</span>
                            </div>
                            <div className="enriched-detail-row">
                              <span className="detail-label">🔢 DTE College Code</span>
                              <span className="detail-value">{collegeCode}</span>
                            </div>
                            <div className="enriched-detail-row">
                              <span className="detail-label">🛡️ Autonomy Status</span>
                              <span className="detail-value">
                                {collegeType.toLowerCase().includes('autonomous') ? 'Autonomous Institute' : 'Affiliated Institute'}
                              </span>
                            </div>
                          </div>

                          {enriched.isEstimated && (
                            <div className="estimated-notice">
                              💡 Fees shown are general estimates for OPEN category students. Under government schemes (EBC, TFWS, SC/ST, OBC), fees are significantly lower. Please refer to official CET Cell / college brochures for fee details.
                            </div>
                          )}
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">❌</div>
                    <h4 style={{ color: 'var(--color-text-primary)' }}>No details found</h4>
                  </div>
                )
              ) : loadingCutoffs ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-12)' }}>
                  <div className="animate-spin" style={{ fontSize: '2.5rem', marginBottom: 'var(--space-3)' }}>⏳</div>
                  <div style={{ color: 'var(--color-text-secondary)' }}>Loading branch cutoffs...</div>
                </div>
              ) : modalError ? (
                <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
                  <div className="empty-state-icon">❌</div>
                  <h4 style={{ color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>Failed to load cutoffs</h4>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>{modalError}</p>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(modalType)}>🔄 Retry</button>
                </div>
              ) : (modalType === 'cutoff' ? cutoffData.length === 0 : multiRoundData.length === 0) ? (
                <div className="empty-state" style={{ padding: 'var(--space-8) 0' }}>
                  <div className="empty-state-icon">🔍</div>
                  <h4 style={{ color: 'var(--color-text-primary)' }}>No Cutoff Records Found</h4>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                    No branch cutoffs match the category/seat type profile.
                  </p>
                </div>
              ) : (
                modalType === 'cutoff' ? (
                  <>
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
                            <th style={{ textAlign: 'center', width: '85px' }}>Shortlist</th>
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
                            
                            const isCutoffShortlisted = isShortlisted({ ...cutoff, collegeCode, collegeName: college }, queryParams);

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
                                    <td className="number-cell highlight">{studentPercentileFormatted}</td>
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
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    className={`btn-shortlist-toggle ${isCutoffShortlisted ? 'shortlisted' : ''}`}
                                    onClick={(e) => handleToggleShortlist(e, cutoff)}
                                    title={isCutoffShortlisted ? "Remove from shortlist" : "Add to shortlist"}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontSize: '1.25rem',
                                      padding: 'var(--space-1) var(--space-2)',
                                      color: isCutoffShortlisted ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                      transition: 'transform var(--transition-fast)'
                                    }}
                                  >
                                    {isCutoffShortlisted ? '★' : '☆'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mobile-cutoff-list">
                      {cutoffData.map((cutoff, cIdx) => {
                        const chance = getChanceDisplay(cutoff.chanceLabel);
                        const diff = cutoff.percentileDiff;
                        const isRankDiff = isJosaa || isRankSearch;
                        const diffFormatted = isRankDiff
                          ? (diff >= 0 ? `+${diff}` : `${diff}`)
                          : (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));
                        
                        const isCutoffShortlisted = isShortlisted({ ...cutoff, collegeCode, collegeName: college }, queryParams);

                        return (
                          <div key={`${cutoff.branchCode}-${cIdx}`} className="mobile-cutoff-card">
                            <div className="mobile-cutoff-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="mobile-branch-name">{cutoff.branchName}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <span className={`badge badge-sm ${chance.className}`}>
                                  {chance.emoji} {cutoff.chanceLabel}
                                </span>
                                <button
                                  className={`btn-shortlist-toggle ${isCutoffShortlisted ? 'shortlisted' : ''}`}
                                  onClick={(e) => handleToggleShortlist(e, cutoff)}
                                  title={isCutoffShortlisted ? "Remove from shortlist" : "Add to shortlist"}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '1.25rem',
                                    padding: '0 var(--space-1)',
                                    color: isCutoffShortlisted ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                    transition: 'transform var(--transition-fast)'
                                  }}
                                >
                                  {isCutoffShortlisted ? '★' : '☆'}
                                </button>
                              </div>
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
                                  {isRankSearch ? queryParams?.rank || '—' : studentPercentileFormatted}
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
                ) : (
                  <div className="college-table-wrapper comparison-table-wrapper">
                    <table className="college-table">
                      <thead>
                        <tr>
                          <th>Branch</th>
                          {isJosaa && <th>Quota</th>}
                          {rounds.map(r => (
                            <th key={r.id} style={{ textAlign: 'center' }}>
                              {r.roundName}
                            </th>
                          ))}
                          <th style={{ textAlign: 'center' }}>Your Score</th>
                          <th style={{ textAlign: 'center' }}>Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {multiRoundData.map((branchCutoff, cIdx) => {
                          const sparklineData = rounds.map(r => {
                            const rd = branchCutoff.roundCutoffs[r.id];
                            const val = rd 
                              ? (isRankSearch ? (isJosaa ? rd.stage2MeritNo : rd.cutoffMeritNo) : rd.cutoffPercentile)
                              : null;
                            return {
                              value: val,
                              roundName: r.roundName
                            };
                          });

                          return (
                            <tr key={`${branchCutoff.branchCode}-${cIdx}`}>
                              <td className="branch-cell">
                                <span className="branch-name">{branchCutoff.branchName}</span>
                              </td>
                              {isJosaa && (
                                <td>
                                  <span className="meta-tag small">{branchCutoff.seatBlockType}</span>
                                </td>
                              )}
                              {rounds.map((r, rIdx) => {
                                const rd = branchCutoff.roundCutoffs[r.id];
                                if (!rd) {
                                  return (
                                    <td key={r.id}>
                                      <div className="cell-round-value">
                                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                      </div>
                                    </td>
                                  );
                                }

                                const chance = getChanceDisplay(rd.chanceLabel);
                                const value = isRankSearch
                                  ? (isJosaa ? rd.stage2MeritNo : rd.cutoffMeritNo)
                                  : rd.cutoffPercentile?.toFixed(2);

                                let dropText = null;
                                let dropClass = 'neutral';
                                if (rIdx > 0) {
                                  const prevRound = rounds[rIdx - 1];
                                  const prevRd = branchCutoff.roundCutoffs[prevRound.id];
                                  if (prevRd) {
                                    if (isRankSearch) {
                                      const currVal = isJosaa ? rd.stage2MeritNo : rd.cutoffMeritNo;
                                      const prevVal = isJosaa ? prevRd.stage2MeritNo : prevRd.cutoffMeritNo;
                                      if (currVal && prevVal) {
                                        const diff = currVal - prevVal;
                                        if (diff > 0) {
                                          dropText = `↓ ${diff}`;
                                          dropClass = 'positive';
                                        } else if (diff < 0) {
                                          dropText = `↑ ${Math.abs(diff)}`;
                                          dropClass = 'negative';
                                        }
                                      }
                                    } else {
                                      const currVal = rd.cutoffPercentile;
                                      const prevVal = prevRd.cutoffPercentile;
                                      if (currVal !== null && prevVal !== null) {
                                        const diff = currVal - prevVal;
                                        if (diff < 0) {
                                          dropText = `↓ ${Math.abs(diff).toFixed(2)}`;
                                          dropClass = 'positive';
                                        } else if (diff > 0) {
                                          dropText = `↑ ${diff.toFixed(2)}`;
                                          dropClass = 'negative';
                                        }
                                      }
                                    }
                                  }
                                }

                                return (
                                  <td key={r.id}>
                                    <div className="cell-round-value">
                                      <div className="cell-round-main">
                                        <span className={`chance-dot ${rd.chanceLabel.toLowerCase()}`} title={`Chance: ${rd.chanceLabel}`} />
                                        <span>{value}</span>
                                      </div>
                                      {dropText && (
                                        <span className={`cell-round-drop ${dropClass}`}>
                                          {dropText}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{ textAlign: 'center' }}>
                                <span className="number-cell highlight">
                                  {isRankSearch ? queryParams?.rank || '—' : studentPercentileFormatted}
                                </span>
                              </td>
                              <td>
                                <Sparkline data={sparklineData} isRank={isRankSearch} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            <div className="modal-footer" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setModalType(null)}>Close</button>
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
