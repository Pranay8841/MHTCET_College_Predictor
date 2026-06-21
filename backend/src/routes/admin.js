/**
 * Admin Routes — PDF Upload & Round Management
 * POST /api/admin/upload-pdf — Upload and parse a cutoff PDF
 * GET  /api/admin/rounds     — List all uploaded rounds
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parseCutoffPDF } = require('../services/pdfParser');
const { saveCutoffsToSupabase, saveJosaaCutoffsToSupabase, clearBranchCache } = require('../services/supabaseService');
const { supabase } = require('../supabaseClient');

// Multer config — memory storage, 50MB limit for large files (PDF or HTML)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf';
    const isHtml = file.mimetype === 'text/html' || file.originalname.endsWith('.html');
    if (isPdf || isHtml) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or HTML files are allowed'), false);
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
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const isHtml = req.file.mimetype === 'text/html' || req.file.originalname.endsWith('.html');
    let { roundName, year, examId = 'mhtcet' } = req.body;
    if (!roundName || !year) {
      return res.status(400).json({ error: 'roundName and year are required' });
    }

    // Normalize roman numerals (e.g. replace lowercase 'l' with 'I') and trim spaces
    roundName = roundName.trim().replace(/Round\s+([lvx]+)/i, (match, roman) => {
      return `Round ${roman.toUpperCase().replace(/L/g, 'I')}`;
    });

    const actualExamId = isHtml ? 'josaa' : examId;

    // Ensure unique round_id per exam stream
    let roundId = `${year}_${roundName.replace(/\s+/g, '_')}`;
    if (actualExamId !== 'mhtcet') {
      roundId += `_${actualExamId}`;
    }
    console.log(`\n📤 Upload started: ${roundName} (${year}) for ${actualExamId} → roundId: ${roundId}`);
    console.log(`   File size: ${(req.file.size / (1024 * 1024)).toFixed(2)} MB (${isHtml ? 'HTML' : 'PDF'})`);

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

    // 2. Create metadata doc in Supabase
    if (supabase) {
      await supabase.from('rounds_metadata').upsert({
        round_id: roundId,
        round_name: roundName,
        year,
        uploaded_at: new Date().toISOString(),
        cloudinary_url: cloudinaryUrl || '',
        status: 'processing',
        total_colleges: 0,
        total_branches: 0
      });
    }

    // 3. Send immediate response (parsing happens async below)
    res.json({
      success: true,
      roundId,
      message: `${isHtml ? 'HTML' : 'PDF'} uploaded successfully. Processing started.`,
      cloudinaryUrl
    });

    // 4. Parse PDF or HTML (async — don't block response)
    let parsedData;
    const parseStart = Date.now();
    if (isHtml) {
      console.log(`\n⏳ Parsing HTML...`);
      const { parseJosaaHTML } = require('../services/josaaParser');
      parsedData = parseJosaaHTML(req.file.buffer.toString('utf-8'));
    } else if (actualExamId === 'nursing') {
      console.log(`\n⏳ Parsing Nursing PDF...`);
      const { parseNursingPDF } = require('../services/nursingParser');
      parsedData = await parseNursingPDF(req.file.buffer);
    } else if (actualExamId === 'agriculture') {
      console.log(`\n⏳ Parsing Agriculture PDF...`);
      const { parseAgriculturePDF } = require('../services/agricultureParser');
      parsedData = await parseAgriculturePDF(req.file.buffer);
    } else {
      console.log(`\n⏳ Parsing PDF...`);
      parsedData = await parseCutoffPDF(req.file.buffer);
    }
    console.log(`   Parsing completed in ${((Date.now() - parseStart) / 1000).toFixed(1)}s`);
    console.log(`   Found ${parsedData.length} entries`);

    // 5. Save to Supabase in batches
    if (supabase) {
      console.log(`\n💾 Saving to Supabase...`);
      const saveStart = Date.now();
      let totalColleges, totalBranches;
      if (isHtml) {
        const res = await saveJosaaCutoffsToSupabase(parsedData, roundId, year);
        totalColleges = res.totalColleges;
        totalBranches = res.totalBranches;
      } else {
        const res = await saveCutoffsToSupabase(parsedData, roundId, year, actualExamId);
        totalColleges = res.totalColleges;
        totalBranches = res.totalBranches;
      }
      console.log(`   Supabase save completed in ${((Date.now() - saveStart) / 1000).toFixed(1)}s`);

      // 6. Update metadata with final counts
      await supabase.from('rounds_metadata').upsert({
        round_id: roundId,
        round_name: roundName,
        year,
        status: 'ready',
        total_colleges: totalColleges,
        total_branches: totalBranches,
        processed_at: new Date().toISOString()
      });

      // Clear memory cache for this round to ensure new data is loaded
      if (global.cutoffCache) {
        delete global.cutoffCache[roundId];
        console.log(`🗑️  Cleared memory cache for round: "${roundId}"`);
      }
      clearBranchCache();

      console.log(`\n✅ Upload complete: ${totalColleges} colleges, ${totalBranches} branches`);
      console.log(`   Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s\n`);
    } else {
      console.log('⚠️  Supabase not available. Parsed data not saved.');
      console.log('   First 3 entries:', JSON.stringify(parsedData.slice(0, 3), null, 2));
    }

  } catch (err) {
    console.error('❌ Upload error:', err);

    // Update status to error if possible
    try {
      if (supabase && req.body?.roundName && req.body?.year) {
        const roundId = `${req.body.year}_${req.body.roundName.replace(/\s+/g, '_')}`;
        await supabase.from('rounds_metadata').upsert({
          round_id: roundId,
          round_name: req.body.roundName,
          year: req.body.year,
          status: 'error',
          error: err.message
        });
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
    if (!supabase) {
      return res.json({});
    }
    const { data, error } = await supabase
      .from('rounds_metadata')
      .select('*');
    if (error) throw error;

    const formatted = {};
    data.forEach(r => {
      formatted[r.round_id] = {
        roundName: r.round_name,
        year: r.year,
        uploadedAt: r.uploaded_at,
        cloudinaryUrl: r.cloudinary_url,
        status: r.status,
        totalColleges: r.total_colleges,
        totalBranches: r.total_branches,
        processedAt: r.processed_at,
        error: r.error
      };
    });
    res.json(formatted);
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
