import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchCollegeDetails } from '../utils/api';
import { getEnrichedCollegeData } from '../utils/collegeEnrichment';
import { extractCityFromCollegeName } from '../utils/regionMapping';

/**
 * ComparisonModal displays a side-by-side comparison table for up to 3 selected colleges.
 * Dynamically queries the backend scraper for real-time information with a skeleton loader.
 */
function ComparisonModal({ isOpen, onClose, selectedColleges, isRankSearch, isJosaa, queryParams }) {
  const [collegesDetails, setCollegesDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  useEffect(() => {
    if (!isOpen || selectedColleges.length === 0) return;

    const loadDetails = async () => {
      selectedColleges.forEach(async (c) => {
        // Skip if already loading or loaded
        if (collegesDetails[c.collegeCode] || loadingDetails[c.collegeCode]) return;

        setLoadingDetails(prev => ({ ...prev, [c.collegeCode]: true }));
        try {
          const res = await fetchCollegeDetails(c.collegeCode, {
            collegeName: c.collegeName,
            collegeType: c.collegeType
          });
          setCollegesDetails(prev => ({ ...prev, [c.collegeCode]: res }));
        } catch (err) {
          console.error(`Failed to load details for ${c.collegeCode}:`, err);
          // Graceful fallback to local heuristics
          const localData = getEnrichedCollegeData(c.collegeCode, c.collegeName, c.collegeType);
          setCollegesDetails(prev => ({ ...prev, [c.collegeCode]: localData }));
        } finally {
          setLoadingDetails(prev => ({ ...prev, [c.collegeCode]: false }));
        }
      });
    };

    loadDetails();
  }, [isOpen, selectedColleges]);

  // Compile all unique branches across all compared colleges
  const allComparedBranches = useMemo(() => {
    if (!isOpen) return [];
    const branchNamesSet = new Set();
    selectedColleges.forEach(c => {
      c.branches.forEach(b => {
        branchNamesSet.add(b.branchName);
      });
    });
    return Array.from(branchNamesSet).sort();
  }, [selectedColleges, isOpen]);

  // General details from main list (DTE attributes)
  const columnsData = useMemo(() => {
    if (!isOpen) return [];
    return selectedColleges.map(c => {
      const city = extractCityFromCollegeName(c.collegeName);
      return {
        ...c,
        city
      };
    });
  }, [selectedColleges, isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content comparison-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">⚖️ College Comparison Grid</h3>
            <div className="modal-subtitle">
              Comparing {selectedColleges.length} college{selectedColleges.length > 1 ? 's' : ''} side-by-side
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-body comparison-modal-body">
          <div className="comparison-table-scroll-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th className="comparison-sticky-col">Parameter</th>
                  {columnsData.map(c => (
                    <th key={c.collegeCode} className="comparison-header-col">
                      <div className="compare-header-college-card">
                        <div className="compare-header-code">Code: {c.collegeCode}</div>
                        <div className="compare-header-name">{c.collegeName}</div>
                        <div className="compare-header-badge-row">
                          <span className="meta-tag small font-semibold">🏛️ {c.collegeType}</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* ---------- SECTION: General Stats ---------- */}
                <tr className="table-section-row">
                  <td colSpan={selectedColleges.length + 1} className="comparison-section-header">
                    📍 General Details
                  </td>
                </tr>
                <tr>
                  <td className="comparison-key-col">City / Location</td>
                  {columnsData.map(c => (
                    <td key={c.collegeCode} className="comparison-val-col font-semibold">
                      📍 {c.city || 'State Level'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="comparison-key-col">Affiliating University</td>
                  {columnsData.map(c => (
                    <td key={c.collegeCode} className="comparison-val-col text-secondary">
                      {c.homeUniversity || 'State Level'}
                    </td>
                  ))}
                </tr>

                {/* ---------- SECTION: Enriched Stats ---------- */}
                <tr className="table-section-row">
                  <td colSpan={selectedColleges.length + 1} className="comparison-section-header">
                    📊 Rank, Fees & Placements (Enriched)
                  </td>
                </tr>
                <tr>
                  <td className="comparison-key-col">NIRF Engg Rank</td>
                  {columnsData.map(c => {
                    const isLd = loadingDetails[c.collegeCode];
                    const details = collegesDetails[c.collegeCode];
                    if (isLd) return <td key={c.collegeCode} className="comparison-val-col"><span className="skeleton-inline"></span></td>;
                    
                    const val = details?.nirfRank || 'N/A';
                    return (
                      <td key={c.collegeCode} className="comparison-val-col">
                        <span className={`compare-nirf-badge ${val === 'N/A' ? 'not-ranked' : 'ranked'}`}>
                          🏆 {val}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="comparison-key-col">State Rank (Est.)</td>
                  {columnsData.map(c => {
                    const isLd = loadingDetails[c.collegeCode];
                    const details = collegesDetails[c.collegeCode];
                    if (isLd) return <td key={c.collegeCode} className="comparison-val-col"><span className="skeleton-inline"></span></td>;
                    
                    return (
                      <td key={c.collegeCode} className="comparison-val-col font-bold highlight-rank">
                        {details?.stateRank || 'N/A'}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="comparison-key-col">Total Tuition Fees</td>
                  {columnsData.map(c => {
                    const isLd = loadingDetails[c.collegeCode];
                    const details = collegesDetails[c.collegeCode];
                    if (isLd) return <td key={c.collegeCode} className="comparison-val-col"><span className="skeleton-inline"></span></td>;
                    
                    return (
                      <td key={c.collegeCode} className="comparison-val-col font-semibold text-fees">
                        🪙 {details?.totalFees || 'N/A'}
                        {details?.isEstimated && <span className="estimated-pill">Est.</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="comparison-key-col">Average Placement</td>
                  {columnsData.map(c => {
                    const isLd = loadingDetails[c.collegeCode];
                    const details = collegesDetails[c.collegeCode];
                    if (isLd) return <td key={c.collegeCode} className="comparison-val-col"><span className="skeleton-inline"></span></td>;
                    
                    return (
                      <td key={c.collegeCode} className="comparison-val-col font-bold text-avg-pkg">
                        💼 {details?.averagePackage || 'N/A'}
                        {details?.isEstimated && <span className="estimated-pill">Est.</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="comparison-key-col">Highest Placement</td>
                  {columnsData.map(c => {
                    const isLd = loadingDetails[c.collegeCode];
                    const details = collegesDetails[c.collegeCode];
                    if (isLd) return <td key={c.collegeCode} className="comparison-val-col"><span className="skeleton-inline"></span></td>;
                    
                    return (
                      <td key={c.collegeCode} className="comparison-val-col font-semibold text-high-pkg">
                        🚀 {details?.highestPackage || 'N/A'}
                        {details?.isEstimated && <span className="estimated-pill">Est.</span>}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="comparison-key-col">Top Recruiters</td>
                  {columnsData.map(c => {
                    const isLd = loadingDetails[c.collegeCode];
                    const details = collegesDetails[c.collegeCode];
                    if (isLd) return <td key={c.collegeCode} className="comparison-val-col"><span className="skeleton-inline"></span></td>;
                    
                    return (
                      <td key={c.collegeCode} className="comparison-val-col">
                        <div className="compare-recruiters-tags">
                          {details?.topRecruiters?.slice(0, 3).map((r, ri) => (
                            <span key={ri} className="recruiter-tag small">{r}</span>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* ---------- SECTION: Branch Cutoffs ---------- */}
                <tr className="table-section-row">
                  <td colSpan={selectedColleges.length + 1} className="comparison-section-header">
                    🎓 Cutoff Percentiles / Closing Ranks (for Category: {queryParams.category || 'OPEN'})
                  </td>
                </tr>
                {allComparedBranches.map(bName => (
                  <tr key={bName}>
                    <td className="comparison-key-col comparison-branch-key font-semibold">{bName}</td>
                    {columnsData.map(c => {
                      const match = c.branches.find(b => b.branchName === bName);
                      if (!match) {
                        return (
                          <td key={c.collegeCode} className="comparison-val-col text-muted">
                            —
                          </td>
                        );
                      }

                      const value = isRankSearch
                        ? (isJosaa ? match.stage2MeritNo : match.cutoffMeritNo)
                        : match.cutoffPercentile?.toFixed(2);

                      const chanceClass = match.chanceLabel?.toLowerCase() || 'none';
                      const isRankDiff = isJosaa || isRankSearch;
                      const diff = match.percentileDiff;
                      const diffFormatted = isRankDiff
                        ? (diff >= 0 ? `+${diff}` : `${diff}`)
                        : (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));

                      return (
                        <td key={c.collegeCode} className="comparison-val-col">
                          <div className="compare-cutoff-cell">
                            <div className="compare-cutoff-main">
                              <span className={`chance-dot ${chanceClass}`} title={`Chance: ${match.chanceLabel}`} />
                              <span className="cutoff-val font-semibold">{value || '—'}</span>
                            </div>
                            <span className={`cutoff-margin ${diff >= 0 ? 'positive' : 'negative'}`}>
                              {diffFormatted}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {columnsData.some(c => collegesDetails[c.collegeCode]?.isEstimated) && (
            <div className="estimated-footer-note" style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              💡 <em>Est.</em> indicates details are estimated based on public profiles of institutions of similar status. Exact fees and placement records vary by branch and social category. Verify on the official college brochure before CAP submission.
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ComparisonModal;
