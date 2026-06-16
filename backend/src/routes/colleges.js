/**
 * College & Branch Routes — Data listing endpoints
 * GET /api/colleges          — List all colleges
 * GET /api/colleges/branches — List all unique branch names
 * GET /api/colleges/types    — List all college types
 */

const express = require('express');
const router = express.Router();
const {
  getAllColleges,
  getUniqueBranches,
  getCollegeTypes
} = require('../services/firestoreService');

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
    const { roundId } = req.query;
    const branches = await getUniqueBranches(roundId);

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

module.exports = router;
