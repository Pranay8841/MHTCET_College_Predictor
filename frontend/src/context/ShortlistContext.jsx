import React, { createContext, useContext, useState, useEffect } from 'react';

const ShortlistContext = createContext(null);

export const ShortlistProvider = ({ children }) => {
  const [shortlist, setShortlist] = useState([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('mhtcet_predictor_shortlist');
      if (stored) {
        setShortlist(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load shortlist from localStorage:', e);
    }
  }, []);

  // Save to localStorage whenever shortlist changes
  const saveShortlist = (newShortlist) => {
    setShortlist(newShortlist);
    try {
      localStorage.setItem('mhtcet_predictor_shortlist', JSON.stringify(newShortlist));
    } catch (e) {
      console.error('Failed to save shortlist to localStorage:', e);
    }
  };

  const getShortcutKey = (prediction, queryParams = {}) => {
    const examId = queryParams.examId || 'mhtcet';
    const category = queryParams.category || prediction.category || 'OPEN';
    const seatType = queryParams.seatType || prediction.seatType || 'GOPENH';
    return `${prediction.collegeCode}-${prediction.branchCode}-${category}-${seatType}-${examId}`;
  };

  const addToShortlist = (prediction, queryParams = {}) => {
    const key = getShortcutKey(prediction, queryParams);
    
    // Check if already in shortlist
    if (shortlist.some(item => item.key === key)) {
      return false; // Already present
    }

    const examId = queryParams.examId || 'mhtcet';
    const category = queryParams.category || prediction.category || 'OPEN';
    const seatType = queryParams.seatType || prediction.seatType || 'GOPENH';
    const roundId = queryParams.roundId || '';

    const newItem = {
      key,
      collegeCode: prediction.collegeCode,
      collegeName: prediction.collegeName,
      collegeType: prediction.collegeType || 'N/A',
      branchCode: prediction.branchCode,
      branchName: prediction.branchName,
      category,
      seatType,
      roundId,
      examId,
      cutoffPercentile: prediction.cutoffPercentile,
      cutoffMeritNo: prediction.cutoffMeritNo,
      stage2MeritNo: prediction.stage2MeritNo,
      studentPercentile: prediction.studentPercentile || queryParams.percentile,
      studentRank: prediction.studentRank || queryParams.rank,
      percentileDiff: prediction.percentileDiff,
      chanceLabel: prediction.chanceLabel,
      notes: '',
      preferenceOrder: shortlist.length + 1
    };

    const newShortlist = [...shortlist, newItem];
    saveShortlist(newShortlist);
    return true;
  };

  const removeFromShortlist = (prediction, queryParams = {}) => {
    const key = prediction.key || getShortcutKey(prediction, queryParams);
    const filtered = shortlist.filter(item => item.key !== key);
    
    // Re-adjust preference orders so they stay sequential
    const reordered = filtered.map((item, idx) => ({
      ...item,
      preferenceOrder: idx + 1
    }));
    
    saveShortlist(reordered);
  };

  const updateNotes = (key, notes) => {
    const updated = shortlist.map(item => 
      item.key === key ? { ...item, notes } : item
    );
    saveShortlist(updated);
  };

  const reorderShortlist = (newShortlist) => {
    const updated = newShortlist.map((item, idx) => ({
      ...item,
      preferenceOrder: idx + 1
    }));
    saveShortlist(updated);
  };

  const isShortlisted = (prediction, queryParams = {}) => {
    const key = getShortcutKey(prediction, queryParams);
    return shortlist.some(item => item.key === key);
  };

  const clearShortlist = () => {
    saveShortlist([]);
  };

  return (
    <ShortlistContext.Provider value={{
      shortlist,
      addToShortlist,
      removeFromShortlist,
      updateNotes,
      reorderShortlist,
      isShortlisted,
      clearShortlist
    }}>
      {children}
    </ShortlistContext.Provider>
  );
};

export const useShortlist = () => {
  const context = useContext(ShortlistContext);
  if (!context) {
    throw new Error('useShortlist must be used within a ShortlistProvider');
  }
  return context;
};
