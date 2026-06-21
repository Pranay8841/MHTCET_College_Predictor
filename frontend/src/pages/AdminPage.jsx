import React, { useState, useEffect, useRef, useCallback } from 'react';
import { uploadPDF, fetchRounds } from '../utils/api';

function AdminPage() {
  const [roundName, setRoundName] = useState('CAP Round I');
  const [year, setYear] = useState('2024-25');
  const [examId, setExamId] = useState('mhtcet');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null); // 'success', 'error'
  const [uploadMessage, setUploadMessage] = useState('');
  const [rounds, setRounds] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const fileInputRef = useRef(null);

  // Clear any legacy saved adminSecret from localStorage on mount
  useEffect(() => {
    localStorage.removeItem('adminSecret');
  }, []);

  // Load existing rounds
  const loadRounds = useCallback(async () => {
    try {
      const data = await fetchRounds(adminSecret);
      setRounds(data || {});
    } catch (err) {
      console.error('Failed to load rounds:', err);
      if (err.response?.status === 401) {
        setRounds({});
      }
    }
  }, [adminSecret]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  // Poll for processing status
  useEffect(() => {
    const hasProcessing = Object.values(rounds).some(r => r.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(loadRounds, 5000);
    return () => clearInterval(interval);
  }, [rounds, loadRounds]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf' || droppedFile?.name.endsWith('.html')) {
      setFile(droppedFile);
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected) setFile(selected);
  };

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      setUploadStatus('error');
      setUploadMessage('Please select a PDF or HTML file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadStatus(null);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('pdfFile', file);
      formData.append('roundName', roundName);
      formData.append('year', year);
      formData.append('examId', examId);

      const result = await uploadPDF(formData, adminSecret, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadProgress(progress);
      });

      setUploadStatus('success');
      setUploadMessage(result.message || 'File uploaded successfully! Processing started.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Refresh rounds after a short delay
      setTimeout(loadRounds, 2000);
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const roundEntries = Object.entries(rounds).sort((a, b) =>
    (b[1].uploadedAt?._seconds || 0) - (a[1].uploadedAt?._seconds || 0)
  );

  return (
    <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-16)', maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)', animation: 'fadeInUp 0.4s ease' }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-3xl)',
          fontWeight: 800,
          marginBottom: 'var(--space-2)'
        }}>
          ⚙️ Admin Panel
        </h1>
        <p style={{ color: 'var(--color-text-secondary)' }}>
          Upload CAP Round cutoff PDFs or JoSAA HTML files for processing
        </p>
      </div>

      {/* Admin Secret Input */}
      <div className="card" style={{ marginBottom: 'var(--space-6)', animation: 'fadeInUp 0.5s ease 0.05s both' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="admin-secret-key">🔑 Admin Secret Key</label>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <input
              type="password"
              id="admin-secret-key"
              className="form-input"
              value={adminSecret}
              onChange={e => setAdminSecret(e.target.value)}
              placeholder="Enter admin secret to authorize uploads"
              style={{ flex: 1 }}
            />
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={loadRounds}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleUpload} style={{ animation: 'fadeInUp 0.5s ease 0.1s both' }}>
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            marginBottom: 'var(--space-6)'
          }}>
            📤 Upload Cutoff File (PDF/HTML)
          </h2>

          <div className="form-grid" style={{ marginBottom: 'var(--space-6)' }}>
            {/* Exam Selector */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-exam-id">Exam / Stream</label>
              <select
                id="admin-exam-id"
                className="form-select"
                value={examId}
                onChange={e => {
                  setExamId(e.target.value);
                  setFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <option value="mhtcet">MHT-CET Engineering (PDF)</option>
                <option value="pharma">MHT-CET Pharmacy (PDF)</option>
                <option value="nursing" disabled>B.Sc. Nursing (PDF) [Coming Soon]</option>
                <option value="agriculture" disabled>MHT-CET Agriculture (PDF) [Coming Soon]</option>
                <option value="josaa">JoSAA (IIT/NIT) (HTML)</option>
              </select>
            </div>

            {/* Round Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-round-name">Round Name</label>
              <input
                type="text"
                id="admin-round-name"
                className="form-input"
                value={roundName}
                onChange={e => setRoundName(e.target.value)}
                placeholder="e.g. CAP Round I or JoSAA Round 1"
                required
              />
            </div>

            {/* Year */}
            <div className="form-group">
              <label className="form-label" htmlFor="admin-year">Academic Year</label>
              <input
                type="text"
                id="admin-year"
                className="form-input"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="e.g. 2024-25"
                required
              />
            </div>
          </div>

          {/* File Drop Zone */}
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept={examId === 'josaa' ? '.html' : '.pdf'}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="admin-pdf-file"
            />
            <div className="upload-zone-icon">
              {file ? '📄' : '📁'}
            </div>
            <div className="upload-zone-text">
              {file ? (
                <>
                  <strong>{file.name}</strong>
                  <br />
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </>
              ) : (
                `Drop your ${examId === 'josaa' ? 'HTML' : 'PDF'} file here or click to browse`
              )}
            </div>
            <div className="upload-zone-hint">
              Supports {examId === 'josaa' ? 'HTML' : 'PDF'} files up to 50 MB
            </div>
          </div>

          {/* Upload Progress */}
          {uploading && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-2)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-secondary)'
              }}>
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Status Message */}
          {uploadStatus && (
            <div style={{
              marginTop: 'var(--space-4)',
              padding: 'var(--space-3) var(--space-4)',
              borderRadius: 'var(--radius-lg)',
              fontSize: 'var(--text-sm)',
              background: uploadStatus === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: uploadStatus === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              border: `1px solid ${uploadStatus === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`
            }}>
              {uploadStatus === 'success' ? '✅' : '❌'} {uploadMessage}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--space-6)' }}
            disabled={uploading || !file}
          >
            {uploading ? (
              <>
                <span className="animate-spin" style={{ display: 'inline-block' }}>⏳</span>
                Uploading & Processing...
              </>
            ) : (
              '🚀 Upload & Process File'
            )}
          </button>
        </div>
      </form>

      {/* Uploaded Rounds List */}
      <div style={{ animation: 'fadeInUp 0.5s ease 0.2s both' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          marginBottom: 'var(--space-4)'
        }}>
          📋 Uploaded Rounds
        </h2>

        {roundEntries.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)', opacity: 0.5 }}>📭</div>
            <p style={{ color: 'var(--color-text-secondary)' }}>
              No rounds uploaded yet. Upload your first cutoff PDF above.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {roundEntries.map(([id, round]) => (
              <div key={id} className="round-item">
                <div className="round-info">
                  <span className="round-name">{round.roundName || id}</span>
                  <span className="round-meta">
                    Year: {round.year || 'N/A'} • 
                    Exam: {id.toLowerCase().includes('pharma') ? 'MHT-CET Pharma' : id.toLowerCase().includes('nursing') ? 'B.Sc. Nursing' : id.toLowerCase().includes('agriculture') ? 'MHT-CET Agriculture' : id.toLowerCase().includes('josaa') ? 'JoSAA' : 'MHT-CET Engineering'} • 
                    {round.totalColleges ? ` ${round.totalColleges} colleges` : ''} • 
                    {round.totalBranches ? ` ${round.totalBranches} branches` : ''}
                  </span>
                </div>
                <span className={`badge badge-${
                  round.status === 'ready' ? 'success' :
                  round.status === 'processing' ? 'processing' :
                  round.status === 'error' ? 'error' : 'info'
                }`}>
                  {round.status === 'ready' ? '✅ Ready' :
                   round.status === 'processing' ? '⏳ Processing' :
                   round.status === 'error' ? '❌ Error' : round.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
