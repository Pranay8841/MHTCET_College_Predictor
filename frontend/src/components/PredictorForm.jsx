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

  const [predictBy, setPredictBy] = useState('percentile'); // 'percentile' or 'rank'

  const { roundsList, branches, loading: loadingData } = useColleges(formData.examId, formData.roundId);

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
    if (newExamId === 'josaa') {
      setPredictBy('rank');
    } else {
      setPredictBy('percentile');
    }
  };

  const validate = () => {
    const newErrors = {};

    if (formData.examId === 'josaa' || predictBy === 'rank') {
      if (!formData.rank) {
        newErrors.rank = formData.examId === 'josaa' ? 'Please enter your JEE rank' : 'Please enter your state merit rank';
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

    if (formData.examId === 'josaa' || predictBy === 'rank') {
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
    const idLower = r.id.toLowerCase();
    const nameLower = (r.roundName || '').toLowerCase();
    const isJosaaRound = idLower.includes('josaa') || nameLower.includes('josaa');
    const isPharmaRound = idLower.includes('pharma') || nameLower.includes('pharma');
    const isNursingRound = idLower.includes('nursing') || nameLower.includes('nursing');
    const isAgricultureRound = idLower.includes('agriculture') || nameLower.includes('agriculture');
    
    if (formData.examId === 'pharma') {
      return isPharmaRound;
    } else if (formData.examId === 'nursing') {
      return isNursingRound;
    } else if (formData.examId === 'agriculture') {
      return isAgricultureRound;
    } else if (formData.examId === 'josaa') {
      return isJosaaRound;
    } else {
      // Default to MHT-CET Engineering (neither josaa nor pharma nor nursing nor agriculture)
      return !isJosaaRound && !isPharmaRound && !isNursingRound && !isAgricultureRound;
    }
  });

  const roundOptions = filteredRoundsList.length > 0
    ? filteredRoundsList.map(r => ({ value: r.id, label: `${r.roundName} (${r.year})` }))
    : [{ value: '', label: `No rounds available for ${formData.examId === 'pharma' ? 'MHT-CET Pharmacy' : formData.examId === 'nursing' ? 'B.Sc. Nursing' : formData.examId === 'agriculture' ? 'MHT-CET Agriculture' : formData.examId === 'josaa' ? 'JoSAA' : 'MHT-CET Engineering'}` }];

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
          <label className="form-label">Entrance Exam / Stream *</label>
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
                <strong>MHT-CET Engineering</strong>
                <span>Engineering Cutoffs (%ile)</span>
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="examId"
                id="exam-pharma"
                value="pharma"
                checked={formData.examId === 'pharma'}
                onChange={() => handleExamChange('pharma')}
              />
              <label htmlFor="exam-pharma" className="radio-card">
                <strong>MHT-CET Pharmacy</strong>
                <span>B.Pharmacy & Pharm D (%ile)</span>
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="examId"
                id="exam-nursing"
                value="nursing"
                checked={formData.examId === 'nursing'}
                onChange={() => handleExamChange('nursing')}
                disabled
              />
              <label htmlFor="exam-nursing" className="radio-card">
                <strong>B.Sc. Nursing</strong>
                <span>Coming Soon</span>
              </label>
            </div>
            <div className="radio-option">
              <input
                type="radio"
                name="examId"
                id="exam-agriculture"
                value="agriculture"
                checked={formData.examId === 'agriculture'}
                onChange={() => handleExamChange('agriculture')}
                disabled
              />
              <label htmlFor="exam-agriculture" className="radio-card">
                <strong>MHT-CET Agriculture</strong>
                <span>Coming Soon</span>
              </label>
            </div>
          </div>
        </div>

        {/* Score/Rank Input */}
        <div className="form-group">
          <label className="form-label" htmlFor={predictBy === 'percentile' ? 'percentile' : 'rank'}>
            {formData.examId === 'josaa' 
              ? 'Your JEE Rank *' 
              : 'Enter Score / Rank *'}
          </label>
          
          {formData.examId === 'josaa' ? (
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
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <select
                className="form-select"
                style={{ width: '135px', flexShrink: 0 }}
                value={predictBy}
                onChange={e => {
                  setPredictBy(e.target.value);
                  if (e.target.value === 'percentile') {
                    handleChange('rank', '');
                  } else {
                    handleChange('percentile', '');
                  }
                }}
              >
                <option value="percentile">Percentile</option>
                <option value="rank">State Rank</option>
              </select>
              <div className="form-input-group" style={{ flex: 1 }}>
                {predictBy === 'percentile' ? (
                  <>
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
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </div>
          )}

          {predictBy === 'percentile' && formData.examId !== 'josaa' ? (
            errors.percentile && (
              <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                {errors.percentile}
              </span>
            )
          ) : (
            errors.rank && (
              <span style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                {errors.rank}
              </span>
            )
          )}
        </div>

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
