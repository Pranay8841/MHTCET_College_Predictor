import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`📡 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'Something went wrong';
    console.error('❌ API Error:', message);
    return Promise.reject(error);
  }
);

// --- API Functions ---

export const fetchPredictions = async (params) => {
  const response = await api.get('/predict', { params });
  return response.data;
};

export const fetchBranches = async (roundId, examId) => {
  const response = await api.get('/colleges/branches', {
    params: {
      ...(roundId && { roundId }),
      ...(examId && { examId })
    }
  });
  return response.data;
};

export const fetchColleges = async (search) => {
  const response = await api.get('/colleges', {
    params: search ? { search } : {}
  });
  return response.data;
};

export const fetchCollegeTypes = async () => {
  const response = await api.get('/colleges/types');
  return response.data;
};

export const fetchRounds = async (adminSecret) => {
  const response = await api.get('/admin/rounds', {
    headers: adminSecret ? { 'X-Admin-Secret': adminSecret } : {}
  });
  return response.data;
};

export const uploadPDF = async (formData, adminSecret, onProgress) => {
  const response = await api.post('/admin/upload-pdf', formData, {
    headers: { 
      'Content-Type': 'multipart/form-data',
      ...(adminSecret && { 'X-Admin-Secret': adminSecret })
    },
    timeout: 300000, // 5 minutes for large PDFs
    onUploadProgress: onProgress
  });
  return response.data;
};

export default api;
