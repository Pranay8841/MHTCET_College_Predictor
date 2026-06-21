/**
 * College & Branch Routes — Data listing endpoints
 * GET /api/colleges          — List all colleges
 * GET /api/colleges/branches — List all unique branch names
 * GET /api/colleges/types    — List all college types
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const {
  getAllColleges,
  getUniqueBranches,
  getCollegeTypes
} = require('../services/supabaseService');

/**
 * GET /api/colleges
 * List all colleges with optional search.
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    let colleges = await getAllColleges();

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      colleges = colleges.filter(c =>
        c.collegeName.toLowerCase().includes(searchLower) ||
        c.collegeCode.includes(search)
      );
    }

    res.json({
      total: colleges.length,
      colleges
    });
  } catch (err) {
    console.error('❌ Error fetching colleges:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/colleges/branches
 * List all unique branch names (for dropdown population).
 */
router.get('/branches', async (req, res) => {
  try {
    const { roundId, examId } = req.query;
    const branches = await getUniqueBranches(roundId, examId);

    res.json({
      total: branches.length,
      branches
    });
  } catch (err) {
    console.error('❌ Error fetching branches:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/colleges/types
 * List all unique college types.
 */
router.get('/types', async (req, res) => {
  try {
    const types = await getCollegeTypes();
    res.json({ types });
  } catch (err) {
    console.error('❌ Error fetching college types:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/colleges/:collegeCode/cutoffs
 * Get all branch cutoffs for a specific college in a given round/profile.
 */
router.get('/:collegeCode/cutoffs', async (req, res) => {
  try {
    const { collegeCode } = req.params;
    const {
      roundId,
      examId = 'mhtcet',
      category,
      gender,
      seatType,
      percentile,
      rank
    } = req.query;

    if (!roundId || !category || !gender || !seatType) {
      return res.status(400).json({ error: 'Missing roundId, category, gender, or seatType' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const isJosaa = examId === 'josaa';
    
    // Parse student score/rank parameters for calculations
    let pct = null;
    let studentRank = null;
    if (rank !== undefined && rank !== null && rank !== '') {
      studentRank = parseInt(rank, 10);
    }
    if (percentile !== undefined && percentile !== null && percentile !== '') {
      pct = parseFloat(percentile);
    }

    // Build category codes
    let categoryCodes = [];
    if (isJosaa) {
      const genderPrefixes = gender.toUpperCase() === 'L' ? ['G', 'L'] : ['G'];
      genderPrefixes.forEach(prefix => {
        categoryCodes.push(`${prefix}-${category.toUpperCase()}`);
      });
    } else {
      const { buildCategoryCodes } = require('../utils/categoryDecoder');
      categoryCodes = buildCategoryCodes(gender.toUpperCase(), category.toUpperCase(), seatType.toUpperCase());
    }

    const { data: dbRows, error: dbError } = await supabase
      .from('cutoffs')
      .select(`
        stage1_merit_no,
        stage1_percentile,
        stage2_merit_no,
        stage2_percentile,
        seat_block_type,
        category_code,
        branches!inner(branch_code, branch_name)
      `)
      .eq('college_code', collegeCode)
      .eq('exam_id', examId)
      .eq('round_id', roundId)
      .in('category_code', categoryCodes);

    if (dbError) throw dbError;

    // Helper functions for chance and match calculations
    const matchesSeatType = (seatBlockType, sType, eId) => {
      if (eId === 'josaa') return seatBlockType.toUpperCase() === sType.toUpperCase();
      const lower = seatBlockType.toLowerCase();
      switch (sType.toUpperCase()) {
        case 'S': return lower.includes('state level') || lower.includes('all india');
        case 'H': return lower.includes('home university') && !lower.includes('other than home');
        case 'O': return lower.includes('other than home university');
        default: return true;
      }
    };

    const calculateJosaaChance = (sRank, cRank) => {
      if (!sRank || !cRank) return 0;
      if (sRank <= Math.floor(cRank * 0.95)) return 3;
      if (sRank <= cRank) return 2;
      if (sRank <= Math.ceil(cRank * 1.15)) return 1;
      return 0;
    };

    const calculateChance = (sPct, cPct) => {
      if (sPct === null || cPct === null) return 0;
      const diff = sPct - cPct;
      if (diff >= 2) return 3;
      if (diff >= 0) return 2;
      if (diff >= -2) return 1;
      return 0;
    };

    const getChanceLabel = (chance) => {
      return { 3: 'High', 2: 'Medium', 1: 'Low', 0: 'None' }[chance] || 'None';
    };

    const cutoffs = [];
    dbRows.forEach(row => {
      if (!matchesSeatType(row.seat_block_type, seatType, examId)) return;

      let chance = 0;
      let margin = 0;
      const isRankSearch = isJosaa || (studentRank !== null);

      if (isRankSearch) {
        if (isJosaa) {
          const cutoffRank = parseInt(row.stage2_merit_no, 10);
          chance = calculateJosaaChance(studentRank, cutoffRank);
          margin = cutoffRank && studentRank ? cutoffRank - studentRank : 0;
        } else {
          const cutoffRank = parseInt(row.stage1_merit_no, 10);
          chance = calculateJosaaChance(studentRank, cutoffRank);
          margin = cutoffRank && studentRank ? cutoffRank - studentRank : 0;
        }
      } else {
        const cutoffPct = parseFloat(row.stage1_percentile);
        chance = calculateChance(pct, cutoffPct);
        margin = pct !== null && !isNaN(cutoffPct) ? parseFloat((pct - cutoffPct).toFixed(7)) : 0;
      }

      cutoffs.push({
        branchCode: row.branches.branch_code,
        branchName: row.branches.branch_name,
        seatBlockType: row.seat_block_type,
        category: row.category_code,
        cutoffPercentile: row.stage1_percentile ? parseFloat(row.stage1_percentile) : null,
        cutoffMeritNo: row.stage1_merit_no,
        stage2Percentile: row.stage2_percentile ? parseFloat(row.stage2_percentile) : null,
        stage2MeritNo: row.stage2_merit_no,
        percentileDiff: margin,
        chance,
        chanceLabel: getChanceLabel(chance)
      });
    });

    // Sort by branch name alphabetically
    cutoffs.sort((a, b) => a.branchName.localeCompare(b.branchName));

    res.json({
      total: cutoffs.length,
      cutoffs
    });
  } catch (err) {
    console.error('❌ Error fetching college cutoffs:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
