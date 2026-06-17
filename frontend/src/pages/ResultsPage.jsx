import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePredictions } from '../hooks/usePredictions';
import CollegeGroup from '../components/CollegeGroup';
import StatsBar from '../components/StatsBar';
import FilterBar from '../components/FilterBar';
import { CATEGORY_OPTIONS, SEAT_TYPE_OPTIONS } from '../utils/categoryOptions';

const COLLEGES_PER_PAGE = 10;

function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { predictions, stats, total, loading, error, getPredictions } = usePredictions();

  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    chance: 'all',
    branchFilter: 'all',
    collegeTypeFilter: 'all',
    sort: 'chance-desc',
    search: ''
  });
  const [allPredictions, setAllPredictions] = useState([]);

  // Extract query params
  const queryParams = useMemo(() => {
    const examId = searchParams.get('examId') || 'mhtcet';
    const isJosaa = examId === 'josaa';
    return {
      examId,
      percentile: searchParams.get('percentile'),
      rank: searchParams.get('rank'),
      category: searchParams.get('category'),
      gender: searchParams.get('gender'),
      seatType: searchParams.get('seatType'),
      roundId: searchParams.get('roundId'),
      branch: searchParams.getAll('branch'),
      collegeType: searchParams.get('collegeType') || 'all',
      isJosaa
    };
  }, [searchParams]);

  // Fetch predictions on mount
  useEffect(() => {
    const score = queryParams.isJosaa ? queryParams.rank : queryParams.percentile;
    if (!score || !queryParams.roundId) return;

    const fetchAll = async () => {
      try {
        // Fetch a large page to get all results for client-side filtering
        const data = await getPredictions({
          ...queryParams,
          branch: queryParams.branch[0] || 'all',
          page: 1,
          limit: 5000
        });
        setAllPredictions(data.predictions || []);
      } catch (err) {
        console.error('Failed to fetch predictions:', err);
      }
    };

    fetchAll();
  }, [queryParams, getPredictions]);

  // Get unique branches from results
  const uniqueBranches = useMemo(() => {
    const branches = new Set(allPredictions.map(p => p.branchName));
    return [...branches].sort();
  }, [allPredictions]);

  // Apply client-side filters + sort
  const filteredPredictions = useMemo(() => {
    let result = [...allPredictions];

    // Filter by chance
    if (filters.chance && filters.chance !== 'all') {
      result = result.filter(p => p.chanceLabel === filters.chance);
    }

    // Filter by branch
    if (filters.branchFilter && filters.branchFilter !== 'all') {
      result = result.filter(p => p.branchName === filters.branchFilter);
    }

    // Filter by college type
    if (filters.collegeTypeFilter && filters.collegeTypeFilter !== 'all') {
      result = result.filter(p =>
        p.collegeType?.toLowerCase().includes(filters.collegeTypeFilter.toLowerCase())
      );
    }

    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(p =>
        p.collegeName.toLowerCase().includes(searchLower) ||
        p.collegeCode.includes(filters.search) ||
        p.branchName.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (filters.sort) {
      case 'cutoff-asc':
        if (queryParams.isJosaa) {
          result.sort((a, b) => (a.stage2MeritNo || 0) - (b.stage2MeritNo || 0));
        } else {
          result.sort((a, b) => (a.cutoffPercentile || 0) - (b.cutoffPercentile || 0));
        }
        break;
      case 'cutoff-desc':
        if (queryParams.isJosaa) {
          result.sort((a, b) => (b.stage2MeritNo || 0) - (a.stage2MeritNo || 0));
        } else {
          result.sort((a, b) => (b.cutoffPercentile || 0) - (a.cutoffPercentile || 0));
        }
        break;
      case 'name-asc':
        result.sort((a, b) => a.collegeName.localeCompare(b.collegeName));
        break;
      case 'diff-desc':
        result.sort((a, b) => b.percentileDiff - a.percentileDiff);
        break;
      default: // chance-desc
        {
          const chanceOrder = { High: 0, Medium: 1, Low: 2 };
          result.sort((a, b) => {
            if (chanceOrder[a.chanceLabel] !== chanceOrder[b.chanceLabel]) {
              return chanceOrder[a.chanceLabel] - chanceOrder[b.chanceLabel];
            }
            return b.percentileDiff - a.percentileDiff;
          });
        }
    }

    return result;
  }, [allPredictions, filters, queryParams.isJosaa]);

  // Group predictions by college name
  const groupedColleges = useMemo(() => {
    const groups = new Map();
    filteredPredictions.forEach(p => {
      const key = p.collegeName;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(p);
    });
    return Array.from(groups.entries()).map(([name, branches]) => ({
      collegeName: name,
      branches
    }));
  }, [filteredPredictions]);

  // Pagination (by college groups)
  const totalPages = Math.ceil(groupedColleges.length / COLLEGES_PER_PAGE);
  const paginatedGroups = groupedColleges.slice(
    (currentPage - 1) * COLLEGES_PER_PAGE,
    currentPage * COLLEGES_PER_PAGE
  );

  // Total individual branch results count
  const totalBranchResults = filteredPredictions.length;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  // PDF Download
  const handleDownloadPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Title
      doc.setFontSize(16);
      doc.text(queryParams.isJosaa ? 'JoSAA College Predictor — Results' : 'MHTCET College Predictor — Results', 14, 15);
      doc.setFontSize(10);
      
      const subInfo = queryParams.isJosaa
        ? `JEE Rank: ${queryParams.rank} | Category: ${queryParams.category} | Gender: ${queryParams.gender === 'L' ? 'Female-Only' : 'Gender-Neutral'} | Quota: ${queryParams.seatType}`
        : `Percentile: ${queryParams.percentile} | Category: ${queryParams.category} | Gender: ${queryParams.gender === 'L' ? 'Female' : 'Male'} | Seat: ${queryParams.seatType}`;
      
      doc.text(subInfo, 14, 22);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

      // Table data
      let tableData, headers;
      if (queryParams.isJosaa) {
        headers = [['Code', 'College', 'Branch', 'Type', 'Quota', 'Category', 'Opening Rank', 'Closing Rank', 'Your Rank', 'Margin', 'Chance']];
        tableData = filteredPredictions.map(p => [
          p.collegeCode,
          p.collegeName,
          p.branchName,
          p.collegeType || 'N/A',
          p.seatBlockType,
          p.category,
          p.cutoffMeritNo || 'N/A',
          p.stage2MeritNo || 'N/A',
          p.studentRank || 'N/A',
          p.percentileDiff >= 0 ? `+${p.percentileDiff}` : p.percentileDiff,
          p.chanceLabel
        ]);
      } else {
        headers = [['Code', 'College', 'Branch', 'Type', 'Category', 'Cutoff %ile', 'Your %ile', 'Margin', 'Chance']];
        tableData = filteredPredictions.map(p => [
          p.collegeCode,
          p.collegeName,
          p.branchName,
          p.collegeType || 'N/A',
          p.category,
          p.cutoffPercentile?.toFixed(2) || 'N/A',
          p.studentPercentile?.toFixed(2) || 'N/A',
          p.percentileDiff >= 0 ? `+${p.percentileDiff.toFixed(2)}` : p.percentileDiff.toFixed(2),
          p.chanceLabel
        ]);
      }

      const chanceColIndex = queryParams.isJosaa ? 10 : 8;

      doc.autoTable({
        startY: 34,
        head: headers,
        body: tableData,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [255, 107, 43] },
        columnStyles: queryParams.isJosaa ? {
          0: { cellWidth: 15 },
          1: { cellWidth: 50 },
          2: { cellWidth: 40 },
          10: { cellWidth: 15 }
        } : {
          0: { cellWidth: 15 },
          1: { cellWidth: 55 },
          2: { cellWidth: 45 },
          8: { cellWidth: 18 }
        },
        didParseCell: function (data) {
          if (data.column.index === chanceColIndex && data.section === 'body') {
            const chance = data.cell.raw;
            if (chance === 'High') data.cell.styles.textColor = [34, 197, 94];
            else if (chance === 'Medium') data.cell.styles.textColor = [245, 158, 11];
            else if (chance === 'Low') data.cell.styles.textColor = [239, 68, 68];
          }
        }
      });

      doc.save(`${queryParams.isJosaa ? 'JoSAA' : 'MHTCET'}_Predictions_${queryParams.isJosaa ? queryParams.rank : queryParams.percentile}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const score = queryParams.isJosaa ? queryParams.rank : queryParams.percentile;

  // No query params — redirect to home
  if (!score || !queryParams.roundId) {
    return (
      <div className="container" style={{ paddingTop: 'var(--space-16)' }}>
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h2 className="empty-state-title">No Search Parameters</h2>
          <p className="empty-state-text">
            Please fill in the prediction form on the home page first.
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            ← Go to Predictor
          </button>
        </div>
      </div>
    );
  }

  // Summary text
  const categoryLabel = queryParams.isJosaa
    ? queryParams.category
    : (CATEGORY_OPTIONS.find(c => c.value === queryParams.category)?.label || queryParams.category);
  const seatLabel = queryParams.isJosaa
    ? queryParams.seatType
    : (SEAT_TYPE_OPTIONS.find(s => s.value === queryParams.seatType)?.label || queryParams.seatType);

  return (
    <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)', animation: 'fadeInUp 0.4s ease' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/')}
          style={{ marginBottom: 'var(--space-4)' }}
        >
          ← Modify Search
        </button>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 800,
          marginBottom: 'var(--space-2)'
        }}>
          {loading ? 'Searching...' : `Found ${groupedColleges.length} Colleges`}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
          {queryParams.isJosaa ? (
            <>
              JEE Rank: <strong>{queryParams.rank}</strong> | 
              Quota: <strong>{seatLabel}</strong> | 
              Category: <strong>{categoryLabel}</strong> | 
              Gender/Pool: <strong>{queryParams.gender === 'L' ? 'Female-Only' : 'Gender-Neutral'}</strong>
            </>
          ) : (
            <>
              Percentile: <strong>{queryParams.percentile}</strong> | 
              Category: <strong>{categoryLabel}</strong> | 
              Gender: <strong>{queryParams.gender === 'L' ? 'Female' : 'Male'}</strong> | 
              Seat: <strong>{seatLabel}</strong>
            </>
          )}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div>
          <div className="stats-bar">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton skeleton-card" style={{ height: '100px' }} />
            ))}
          </div>
          <div className="results-list">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton skeleton-card" />
            ))}
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <h2 className="empty-state-title">Something went wrong</h2>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            🔄 Retry
          </button>
        </div>
      )}

      {/* Results */}
      {!loading && !error && (
        <>
          {/* Stats */}
          <StatsBar stats={stats} total={filteredPredictions.length} />

          {/* Actions Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-4)'
          }}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
              Showing {paginatedGroups.length} of {groupedColleges.length} colleges ({totalBranchResults} branches)
            </span>
            {filteredPredictions.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={handleDownloadPDF}>
                📥 Download PDF
              </button>
            )}
          </div>

          {/* Filters */}
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            branches={uniqueBranches}
            isJosaa={queryParams.isJosaa}
          />

          {/* Results — Grouped by College */}
          {paginatedGroups.length > 0 ? (
            <div className="results-list">
              {paginatedGroups.map((group, idx) => (
                <CollegeGroup
                  key={group.collegeName}
                  college={group.collegeName}
                  branches={group.branches}
                  index={(currentPage - 1) * COLLEGES_PER_PAGE + idx}
                  isJosaa={queryParams.isJosaa}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔎</div>
              <h2 className="empty-state-title">No Colleges Found</h2>
              <p className="empty-state-text">
                Try adjusting your filters, choosing a different category, or checking with a lower percentile.
              </p>
              <button className="btn btn-secondary" onClick={() => setFilters({
                chance: 'all',
                branchFilter: 'all',
                collegeTypeFilter: 'all',
                sort: 'chance-desc',
                search: ''
              })}>
                Clear Filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ← Prev
              </button>

              {generatePageNumbers(currentPage, totalPages).map((pageNum, idx) => (
                pageNum === '...' ? (
                  <span key={`dots-${idx}`} style={{ color: 'var(--color-text-muted)', padding: '0 4px' }}>…</span>
                ) : (
                  <button
                    key={pageNum}
                    className={currentPage === pageNum ? 'active' : ''}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                )
              ))}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Generate page numbers with ellipsis for large page counts.
 */
function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = [];
  pages.push(1);

  if (current > 3) pages.push('...');

  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }

  if (current < total - 2) pages.push('...');

  pages.push(total);

  return pages;
}

export default ResultsPage;
