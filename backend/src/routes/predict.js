/**
 * Prediction Routes — Student College Prediction
 * GET /api/predict — Query cutoffs and calculate admission chances
 */

const express = require('express');
const router = express.Router();
const { db } = require('../firebaseAdmin');
const { buildCategoryCodes } = require('../utils/categoryDecoder');

/**
 * GET /api/predict
 * Query cutoffs and calculate admission chances based on student's profile.
 * 
 * Query params:
 *   percentile  (required) — Student's percentile (0-100)
 *   category    (required) — OPEN, SC, ST, VJ, NT1, NT2, NT3, OBC, SEBC, EWS, PWD, DEF, TFW, ORPHAN
 *   gender      (required) — G (Male/General) or L (Ladies/Female)
 *   seatType    (required) — S (State), H (Home Univ), O (Other)
 *   roundId     (required) — e.g., "2024-25_CAP_Round_I"
 *   branch      (optional) — Branch name filter, or "all"
 *   collegeType (optional) — College type filter (e.g., "Government")
 *   page        (optional) — Page number (default: 1)
 *   limit       (optional) — Results per page (default: 20)
 */
router.get('/', async (req, res) => {
  try {
    const {
      percentile,
      category,
      gender,
      seatType,
      roundId,
      branch,
      collegeType,
      page = 1,
      limit = 20
    } = req.query;

    // Validation
    if (!percentile || !category || !gender || !seatType || !roundId) {
      return res.status(400).json({
        error: 'Missing required parameters: percentile, category, gender, seatType, roundId'
      });
    }

    const pct = parseFloat(percentile);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: 'percentile must be a number between 0 and 100' });
    }

    if (!db) {
      return res.status(503).json({ error: 'Database not available. Check Firebase configuration.' });
    }

    // Build target category codes to check
    const categoryCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), seatType.toUpperCase());

    // Load cutoff data (from memory cache or Firestore query)
    let dataList = [];
    if (global.cutoffCache && global.cutoffCache[roundId]) {
      dataList = global.cutoffCache[roundId];
    } else {
      console.log(`📡 Cache miss. Fetching Round "${roundId}" cutoffs from Firestore...`);
      const snapshot = await db.collection('cutoffs').where('roundId', '==', roundId).get();
      snapshot.forEach(doc => dataList.push(doc.data()));
      
      if (!global.cutoffCache) global.cutoffCache = {};
      global.cutoffCache[roundId] = dataList;
      console.log(`💾 Memory cache populated: ${dataList.length} entries for "${roundId}"`);
    }

    // Filter by branch in memory
    let filteredData = dataList;
    if (branch && branch !== 'all') {
      filteredData = dataList.filter(d => d.branchName === branch);
    }

    const predictions = [];

    filteredData.forEach(data => {
      // Apply college type filter
      if (collegeType && collegeType !== 'all') {
        if (!data.collegeType.toLowerCase().includes(collegeType.toLowerCase())) {
          return;
        }
      }

      // Check each seat block
      data.seatBlocks.forEach(block => {
        // Filter seat blocks by seat type
        const blockMatchesSeatType = matchesSeatType(block.seatBlockType, seatType);
        if (!blockMatchesSeatType) return;

        // Check each category code the student is eligible for
        categoryCodes.forEach(catCode => {
          const catData = block.categories[catCode];
          if (!catData) return;

          const cutoffPct = catData.stage1Percentile;
          if (cutoffPct === null || cutoffPct === undefined) return;

          // Calculate admission chance
          const chance = calculateChance(pct, cutoffPct);

          if (chance > 0) {
            predictions.push({
              collegeCode: data.collegeCode,
              collegeName: data.collegeName,
              collegeType: data.collegeType,
              homeUniversity: data.homeUniversity,
              branchCode: data.branchCode,
              branchName: data.branchName,
              seatBlockType: block.seatBlockType,
              category: catCode,
              cutoffPercentile: cutoffPct,
              cutoffMeritNo: catData.stage1MeritNo,
              stage2Percentile: catData.stage2Percentile,
              stage2MeritNo: catData.stage2MeritNo,
              studentPercentile: pct,
              percentileDiff: parseFloat((pct - cutoffPct).toFixed(7)),
              chance,
              chanceLabel: getChanceLabel(chance)
            });
          }
        });
      });
    });

    // Sort: High > Medium > Low, then by percentile diff (closest first for High, descending for Medium/Low)
    predictions.sort((a, b) => {
      const chanceOrder = { High: 0, Medium: 1, Low: 2 };
      if (chanceOrder[a.chanceLabel] !== chanceOrder[b.chanceLabel]) {
        return chanceOrder[a.chanceLabel] - chanceOrder[b.chanceLabel];
      }
      // Within same chance level, sort by percentile diff descending (most margin first)
      return b.percentileDiff - a.percentileDiff;
    });

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIdx = (pageNum - 1) * limitNum;
    const endIdx = startIdx + limitNum;
    const paginatedResults = predictions.slice(startIdx, endIdx);

    // Summary stats
    const stats = {
      high: predictions.filter(p => p.chanceLabel === 'High').length,
      medium: predictions.filter(p => p.chanceLabel === 'Medium').length,
      low: predictions.filter(p => p.chanceLabel === 'Low').length
    };

    res.json({
      total: predictions.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(predictions.length / limitNum),
      stats,
      predictions: paginatedResults
    });

  } catch (err) {
    console.error('❌ Prediction error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Check if a seat block type matches the requested seat type.
 */
function matchesSeatType(seatBlockType, seatType) {
  const lower = seatBlockType.toLowerCase();
  switch (seatType.toUpperCase()) {
    case 'S':
      return lower.includes('state level') || lower.includes('all india');
    case 'H':
      return lower.includes('home university') && !lower.includes('other than home');
    case 'O':
      return lower.includes('other than home university');
    default:
      return true;
  }
}

/**
 * Calculate admission chance based on percentile difference.
 * @param {number} studentPct - Student's percentile
 * @param {number} cutoffPct - Cutoff percentile
 * @returns {number} 3=High, 2=Medium, 1=Low, 0=None
 */
function calculateChance(studentPct, cutoffPct) {
  const diff = studentPct - cutoffPct;
  if (diff >= 2) return 3;    // High chance — comfortably above cutoff
  if (diff >= 0) return 2;    // Medium chance — at or slightly above cutoff
  if (diff >= -2) return 1;   // Low chance — borderline, might get in later rounds
  return 0;                    // Not eligible
}

/**
 * Get human-readable label for chance level.
 */
function getChanceLabel(chance) {
  return { 3: 'High', 2: 'Medium', 1: 'Low', 0: 'None' }[chance] || 'None';
}

module.exports = router;
