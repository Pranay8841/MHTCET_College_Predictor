/**
 * Admin Routes — PDF Upload & Round Management
 * POST /api/admin/upload-pdf — Upload and parse a cutoff PDF
 * GET  /api/admin/rounds     — List all uploaded rounds
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parseCutoffPDF } = require('../services/pdfParser');
const { saveCutoffsToFirestore } = require('../services/firestoreService');
const { db } = require('../firebaseAdmin');

// Multer config — memory storage, 50MB limit for large PDFs
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Optional admin secret guard
function adminGuard(req, res, next) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return next(); // No secret configured = open access

  const providedSecret = req.headers['x-admin-secret'] || req.query.secret;
  if (providedSecret === adminSecret) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Invalid admin secret.' });
}

/**
 * POST /api/admin/upload-pdf
 * Upload a cutoff PDF for parsing and storage.
 * Body (multipart/form-data): pdfFile, roundName, year
 */
router.post('/upload-pdf', adminGuard, upload.single('pdfFile'), async (req, res) => {
  const startTime = Date.now();

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { roundName, year } = req.body;
    if (!roundName || !year) {
      return res.status(400).json({ error: 'roundName and year are required' });
    }

    const roundId = `${year}_${roundName.replace(/\s+/g, '_')}`;
    console.log(`\n📤 Upload started: ${roundName} (${year}) → roundId: ${roundId}`);
    console.log(`   PDF size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB`);

    // 1. Upload PDF to Cloudinary (if configured)
    let cloudinaryUrl = null;
    try {
      const cloudinaryService = require('../services/cloudinaryService');
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const cloudinaryResult = await cloudinaryService.uploadPDF(
          req.file.buffer,
          `cutoffs/${roundId}`
        );
        cloudinaryUrl = cloudinaryResult.secure_url;
      }
    } catch (err) {
      console.warn('⚠️  Cloudinary upload skipped:', err.message);
    }

    // 2. Create metadata doc in Firestore
    if (db) {
      await db.collection('metadata').doc('rounds').set({
        [roundId]: {
          roundName,
          year,
          uploadedAt: new Date(),
          cloudinaryUrl: cloudinaryUrl || '',
          status: 'processing',
          totalColleges: 0,
          totalBranches: 0
        }
      }, { merge: true });
    }

    // 3. Send immediate response (parsing happens async below)
    res.json({
      success: true,
      roundId,
      message: 'PDF uploaded successfully. Processing started.',
      cloudinaryUrl
    });

    // 4. Parse PDF (async — don't block response)
    console.log(`\n⏳ Parsing PDF...`);
    const parseStart = Date.now();
    const parsedData = await parseCutoffPDF(req.file.buffer);
    console.log(`   Parsing completed in ${((Date.now() - parseStart) / 1000).toFixed(1)}s`);
    console.log(`   Found ${parsedData.length} branch entries`);

    // 5. Save to Firestore in batches
    if (db) {
      console.log(`\n💾 Saving to Firestore...`);
      const saveStart = Date.now();
      const { totalColleges, totalBranches } = await saveCutoffsToFirestore(parsedData, roundId, year);
      console.log(`   Firestore save completed in ${((Date.now() - saveStart) / 1000).toFixed(1)}s`);

      // 6. Update metadata with final counts
      await db.collection('metadata').doc('rounds').set({
        [roundId]: {
          status: 'ready',
          totalColleges,
          totalBranches,
          processedAt: new Date()
        }
      }, { merge: true });

      // Clear memory cache for this round to ensure new data is loaded
      if (global.cutoffCache) {
        delete global.cutoffCache[roundId];
        console.log(`🗑️  Cleared memory cache for round: "${roundId}"`);
      }

      console.log(`\n✅ Upload complete: ${totalColleges} colleges, ${totalBranches} branches`);
      console.log(`   Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);
    } else {
      console.log('⚠️  Firestore not available. Parsed data not saved.');
      console.log('   First 3 entries:', JSON.stringify(parsedData.slice(0, 3), null, 2));
    }

  } catch (err) {
    console.error('❌ Upload error:', err);

    // Update status to error if possible
    try {
      if (db && req.body?.roundName && req.body?.year) {
        const roundId = `${req.body.year}_${req.body.roundName.replace(/\s+/g, '_')}`;
        await db.collection('metadata').doc('rounds').set({
          [roundId]: { status: 'error', error: err.message }
        }, { merge: true });
      }
    } catch (e) { /* ignore */ }

    // Only send error if headers haven't been sent
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

/**
 * GET /api/admin/rounds
 * List all uploaded rounds with their status.
 */
router.get('/rounds', async (req, res) => {
  try {
    if (!db) {
      return res.json({});
    }
    const doc = await db.collection('metadata').doc('rounds').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (err) {
    console.error('❌ Error fetching rounds:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/parse-test
 * Parse a PDF and return the results without saving to Firestore.
 * Useful for testing the parser.
 */
router.post('/parse-test', adminGuard, upload.single('pdfFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    console.log(`\n🧪 Parse test started (${(req.file.size / (1024 * 1024)).toFixed(2)} MB)`);
    const startTime = Date.now();
    const parsedData = await parseCutoffPDF(req.file.buffer);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Return summary + first 10 entries
    res.json({
      totalEntries: parsedData.length,
      parseDurationSeconds: parseFloat(duration),
      sampleEntries: parsedData.slice(0, 10),
      colleges: [...new Set(parsedData.map(e => e.collegeName))].length,
      branches: [...new Set(parsedData.map(e => e.branchName))].length
    });

  } catch (err) {
    console.error('❌ Parse test error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
