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
      homeUniversity,
      roundId,
      branch,
      collegeType,
      examId = 'mhtcet',
      page = 1,
      limit = 20
    } = req.query;

    // Validation
    const isJosaa = examId === 'josaa';
    if (!category || !gender || !roundId || (isJosaa && !seatType) || (!isJosaa && !homeUniversity && !seatType)) {
      return res.status(400).json({
        error: `Missing required parameters: category, gender, roundId${isJosaa ? ', seatType' : ', homeUniversity'}`
      });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available. Check Supabase configuration.' });
    }

    let pct = null;
    let studentRank = null;
    const isRankSearch = isJosaa || (rank !== undefined && rank !== null && rank !== '');

    if (isRankSearch) {
      if (!rank) {
        return res.status(400).json({ error: 'rank is required for rank-based predictions' });
      }
      studentRank = parseInt(rank, 10);
      if (isNaN(studentRank) || studentRank <= 0) {
        return res.status(400).json({ error: 'rank must be a positive integer' });
      }
    } else {
      if (!percentile) {
        return res.status(400).json({ error: 'percentile is required for percentile-based predictions' });
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
      if (homeUniversity) {
        // Query S, H, and O suffixes combined
        const sCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), 'S');
        const hCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), 'H');
        const oCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), 'O');
        categoryCodes = Array.from(new Set([...sCodes, ...hCodes, ...oCodes]));
      } else {
        categoryCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), seatType.toUpperCase());
      }
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

    let dbRows = [];
    let pageOffset = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      let pageQuery = supabase
        .from('cutoffs')
        .select(selectString)
        .eq('exam_id', examId)
        .eq('round_id', roundId)
        .in('category_code', categoryCodes);

      if (isRankSearch) {
        if (isJosaa) {
          pageQuery = pageQuery
            .gte('stage2_merit_no', Math.floor(studentRank * 0.85))
            .not('stage2_merit_no', 'is', null);
        } else {
          pageQuery = pageQuery
            .gte('stage1_merit_no', Math.floor(studentRank * 0.85))
            .not('stage1_merit_no', 'is', null);
        }
      } else {
        pageQuery = pageQuery
          .lte('stage1_percentile', pct + 2.0)
          .not('stage1_percentile', 'is', null);
      }

      if (branch && branch !== 'all') {
        pageQuery = pageQuery.eq('branches.branch_name', branch);
      }
      if (collegeType && collegeType !== 'all') {
        pageQuery = pageQuery.ilike('colleges.college_type', `%${collegeType}%`);
      }

      const { data: pageRows, error: dbError } = await pageQuery
        .range(pageOffset, pageOffset + PAGE_SIZE - 1);

      if (dbError) {
        throw dbError;
      }

      dbRows = dbRows.concat(pageRows);
      if (pageRows.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        pageOffset += PAGE_SIZE;
      }
    }

    const predictions = [];

    // 2. Map results and calculate admission chances
    dbRows.forEach(row => {
      // Filter seat blocks dynamically
      let blockMatches = false;

      if (isJosaa) {
        blockMatches = row.seat_block_type.toUpperCase() === seatType.toUpperCase();
      } else if (homeUniversity) {
        const blockType = row.seat_block_type;
        const collegeHU = row.colleges.home_university;

        const isOMS = homeUniversity.toLowerCase().includes('outside maharashtra') || 
                      homeUniversity.toLowerCase().includes('oms') || 
                      homeUniversity.toLowerCase().includes('other');

        const isGovernmentOrAided = !row.colleges.college_type || 
          !row.colleges.college_type.toLowerCase().includes('un-aided');

        if (blockType === 'State Level' || blockType === 'All India Seats') {
          if (isOMS) {
            blockMatches = false;
          } else {
            blockMatches = true;
          }
        } else if (isOMS) {
          blockMatches = false;
        } else {
          const isMatch = isHomeUniversityMatch(collegeHU, homeUniversity);
          if (isMatch) {
            blockMatches = blockType === 'Home University Seats Allotted to Home University Candidates';
          } else {
            blockMatches = blockType === 'Home University Seats Allotted to Other Than Home University Candidates' ||
                           blockType === 'Other Than Home University Seats Allotted to Other Than Home University Candidates';
          }
        }
      } else {
        blockMatches = matchesSeatType(row.seat_block_type, seatType, examId);
      }

      if (!blockMatches) return;

      let chance = 0;
      let margin = 0;

      if (isRankSearch) {
        if (isJosaa) {
          const cutoffRank = parseInt(row.stage2_merit_no, 10);
          chance = calculateJosaaChance(studentRank, cutoffRank);
          margin = cutoffRank - studentRank;
        } else {
          const cutoffRank = parseInt(row.stage1_merit_no, 10);
          chance = calculateJosaaChance(studentRank, cutoffRank);
          margin = cutoffRank - studentRank;
        }
      } else {
        const cutoffPct = parseFloat(row.stage1_percentile);
        chance = calculateChance(pct, cutoffPct);
        margin = parseFloat((pct - cutoffPct).toFixed(7));
      }

      if (chance > 0) {
        predictions.push({
          examId,
          collegeCode: row.colleges.college_code,
          collegeName: row.colleges.college_name,
          collegeType: row.colleges.college_type,
          homeUniversity: row.colleges.home_university,
          branchCode: row.branches.branch_code,
          branchName: row.branches.branch_name,
          seatBlockType: row.seat_block_type,
          category: row.category_code,
          cutoffPercentile: row.stage1_percentile ? parseFloat(row.stage1_percentile) : null,
          cutoffMeritNo: row.stage1_merit_no, // Opening Rank for JoSAA, merit rank for MHTCET
          stage2Percentile: row.stage2_percentile ? parseFloat(row.stage2_percentile) : null,
          stage2MeritNo: row.stage2_merit_no, // Closing Rank for JoSAA
          studentPercentile: pct,
          studentRank: studentRank,
          percentileDiff: margin, // Stores rank/percentile margin
          chance,
          chanceLabel: getChanceLabel(chance)
        });
      }
    });

    // Sort: Low > Medium > High, then by difference/margin ascending
    predictions.sort((a, b) => {
      const chanceOrder = { Low: 0, Medium: 1, High: 2 };
      if (chanceOrder[a.chanceLabel] !== chanceOrder[b.chanceLabel]) {
        return chanceOrder[a.chanceLabel] - chanceOrder[b.chanceLabel];
      }
      // Within same chance level, sort by percentile diff ascending (worse first)
      return a.percentileDiff - b.percentileDiff;
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
 * Helper to normalize and match Home University names to handle spelling differences.
 */
function isHomeUniversityMatch(univA, univB) {
  if (!univA || !univB) return false;
  
  const normalize = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/university/g, '')
      .replace(/univ/g, '')
      .replace(/institutes/g, '')
      .replace(/institute/g, '')
      .trim();
  };

  const normA = normalize(univA);
  const normB = normalize(univB);

  return normA.includes(normB) || normB.includes(normA);
}

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
