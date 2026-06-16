import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Select from 'react-select';
import { useColleges } from '../hooks/useColleges';
import {
  CATEGORY_OPTIONS,
  GENDER_OPTIONS,
  SEAT_TYPE_OPTIONS,
  COLLEGE_TYPE_OPTIONS
} from '../utils/categoryOptions';

function PredictorForm() {
  const navigate = useNavigate();
  const { roundsList, branches, loading: loadingData } = useColleges();

  const [formData, setFormData] = useState({
    percentile: '',
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

  const validate = () => {
    const newErrors = {};

    if (!formData.percentile) {
      newErrors.percentile = 'Please enter your percentile';
    } else {
      const pct = parseFloat(formData.percentile);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        newErrors.percentile = 'Percentile must be between 0 and 100';
      }
    }

    if (!formData.roundId) {
      newErrors.roundId = 'Please select a CAP round';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    // Build query params
    const params = new URLSearchParams({
      percentile: formData.percentile,
      category: formData.category,
      gender: formData.gender,
      seatType: formData.seatType,
      roundId: formData.roundId,
      collegeType: formData.collegeType
    });

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

  // Round options
  const roundOptions = roundsList.length > 0
    ? roundsList.map(r => ({ value: r.id, label: `${r.roundName} (${r.year})` }))
    : [{ value: '', label: 'No rounds available — upload data in Admin' }];

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
        {/* Percentile Input */}
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

        {/* CAP Round */}
        <div className="form-group">
          <label className="form-label" htmlFor="roundId">CAP Round *</label>
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
          <label className="form-label">Gender *</label>
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
                  {opt.icon} {opt.label}
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
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Seat Type */}
        <div className="form-group">
          <label className="form-label" htmlFor="seatType">Seat Type *</label>
          <select
            id="seatType"
            className="form-select"
            value={formData.seatType}
            onChange={e => handleChange('seatType', e.target.value)}
          >
            {SEAT_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            {SEAT_TYPE_OPTIONS.find(s => s.value === formData.seatType)?.description}
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
            {COLLEGE_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
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
