import { useState, useEffect, useCallback } from 'react';
import { fetchBranches, fetchRounds, fetchCollegeTypes } from '../utils/api';

/**
 * Custom hook for fetching college branches, rounds, and types.
 */
export function useColleges(examId, roundId) {
  const [branches, setBranches] = useState([]);
  const [rounds, setRounds] = useState({});
  const [collegeTypes, setCollegeTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadBranches = useCallback(async (rId, eId) => {
    try {
      const data = await fetchBranches(rId, eId);
      setBranches(data.branches || []);
    } catch (err) {
      console.error('Failed to load branches:', err);
      setBranches([]);
    }
  }, []);

  const loadRounds = useCallback(async () => {
    try {
      const data = await fetchRounds();
      setRounds(data || {});
    } catch (err) {
      console.error('Failed to load rounds:', err);
      setRounds({});
    }
  }, []);

  const loadCollegeTypes = useCallback(async () => {
    try {
      const data = await fetchCollegeTypes();
      setCollegeTypes(data.types || []);
    } catch (err) {
      console.error('Failed to load college types:', err);
      setCollegeTypes([]);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadRounds(), loadCollegeTypes()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [loadRounds, loadCollegeTypes]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadBranches(roundId, examId);
  }, [examId, roundId, loadBranches]);

  // Get rounds as array sorted by name
  const roundsList = Object.entries(rounds)
    .map(([id, data]) => ({ id, ...data }))
    .filter(r => r.status === 'ready')
    .sort((a, b) => (a.roundName || '').localeCompare(b.roundName || ''));

  return {
    branches,
    rounds,
    roundsList,
    collegeTypes,
    loading,
    error,
    loadBranches,
    loadRounds,
    loadAll
  };
}
