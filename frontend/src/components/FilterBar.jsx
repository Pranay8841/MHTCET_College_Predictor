import React from 'react';
import {
  CHANCE_FILTER_OPTIONS,
  SORT_OPTIONS,
  COLLEGE_TYPE_OPTIONS,
  JOSAA_COLLEGE_TYPE_OPTIONS
} from '../utils/categoryOptions';

function FilterBar({ filters, onFilterChange, branches, isJosaa }) {
  const handleChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value });
  };

  const collegeTypeOptions = isJosaa ? JOSAA_COLLEGE_TYPE_OPTIONS : COLLEGE_TYPE_OPTIONS;

  return (
    <div className="filter-bar">
      {/* Chance Level Filter */}
      <select
        className="form-select"
        value={filters.chance || 'all'}
        onChange={e => handleChange('chance', e.target.value)}
        id="filter-chance"
      >
        {CHANCE_FILTER_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Branch Filter */}
      <select
        className="form-select"
        value={filters.branchFilter || 'all'}
        onChange={e => handleChange('branchFilter', e.target.value)}
        id="filter-branch"
        style={{ minWidth: '200px' }}
      >
        <option value="all">All Branches</option>
        {branches.map(b => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      {/* College Type Filter */}
      <select
        className="form-select"
        value={filters.collegeTypeFilter || 'all'}
        onChange={e => handleChange('collegeTypeFilter', e.target.value)}
        id="filter-college-type"
      >
        {collegeTypeOptions.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Sort */}
      <select
        className="form-select"
        value={filters.sort || 'chance-desc'}
        onChange={e => handleChange('sort', e.target.value)}
        id="filter-sort"
      >
        {SORT_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Search */}
      <input
        type="text"
        className="form-input"
        placeholder="🔍 Search college name..."
        value={filters.search || ''}
        onChange={e => handleChange('search', e.target.value)}
        id="filter-search"
        style={{ minWidth: '200px' }}
      />
    </div>
  );
}

export default FilterBar;
