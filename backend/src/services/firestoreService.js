/**
 * Firestore Service — Data persistence for cutoff data
 * Handles batch writes of parsed PDF data to Firestore collections.
 */

const { db } = require('../firebaseAdmin');

const BATCH_SIZE = 400; // Firestore batch limit is 500, use 400 for safety

/**
 * Save parsed cutoff data to Firestore in batches.
 * Creates documents in /colleges and /cutoffs collections.
 * 
 * @param {Array} parsedData - Array of parsed branch entries from pdfParser
 * @param {string} roundId - Round identifier (e.g., "2024-25_CAP_Round_I")
 * @param {string} year - Academic year (e.g., "2024-25")
 * @returns {{ totalColleges: number, totalBranches: number }}
 */
async function saveCutoffsToFirestore(parsedData, roundId, year) {
  if (!db) {
    throw new Error('Firestore is not initialized. Check Firebase credentials.');
  }

  let batch = db.batch();
  let opCount = 0;
  let totalCommits = 0;
  const colleges = new Set();
  const branches = new Set();

  console.log(`📝 Saving ${parsedData.length} entries to Firestore...`);

  for (const entry of parsedData) {
    colleges.add(entry.collegeCode);
    branches.add(entry.branchCode);

    // --- Save/Update College Document ---
    const collegeRef = db.collection('colleges').doc(entry.collegeCode);
    batch.set(collegeRef, {
      collegeCode: entry.collegeCode,
      collegeName: entry.collegeName,
      collegeType: entry.collegeType,
      homeUniversity: entry.homeUniversity,
      updatedAt: new Date()
    }, { merge: true });
    opCount++;

    // --- Save Cutoff Document ---
    const docId = `${roundId}_${entry.collegeCode}_${entry.branchCode}`;
    const cutoffRef = db.collection('cutoffs').doc(docId);
    batch.set(cutoffRef, {
      roundId,
      year,
      collegeCode: entry.collegeCode,
      collegeName: entry.collegeName,
      collegeType: entry.collegeType,
      homeUniversity: entry.homeUniversity,
      branchCode: entry.branchCode,
      branchName: entry.branchName,
      seatBlocks: entry.seatBlocks,
      updatedAt: new Date()
    });
    opCount++;

    // Commit batch if approaching limit
    if (opCount >= BATCH_SIZE) {
      await batch.commit();
      totalCommits++;
      console.log(`   Batch ${totalCommits} committed (${opCount} ops)`);
      batch = db.batch();
      opCount = 0;
    }
  }

  // Commit remaining operations
  if (opCount > 0) {
    await batch.commit();
    totalCommits++;
    console.log(`   Final batch ${totalCommits} committed (${opCount} ops)`);
  }

  const result = {
    totalColleges: colleges.size,
    totalBranches: parsedData.length
  };

  console.log(`✅ Firestore save complete: ${result.totalColleges} colleges, ${result.totalBranches} branches across ${totalCommits} batches`);
  return result;
}

/**
 * Get all unique branch names from the cutoffs collection.
 * @param {string} roundId - Optional round filter
 * @returns {string[]} Array of unique branch names
 */
async function getUniqueBranches(roundId) {
  if (!db) return [];

  let query = db.collection('cutoffs');
  if (roundId) {
    query = query.where('roundId', '==', roundId);
  }

  const snapshot = await query.select('branchName').get();
  const branches = new Set();
  snapshot.forEach(doc => branches.add(doc.data().branchName));

  return [...branches].sort();
}

/**
 * Get all colleges from the colleges collection.
 * @returns {Array} Array of college objects
 */
async function getAllColleges() {
  if (!db) return [];

  const snapshot = await db.collection('colleges').orderBy('collegeName').get();
  const colleges = [];
  snapshot.forEach(doc => colleges.push(doc.data()));
  return colleges;
}

/**
 * Get all unique college types.
 * @returns {string[]} Array of unique college types
 */
async function getCollegeTypes() {
  if (!db) return [];

  const snapshot = await db.collection('colleges').select('collegeType').get();
  const types = new Set();
  snapshot.forEach(doc => {
    if (doc.data().collegeType) types.add(doc.data().collegeType);
  });
  return [...types].sort();
}

/**
 * Get rounds metadata.
 * @returns {Object} Rounds data
 */
async function getRoundsMetadata() {
  if (!db) return {};

  const doc = await db.collection('metadata').doc('rounds').get();
  return doc.exists ? doc.data() : {};
}

module.exports = {
  saveCutoffsToFirestore,
  getUniqueBranches,
  getAllColleges,
  getCollegeTypes,
  getRoundsMetadata
};
