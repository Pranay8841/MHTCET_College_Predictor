import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { usePredictions } from '../hooks/usePredictions';
import CollegeCard from '../components/CollegeCard';
import StatsBar from '../components/StatsBar';
import FilterBar from '../components/FilterBar';
import { CATEGORY_OPTIONS, SEAT_TYPE_OPTIONS } from '../utils/categoryOptions';

const RESULTS_PER_PAGE = 20;

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
  const queryParams = useMemo(() => ({
    percentile: searchParams.get('percentile'),
    category: searchParams.get('category'),
    gender: searchParams.get('gender'),
    seatType: searchParams.get('seatType'),
    roundId: searchParams.get('roundId'),
    branch: searchParams.getAll('branch'),
    collegeType: searchParams.get('collegeType') || 'all'
  }), [searchParams]);

  // Fetch predictions on mount
  useEffect(() => {
    if (!queryParams.percentile || !queryParams.roundId) return;

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
        result.sort((a, b) => (a.cutoffPercentile || 0) - (b.cutoffPercentile || 0));
        break;
      case 'cutoff-desc':
        result.sort((a, b) => (b.cutoffPercentile || 0) - (a.cutoffPercentile || 0));
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
  }, [allPredictions, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredPredictions.length / RESULTS_PER_PAGE);
  const paginatedResults = filteredPredictions.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE
  );

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
      doc.text('MHTCET College Predictor — Results', 14, 15);
      doc.setFontSize(10);
      doc.text(
        `Percentile: ${queryParams.percentile} | Category: ${queryParams.category} | Gender: ${queryParams.gender === 'L' ? 'Female' : 'Male'} | Seat: ${queryParams.seatType}`,
        14, 22
      );
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

      // Table data
      const tableData = filteredPredictions.map(p => [
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

      doc.autoTable({
        startY: 34,
        head: [['Code', 'College', 'Branch', 'Type', 'Category', 'Cutoff', 'Your %ile', 'Margin', 'Chance']],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [255, 107, 43] },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 55 },
          2: { cellWidth: 45 },
          8: { cellWidth: 18 }
        },
        didParseCell: function (data) {
          if (data.column.index === 8 && data.section === 'body') {
            const chance = data.cell.raw;
            if (chance === 'High') data.cell.styles.textColor = [34, 197, 94];
            else if (chance === 'Medium') data.cell.styles.textColor = [245, 158, 11];
            else if (chance === 'Low') data.cell.styles.textColor = [239, 68, 68];
          }
        }
      });

      doc.save(`MHTCET_Predictions_${queryParams.percentile}pct.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  // No query params — redirect to home
  if (!queryParams.percentile || !queryParams.roundId) {
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
  const categoryLabel = CATEGORY_OPTIONS.find(c => c.value === queryParams.category)?.label || queryParams.category;
  const seatLabel = SEAT_TYPE_OPTIONS.find(s => s.value === queryParams.seatType)?.label || queryParams.seatType;

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
          {loading ? 'Searching...' : `Found ${filteredPredictions.length} Colleges`}
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
          Percentile: <strong>{queryParams.percentile}</strong> | 
          Category: <strong>{categoryLabel}</strong> | 
          Gender: <strong>{queryParams.gender === 'L' ? 'Female' : 'Male'}</strong> | 
          Seat: <strong>{seatLabel}</strong>
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
          <div className="results-grid">
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
              Showing {paginatedResults.length} of {filteredPredictions.length} results
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
          />

          {/* Results Grid */}
          {paginatedResults.length > 0 ? (
            <div className="results-grid">
              {paginatedResults.map((prediction, idx) => (
                <CollegeCard
                  key={`${prediction.collegeCode}-${prediction.branchCode}-${prediction.category}`}
                  prediction={prediction}
                  index={idx}
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
