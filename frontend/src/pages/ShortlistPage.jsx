import React, { useState, useEffect } from 'react';
import { useShortlist } from '../context/ShortlistContext';
import { useNavigate } from 'react-router-dom';
import { getChanceDisplay } from '../utils/categoryOptions';

function ShortlistItemInput({ item, updateNotes }) {
  const [localNotes, setLocalNotes] = useState(item.notes || '');

  useEffect(() => {
    setLocalNotes(item.notes || '');
  }, [item.notes]);

  const handleChange = (e) => {
    setLocalNotes(e.target.value);
    updateNotes(item.key, e.target.value);
  };

  return (
    <div className="notes-container">
      <label className="notes-input-label">✍️ My Notes / Remarks</label>
      <textarea
        className="notes-textarea"
        value={localNotes}
        onChange={handleChange}
        placeholder="Add remarks (e.g., 'Top placement', '20 mins away', 'EWS fees applicable', 'Backup option')"
      />
    </div>
  );
}

function ShortlistPage() {
  const {
    shortlist,
    removeFromShortlist,
    updateNotes,
    reorderShortlist,
    clearShortlist
  } = useShortlist();

  const navigate = useNavigate();
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggingIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) return;

    const newShortlist = [...shortlist];
    const [draggedItem] = newShortlist.splice(draggingIndex, 1);
    newShortlist.splice(targetIndex, 0, draggedItem);
    
    reorderShortlist(newShortlist);
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  // Generate Option Form PDF
  const handleDownloadPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

      const doc = new jsPDF('portrait', 'mm', 'a4');

      // Title & Branding
      doc.setFontSize(18);
      doc.setTextColor(255, 107, 43); // Navodisha Saffron color
      doc.text('NAVODISHA MHTCET PREDICTOR', 14, 15);
      
      doc.setFontSize(12);
      doc.setTextColor(31, 41, 55); // Dark text
      doc.text('Finalized Preference List (Option Form)', 14, 22);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139); // Slate text
      doc.text(`Generated: ${new Date().toLocaleString()} | Total Choices: ${shortlist.length}`, 14, 28);
      doc.text('Use these preference numbers directly to fill your official CAP option form on the CET Cell portal.', 14, 32);

      // Table Setup
      const headers = [['Pref #', 'Code', 'College Name & Type', 'Branch', 'Seat Matrix Profile', 'Chance', 'Student Notes / Remarks']];
      
      const tableData = shortlist.map((item, idx) => {
        const typeLabel = item.collegeType ? `(${item.collegeType})` : '';
        const seatLabel = `${item.category} - ${item.seatType}`;
        const cutoffDetail = item.studentRank !== null && item.studentRank !== undefined
          ? `Cutoff Rank: ${item.cutoffMeritNo || 'N/A'}`
          : `Cutoff %ile: ${item.cutoffPercentile?.toFixed(2) || 'N/A'}`;

        return [
          item.preferenceOrder || (idx + 1),
          item.collegeCode || 'N/A',
          `${item.collegeName}\n${typeLabel}`,
          item.branchName || 'N/A',
          `${seatLabel}\n(${cutoffDetail})`,
          item.chanceLabel || 'N/A',
          item.notes || '—'
        ];
      });

      doc.autoTable({
        startY: 36,
        head: headers,
        body: tableData,
        styles: { fontSize: 7.5, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [255, 107, 43], fontStyle: 'bold', fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' }, // Pref #
          1: { cellWidth: 15, halign: 'center' },                  // Code
          2: { cellWidth: 48 },                                      // College Name
          3: { cellWidth: 38 },                                      // Branch Name
          4: { cellWidth: 30 },                                      // Seat Type
          5: { cellWidth: 15, halign: 'center' },                  // Chance
          6: { cellWidth: 32 }                                       // Notes
        },
        didParseCell: function (data) {
          if (data.column.index === 5 && data.section === 'body') {
            const chance = data.cell.raw;
            if (chance === 'High') data.cell.styles.textColor = [34, 197, 94];
            else if (chance === 'Medium') data.cell.styles.textColor = [245, 158, 11];
            else if (chance === 'Low') data.cell.styles.textColor = [239, 68, 68];
          }
        }
      });

      // Save file
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`Navodisha_Option_Form_${dateStr}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('Failed to generate Option Form PDF. Please try again.');
    }
  };

  // Get stats
  const totalItems = shortlist.length;
  const highChanceCount = shortlist.filter(i => i.chanceLabel === 'High').length;
  const mediumChanceCount = shortlist.filter(i => i.chanceLabel === 'Medium').length;
  const lowChanceCount = shortlist.filter(i => i.chanceLabel === 'Low').length;

  return (
    <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)', animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 800,
          marginBottom: 'var(--space-2)'
        }}>
          📋 Preference List Builder
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
          Create, reorder, annotate, and finalize your college choices. Drag and drop cards to change your order.
        </p>
      </div>

      {totalItems > 0 ? (
        <div className="shortlist-container" style={{ animation: 'fadeInUp 0.4s ease 0.1s both' }}>
          {/* Summary Dashboard Card */}
          <div className="shortlist-summary-card">
            <div className="shortlist-stats">
              <div className="shortlist-stat">
                <span className="shortlist-stat-value">{totalItems}</span>
                <span className="shortlist-stat-label">Total Choices</span>
              </div>
              <div className="shortlist-stat">
                <span className="shortlist-stat-value" style={{ color: 'var(--color-success)' }}>{highChanceCount}</span>
                <span className="shortlist-stat-label">High Chance</span>
              </div>
              <div className="shortlist-stat">
                <span className="shortlist-stat-value" style={{ color: 'var(--color-warning)' }}>{mediumChanceCount}</span>
                <span className="shortlist-stat-label">Medium Chance</span>
              </div>
              <div className="shortlist-stat">
                <span className="shortlist-stat-value" style={{ color: 'var(--color-danger)' }}>{lowChanceCount}</span>
                <span className="shortlist-stat-label">Low Chance</span>
              </div>
            </div>

            <div className="shortlist-actions">
              <button className="btn btn-secondary btn-sm" onClick={clearShortlist}>
                🗑️ Clear All
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleDownloadPDF}>
                📥 Download Option Form PDF
              </button>
            </div>
          </div>

          {/* Draggable Preferences List */}
          <div className="shortlist-list">
            {shortlist.map((item, idx) => {
              const chance = getChanceDisplay(item.chanceLabel);
              const isDragging = idx === draggingIndex;
              const isOver = idx === dragOverIndex;

              const isRankSearch = item.studentRank !== null && item.studentRank !== undefined;
              const scoreLabel = isRankSearch ? 'Your Rank' : 'Your Score';
              const scoreVal = isRankSearch ? item.studentRank : (parseFloat(item.studentPercentile)?.toFixed(2) || '—');
              const cutoffLabel = isRankSearch
                ? (item.examId === 'josaa' ? 'Closing Rank' : 'Cutoff Rank')
                : 'Cutoff %ile';
              const cutoffVal = isRankSearch
                ? (item.examId === 'josaa' ? item.stage2MeritNo : item.cutoffMeritNo)
                : (parseFloat(item.cutoffPercentile)?.toFixed(2) || '—');

              const marginLabel = 'Margin';
              const diff = item.percentileDiff;
              const diffFormatted = isRankSearch
                ? (diff >= 0 ? `+${diff}` : `${diff}`)
                : (diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2));

              return (
                <div
                  key={item.key}
                  className={`shortlist-item-wrapper`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    transform: isDragging ? 'scale(0.97)' : 'none'
                  }}
                >
                  <div className={`shortlist-item ${isDragging ? 'dragging' : ''} ${isOver ? 'drag-over' : ''}`}>
                    {/* Header Row: Drag Handle + Preference # + College Title & Meta + Remove button */}
                    <div className="shortlist-item-main-row">
                      <div className="drag-handle" title="Drag to reorder preference">
                        ⋮⋮
                      </div>
                      <div className="preference-badge" title={`Preference Order: ${idx + 1}`}>
                        {idx + 1}
                      </div>
                      <div className="shortlist-college-info-wrapper">
                        <div className="shortlist-college-title">{item.collegeName}</div>
                        <div className="shortlist-college-meta">
                          <span className="meta-tag small">🏛️ {item.collegeType}</span>
                          <span className="meta-tag small">🔢 Code: {item.collegeCode}</span>
                          <span className="meta-tag small" style={{ textTransform: 'uppercase' }}>📡 {item.examId}</span>
                        </div>
                      </div>
                      <button
                        className="btn-remove-shortlist"
                        onClick={() => removeFromShortlist(item)}
                        title="Remove from shortlist"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Details Row: Branch, Seat Profiles, Scores, and Notes */}
                    <div className="shortlist-item-details-wrapper">
                      <div style={{ marginBottom: 'var(--space-2)' }}>
                        📚 <span className="shortlist-branch-name">{item.branchName}</span>
                      </div>

                      {/* Detail Metrics Grid */}
                      <div className="shortlist-item-details">
                        <div className="shortlist-detail-item">
                          <span className="shortlist-detail-label">Seat Profile</span>
                          <span className="shortlist-detail-value">{item.category} ({item.seatType})</span>
                        </div>
                        <div className="shortlist-detail-item">
                          <span className="shortlist-detail-label">{cutoffLabel}</span>
                          <span className="shortlist-detail-value">{cutoffVal}</span>
                        </div>
                        <div className="shortlist-detail-item">
                          <span className="shortlist-detail-label">{scoreLabel}</span>
                          <span className="shortlist-detail-value highlight-rank">{scoreVal}</span>
                        </div>
                        <div className="shortlist-detail-item">
                          <span className="shortlist-detail-label">{marginLabel}</span>
                          <span className={`shortlist-detail-value ${diff >= 0 ? 'positive' : 'negative'}`}>
                            {diffFormatted}
                          </span>
                        </div>
                        <div className="shortlist-detail-item">
                          <span className="shortlist-detail-label">Chance</span>
                          <span className={`badge badge-sm ${chance.className}`} style={{ alignSelf: 'flex-start' }}>
                            {chance.emoji} {item.chanceLabel}
                          </span>
                        </div>
                      </div>

                      {/* Remarks TextArea */}
                      <ShortlistItemInput item={item} updateNotes={updateNotes} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 'var(--space-12) 0', animation: 'fadeInUp 0.4s ease 0.1s both' }}>
          <div className="empty-state-icon">⭐</div>
          <h2 className="empty-state-title">Your Shortlist is Empty</h2>
          <p className="empty-state-text">
            Search for colleges and click the star (☆) button next to college branches to add them to your preference list.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/results')}>
              📊 View Results
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/')}>
              🏠 Go to Predictor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ShortlistPage;
