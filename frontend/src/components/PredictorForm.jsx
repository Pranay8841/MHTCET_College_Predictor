import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { useColleges } from '../hooks/useColleges';
import {
  CATEGORY_OPTIONS,
  GENDER_OPTIONS,
  SEAT_TYPE_OPTIONS,
  COLLEGE_TYPE_OPTIONS,
  JOSAA_CATEGORY_OPTIONS,
  JOSAA_SEAT_TYPE_OPTIONS
} from '../utils/categoryOptions';

function PredictorForm() {
  const navigate = useNavigate();
  const { roundsList, branches, loading: loadingData } = useColleges();

  const [formData, setFormData] = useState({
    examId: 'mhtcet',
    percentile: '',
    rank: '',
    category: 'OPEN',
    gender: 'G',
    seatType: 'S',
    roundId: '',
    branch: [],
    collegeType: 'all'
  });

  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error on change
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleExamChange = (newExamId) => {
    setFormData({
      examId: newExamId,
      percentile: '',
      rank: '',
      category: 'OPEN',
      gender: 'G',
      seatType: newExamId === 'josaa' ? 'AI' : 'S',
      roundId: '',
      branch: [],
      collegeType: 'all'
    });
    setErrors({});
  };

  const validate = () => {
    const newErrors = {};

    if (formData.examId === 'josaa') {
      if (!formData.rank) {
        newErrors.rank = 'Please enter your JEE rank';
      } else {
        const rk = parseInt(formData.rank, 10);
        if (isNaN(rk) || rk <= 0) {
          newErrors.rank = 'Rank must be a positive integer';
        }
      }
    } else {
      if (!formData.percentile) {
        newErrors.percentile = 'Please enter your percentile';
      } else {
        const pct = parseFloat(formData.percentile);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          newErrors.percentile = 'Percentile must be between 0 and 100';
        }
      }
    }

    if (!formData.roundId) {
      newErrors.roundId = 'Please select a round';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Build query params
    const params = new URLSearchParams({
      examId: formData.examId,
      category: formData.category,
      gender: formData.gender,
      seatType: formData.seatType,
      roundId: formData.roundId,
      collegeType: formData.collegeType
    });

    if (formData.examId === 'josaa') {
      params.set('rank', formData.rank);
    } else {
      params.set('percentile', formData.percentile);
    }

    // Add selected branches
    if (formData.branch.length > 0) {
      formData.branch.forEach(b => params.append('branch', b.value));
    } else {
      params.set('branch', 'all');
    }

    navigate(`/results?${params.toString()}`);
  };

  // Branch options for react-select
  const branchOptions = branches.map(b => ({ value: b, label: b }));

  // Filter rounds list based on exam selection
  const filteredRoundsList = roundsList.filter(r => {
    const isJosaaRound = r.id.toLowerCase().includes('josaa') || (r.roundName && r.roundName.toLowerCase().includes('josaa'));
    return formData.examId === 'josaa' ? isJosaaRound : !isJosaaRound;
  });

  const roundOptions = filteredRoundsList.length > 0
    ? filteredRoundsList.map(r => ({ value: r.id, label: `${r.roundName} (${r.year})` }))
    : [{ value: '', label: `No rounds available for ${formData.examId === 'josaa' ? 'JoSAA' : 'MHT-CET'}` }];

  const categoryOptionsList = formData.examId === 'josaa' ? JOSAA_CATEGORY_OPTIONS : CATEGORY_OPTIONS;
  const seatTypeOptionsList = formData.examId === 'josaa' ? JOSAA_SEAT_TYPE_OPTIONS : SEAT_TYPE_OPTIONS;

  return (
    <form className="predictor-form-card" onSubmit={handleSubmit} id="predictor-form">
      <h2 style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'var(--text-2xl)',
        fontWeight: 700,
        textAlign: 'center',
        marginBottom: 'var(--space-8)'
      }}>
        🎯 Enter Your Details
      </h2>

      <div className="form-grid">
        {/* Entrance Exam Selection */}
        <div className="form-group full-width" style={{ marginBottom: 'var(--space-4)' }}>
          <label className="form-label">Entrance Exam *</label>
          <div className="radio-group">
            <div className="radio-option">
              <input
                type="radio"
                name="examId"
                id="exam-mhtcet"
                value="mhtcet"
                checked={formData.examId === 'mhtcet'}
                onChange={() => handleExamChange('mhtcet')}
              />
              <label htmlFor="exam-mhtcet" className="radio-card">
                <strong>MHT-CET</strong>
                <span>Maharashtra Cutoffs (%ile)</span>
              </label>
            </div>
            <div className="radio-option" style={{ opacity: 0.5, pointerEvents: 'none', position: 'relative' }}>
              <input
                type="radio"
                name="examId"
                id="exam-josaa"
                value="josaa"
                checked={formData.examId === 'josaa'}
                onChange={() => handleExamChange('josaa')}
                disabled
              />
              <label htmlFor="exam-josaa" className="radio-card">
                <strong>JoSAA (IIT/NIT)</strong>
                <span>Coming Soon</span>
              </label>
            </div>
          </div>
        </div>

        {/* Score/Rank Input */}
        {formData.examId === 'josaa' ? (
          <div className="form-group">
            <label className="form-label" htmlFor="rank">Your JEE Rank *</label>
            <div className="form-input-group">
              <input
                type="number"
                id="rank"
                className="form-input"
                placeholder="e.g. 5240"
                min="1"
                value={formData.rank}
                onChange={e => handleChange('rank', e.target.value)}
              />
              <span className="form-input-suffix">Rank</span>
            </div>
            {errors.rank && (
              <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                {errors.rank}
              </span>
            )}
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label" htmlFor="percentile">Your Percentile *</label>
            <div className="form-input-group">
              <input
                type="number"
                id="percentile"
                className="form-input"
                placeholder="e.g. 88.5013"
                step="0.0001"
                min="0"
                max="100"
                value={formData.percentile}
                onChange={e => handleChange('percentile', e.target.value)}
              />
              <span className="form-input-suffix">%ile</span>
            </div>
            {errors.percentile && (
              <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
                {errors.percentile}
              </span>
            )}
          </div>
        )}

        {/* Round Selection */}
        <div className="form-group">
          <label className="form-label" htmlFor="roundId">
            {formData.examId === 'josaa' ? 'JoSAA Round *' : 'CAP Round *'}
          </label>
          <select
            id="roundId"
            className="form-select"
            value={formData.roundId}
            onChange={e => handleChange('roundId', e.target.value)}
          >
            <option value="">Select round...</option>
            {roundOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {errors.roundId && (
            <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }}>
              {errors.roundId}
            </span>
          )}
        </div>

        {/* Gender */}
        <div className="form-group">
          <label className="form-label">Gender / Seat Pool *</label>
          <div className="radio-group">
            {GENDER_OPTIONS.map(opt => (
              <div key={opt.value} className="radio-option">
                <input
                  type="radio"
                  name="gender"
                  id={`gender-${opt.value}`}
                  value={opt.value}
                  checked={formData.gender === opt.value}
                  onChange={e => handleChange('gender', e.target.value)}
                />
                <label htmlFor={`gender-${opt.value}`}>
                  {opt.icon} {formData.examId === 'josaa' && opt.value === 'G' ? 'Gender-Neutral' : opt.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Category */}
        <div className="form-group">
          <label className="form-label" htmlFor="category">Category *</label>
          <select
            id="category"
            className="form-select"
            value={formData.category}
            onChange={e => handleChange('category', e.target.value)}
          >
            {categoryOptionsList.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Seat Type / Quota */}
        <div className="form-group">
          <label className="form-label" htmlFor="seatType">
            {formData.examId === 'josaa' ? 'Quota *' : 'Seat Type *'}
          </label>
          <select
            id="seatType"
            className="form-select"
            value={formData.seatType}
            onChange={e => handleChange('seatType', e.target.value)}
          >
            {seatTypeOptionsList.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {formData.examId === 'josaa'
              ? 'AI: All India (default for IITs), HS/OS: NITs Quota system'
              : SEAT_TYPE_OPTIONS.find(s => s.value === formData.seatType)?.description}
          </span>
        </div>

        {/* College Type */}
        <div className="form-group">
          <label className="form-label" htmlFor="collegeType">College Type</label>
          <select
            id="collegeType"
            className="form-select"
            value={formData.collegeType}
            onChange={e => handleChange('collegeType', e.target.value)}
          >
            {formData.examId === 'josaa' ? (
              <>
                <option value="all">All (IIT/NIT/IIIT/GFTI)</option>
                <option value="IIT/NIT">IIT / NIT</option>
                <option value="Central Govt">Central Govt</option>
              </>
            ) : (
              COLLEGE_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))
            )}
          </select>
        </div>

        {/* Preferred Branches — Multi-select */}
        <div className="form-group full-width">
          <label className="form-label">Preferred Branches (optional)</label>
          <Select
            isMulti
            options={branchOptions}
            value={formData.branch}
            onChange={selected => handleChange('branch', selected || [])}
            placeholder="All branches (leave empty for all)"
            className="react-select-container"
            classNamePrefix="react-select"
            isLoading={loadingData}
            noOptionsMessage={() => 'No branches found — upload data in Admin first'}
            styles={{
              container: (base) => ({ ...base, width: '100%' })
            }}
          />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            Leave empty to search across all branches
          </span>
        </div>

        {/* Submit Button */}
        <div className="full-width" style={{ marginTop: 'var(--space-2)' }}>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loadingData}
          >
            🔍 Find My Colleges
          </button>
        </div>
      </div>
    </form>
  );
}

export default PredictorForm;
