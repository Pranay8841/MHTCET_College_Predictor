/**
 * Prediction Routes — Student College Prediction
 * GET /api/predict — Query cutoffs and calculate admission chances
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
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

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available. Check Supabase configuration.' });
    }

    // Build target category codes to check
    const categoryCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), seatType.toUpperCase());

    // 1. Build the base Supabase query
    // Use !inner joins to enforce that we only return results when college and branch associations exist
    let selectString = `
      id,
      round_id,
      year,
      seat_block_type,
      category_code,
      stage1_merit_no,
      stage1_percentile,
      stage2_merit_no,
      stage2_percentile,
      colleges!inner(college_code, college_name, college_type, home_university),
      branches!inner(branch_code, branch_name)
    `;

    let query = supabase
      .from('cutoffs')
      .select(selectString)
      .eq('round_id', roundId)
      .in('category_code', categoryCodes)
      .lte('stage1_percentile', pct + 2.0) // Database-side filtering for High/Medium/Low chance (Margin >= -2.0)
      .not('stage1_percentile', 'is', null);

    // Filter by branch name in SQL if specified
    if (branch && branch !== 'all') {
      query = query.eq('branches.branch_name', branch);
    }

    // Filter by college type in SQL if specified
    if (collegeType && collegeType !== 'all') {
      query = query.ilike('colleges.college_type', `%${collegeType}%`);
    }

    const { data: dbRows, error: dbError } = await query;

    if (dbError) {
      throw dbError;
    }

    const predictions = [];

    // 2. Map results and calculate admission chances
    dbRows.forEach(row => {
      // Filter seat blocks by seat type
      const blockMatchesSeatType = matchesSeatType(row.seat_block_type, seatType);
      if (!blockMatchesSeatType) return;

      const cutoffPct = parseFloat(row.stage1_percentile);
      const chance = calculateChance(pct, cutoffPct);

      if (chance > 0) {
        predictions.push({
          collegeCode: row.colleges.college_code,
          collegeName: row.colleges.college_name,
          collegeType: row.colleges.college_type,
          homeUniversity: row.colleges.home_university,
          branchCode: row.branches.branch_code,
          branchName: row.branches.branch_name,
          seatBlockType: row.seat_block_type,
          category: row.category_code,
          cutoffPercentile: cutoffPct,
          cutoffMeritNo: row.stage1_merit_no,
          stage2Percentile: row.stage2_percentile ? parseFloat(row.stage2_percentile) : null,
          stage2MeritNo: row.stage2_merit_no,
          studentPercentile: pct,
          percentileDiff: parseFloat((pct - cutoffPct).toFixed(7)),
          chance,
          chanceLabel: getChanceLabel(chance)
        });
      }
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
