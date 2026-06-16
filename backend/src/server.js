require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Routes
const adminRoutes = require('./routes/admin');
const predictRoutes = require('./routes/predict');
const collegeRoutes = require('./routes/colleges');

app.use('/api/admin', adminRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/colleges', collegeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MHTCET College Predictor Backend`);
  console.log(`   Server running on http://192.168.1.8:${PORT}`);
  console.log(`   Health check: http://192.168.1.8:${PORT}/api/health\n`);
});

module.exports = app;
