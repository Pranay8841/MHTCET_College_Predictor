import { useState, useCallback } from 'react';
import { fetchPredictions } from '../utils/api';

/**
 * Custom hook for fetching and managing prediction results.
 */
export function usePredictions() {
  const [predictions, setPredictions] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getPredictions = useCallback(async (params) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchPredictions(params);
      setPredictions(data.predictions || []);
      setStats(data.stats || null);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      return data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to fetch predictions';
      setError(message);
      setPredictions([]);
      setStats(null);
      setTotal(0);
      setTotalPages(0);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearPredictions = useCallback(() => {
    setPredictions([]);
    setStats(null);
    setTotal(0);
    setTotalPages(0);
    setError(null);
  }, []);

  return {
    predictions,
    stats,
    total,
    totalPages,
    loading,
    error,
    getPredictions,
    clearPredictions
  };
}
