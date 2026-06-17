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
      rank,
      category,
      gender,
      seatType, // Maps to Quota (e.g. 'AI', 'HS') for JoSAA
      roundId,
      branch,
      collegeType,
      examId = 'mhtcet',
      page = 1,
      limit = 20
    } = req.query;

    // Validation
    if (!category || !gender || !seatType || !roundId) {
      return res.status(400).json({
        error: 'Missing required parameters: category, gender, seatType, roundId'
      });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available. Check Supabase configuration.' });
    }

    let pct = null;
    let studentRank = null;
    const isJosaa = examId === 'josaa';

    if (isJosaa) {
      if (!rank) {
        return res.status(400).json({ error: 'rank is required for JoSAA predictions' });
      }
      studentRank = parseInt(rank, 10);
      if (isNaN(studentRank) || studentRank <= 0) {
        return res.status(400).json({ error: 'rank must be a positive integer' });
      }
    } else {
      if (!percentile) {
        return res.status(400).json({ error: 'percentile is required for MHT-CET predictions' });
      }
      pct = parseFloat(percentile);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ error: 'percentile must be a number between 0 and 100' });
      }
    }

    // Build target category codes to check
    let categoryCodes = [];
    if (isJosaa) {
      // JoSAA format: e.g. G-OPEN, L-OBC-NCL, G-OBC-NCL (PwD)
      // Only match the exact category selected — do NOT add OPEN fallback.
      // In JoSAA, each category (especially PwD) has its own separate seat pool.
      const genderPrefixes = gender.toUpperCase() === 'L' ? ['G', 'L'] : ['G'];
      genderPrefixes.forEach(prefix => {
        categoryCodes.push(`${prefix}-${category.toUpperCase()}`);
      });
    } else {
      // MHT-CET format
      categoryCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), seatType.toUpperCase());
    }

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
      .eq('exam_id', examId)
      .eq('round_id', roundId)
      .in('category_code', categoryCodes);

    if (isJosaa) {
      // For JoSAA, query where closing rank (stage2_merit_no) is >= 85% of student rank (15% better)
      query = query
        .gte('stage2_merit_no', Math.floor(studentRank * 0.85))
        .not('stage2_merit_no', 'is', null);
    } else {
      // For MHT-CET, query where cutoff percentile is <= student's percentile + 2.0
      query = query
        .lte('stage1_percentile', pct + 2.0)
        .not('stage1_percentile', 'is', null);
    }

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
      const blockMatchesSeatType = matchesSeatType(row.seat_block_type, seatType, examId);
      if (!blockMatchesSeatType) return;

      let chance = 0;
      let margin = 0;

      if (isJosaa) {
        const cutoffRank = parseInt(row.stage2_merit_no, 10);
        chance = calculateJosaaChance(studentRank, cutoffRank);
        margin = cutoffRank - studentRank;
      } else {
        const cutoffPct = parseFloat(row.stage1_percentile);
        chance = calculateChance(pct, cutoffPct);
        margin = parseFloat((pct - cutoffPct).toFixed(7));
      }

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
          cutoffPercentile: isJosaa ? null : parseFloat(row.stage1_percentile),
          cutoffMeritNo: row.stage1_merit_no, // Opening Rank for JoSAA, merit rank for MHTCET
          stage2Percentile: row.stage2_percentile ? parseFloat(row.stage2_percentile) : null,
          stage2MeritNo: row.stage2_merit_no, // Closing Rank for JoSAA
          studentPercentile: pct,
          studentRank: studentRank,
          percentileDiff: margin, // Stores rank difference for JoSAA, percentile difference for MHTCET
          chance,
          chanceLabel: getChanceLabel(chance)
        });
      }
    });

    // Sort: High > Medium > Low, then by difference/margin descending
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
function matchesSeatType(seatBlockType, seatType, examId) {
  if (examId === 'josaa') {
    return seatBlockType.toUpperCase() === seatType.toUpperCase();
  }
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
 * Calculate JoSAA admission chance based on rank.
 * @param {number} studentRank - Student's rank
 * @param {number} closingRank - Cutoff closing rank
 * @returns {number} 3=High, 2=Medium, 1=Low, 0=None
 */
function calculateJosaaChance(studentRank, closingRank) {
  if (studentRank <= Math.floor(closingRank * 0.95)) return 3; // High
  if (studentRank <= closingRank) return 2;                    // Medium
  if (studentRank <= Math.ceil(closingRank * 1.15)) return 1;  // Low
  return 0;                                                    // None
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
