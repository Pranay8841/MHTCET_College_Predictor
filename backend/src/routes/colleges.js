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
  getCollegeTypes,
  getUniqueUniversities
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
 * GET /api/colleges/universities
 * List all unique home university names.
 */
router.get('/universities', async (req, res) => {
  try {
    const universities = await getUniqueUniversities();
    res.json({ universities });
  } catch (err) {
    console.error('❌ Error fetching universities:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/colleges/:collegeCode/details
 * Retrieve or dynamically scrape college details (fees, placement, NIRF).
 */
router.get('/:collegeCode/details', async (req, res) => {
  try {
    const { collegeCode } = req.params;
    const { collegeName, collegeType } = req.query;

    if (!collegeName) {
      return res.status(400).json({ error: 'Missing collegeName query param' });
    }

    const { getCollegeDetails } = require('../services/collegeScraperService');
    const details = await getCollegeDetails(collegeCode, collegeName, collegeType);

    res.json(details);
  } catch (err) {
    console.error('❌ Error fetching college details:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/colleges/:collegeCode/cutoffs
 * Get all branch cutoffs for a specific college in a given round/profile.
 * Returns both the selected round's cutoffs and structured multi-round comparison data.
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

    // 1. Fetch Year metadata for the selected round
    let yearValue = null;
    try {
      const { data: roundMeta, error: roundError } = await supabase
        .from('rounds_metadata')
        .select('year')
        .eq('round_id', roundId)
        .single();
      if (!roundError && roundMeta) {
        yearValue = roundMeta.year;
      }
    } catch (e) {
      console.warn('⚠️ Rounds metadata year fetch failed:', e.message);
    }

    if (!yearValue) {
      const yearMatch = roundId.match(/^(\d{4}(?:-\d{2,4})?)/);
      yearValue = yearMatch ? yearMatch[1] : null;
    }

    // 2. Query all ready rounds for that same year & exam stream
    let activeRounds = [];
    if (yearValue) {
      try {
        const { data: roundsMeta, error: roundsMetaError } = await supabase
          .from('rounds_metadata')
          .select('round_id, round_name, year, uploaded_at')
          .eq('year', yearValue)
          .eq('status', 'ready');

        if (!roundsMetaError && roundsMeta) {
          // Filter by exam stream
          activeRounds = roundsMeta.filter(r => {
            const idLower = r.round_id.toLowerCase();
            const isJosaaRound = idLower.includes('josaa');
            const isPharmaRound = idLower.includes('pharma');
            const isNursingRound = idLower.includes('nursing');
            const isAgricultureRound = idLower.includes('agriculture');
            
            if (examId === 'pharma') return isPharmaRound;
            if (examId === 'nursing') return isNursingRound;
            if (examId === 'agriculture') return isAgricultureRound;
            if (examId === 'josaa') return isJosaaRound;
            return !isJosaaRound && !isPharmaRound && !isNursingRound && !isAgricultureRound;
          });

          // Sort chronologically by uploaded_at
          activeRounds.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at));
        }
      } catch (e) {
        console.warn('⚠️ Rounds list fetch failed:', e.message);
      }
    }

    // Fallback if no rounds found
    if (activeRounds.length === 0) {
      activeRounds = [{ round_id: roundId, round_name: 'Selected Round', year: yearValue }];
    }

    const roundIds = activeRounds.map(r => r.round_id);

    // 3. Query cutoffs for all rounds
    const { data: dbRows, error: dbError } = await supabase
      .from('cutoffs')
      .select(`
        round_id,
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
      .in('round_id', roundIds)
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

    // 4. Populate selected round cutoffs (backward compatibility)
    const cutoffs = [];
    // 5. Populate multi-round cutoff details
    const multiRoundMap = {};

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

      // Selected round cutoff mapping
      if (row.round_id === roundId) {
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
      }

      // Multi-round cutoff mapping
      const key = `${row.branches.branch_code}_${row.seat_block_type}`;
      if (!multiRoundMap[key]) {
        multiRoundMap[key] = {
          branchCode: row.branches.branch_code,
          branchName: row.branches.branch_name,
          seatBlockType: row.seat_block_type,
          category: row.category_code,
          roundCutoffs: {}
        };
      }

      multiRoundMap[key].roundCutoffs[row.round_id] = {
        cutoffPercentile: row.stage1_percentile ? parseFloat(row.stage1_percentile) : null,
        cutoffMeritNo: row.stage1_merit_no,
        stage2Percentile: row.stage2_percentile ? parseFloat(row.stage2_percentile) : null,
        stage2MeritNo: row.stage2_merit_no,
        percentileDiff: margin,
        chance,
        chanceLabel: getChanceLabel(chance)
      };
    });

    // Sort single round cutoffs alphabetically by branch name
    cutoffs.sort((a, b) => a.branchName.localeCompare(b.branchName));

    // Convert multi-round map to array and sort alphabetically
    const multiRoundData = Object.values(multiRoundMap);
    multiRoundData.sort((a, b) => a.branchName.localeCompare(b.branchName));

    res.json({
      total: cutoffs.length,
      cutoffs,
      rounds: activeRounds.map(r => ({
        id: r.round_id,
        roundName: r.round_name,
        year: r.year
      })),
      multiRoundData
    });
  } catch (err) {
    console.error('❌ Error fetching college cutoffs:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
