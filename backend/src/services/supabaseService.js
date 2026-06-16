const { supabase } = require('../supabaseClient');

/**
 * Save parsed cutoff data to Supabase.
 * In Postgres, we store this in a flat format for high-speed indexing and querying.
 * 
 * @param {Array} parsedData - Array of parsed branch entries from pdfParser
 * @param {string} roundId - Round identifier (e.g., "2024-25_CAP_Round_I")
 * @param {string} year - Academic year (e.g., "2024-25")
 * @param {string} examId - Exam identifier (default: "mhtcet")
 * @returns {Promise<{ totalColleges: number, totalBranches: number }>}
 */
async function saveCutoffsToSupabase(parsedData, roundId, year, examId = 'mhtcet') {
  if (!supabase) {
    throw new Error('Supabase client is not initialized.');
  }

  console.log(`🚀 Starting migration of ${parsedData.length} entries to Supabase for round "${roundId}"...`);

  // 1. Prepare unique colleges, branches, and cutoffs to prevent duplicate rows in the same batch upsert
  const collegeMap = new Map();
  const branchMap = new Map();
  const cutoffMap = new Map();

  parsedData.forEach(entry => {
    // Collect unique colleges
    collegeMap.set(entry.collegeCode, {
      college_code: entry.collegeCode,
      college_name: entry.collegeName,
      college_type: entry.collegeType || null,
      home_university: entry.homeUniversity || null,
      updated_at: new Date().toISOString()
    });

    // Collect unique branches
    branchMap.set(entry.branchCode, {
      branch_code: entry.branchCode,
      branch_name: entry.branchName
    });

    // Flatten cutoff records for the cutoffs table
    if (entry.seatBlocks) {
      entry.seatBlocks.forEach(block => {
        if (block.categories) {
          Object.entries(block.categories).forEach(([catCode, catData]) => {
            // Unique key to prevent duplicates in Javascript before sending to Postgres
            const uniqueKey = `${examId}_${roundId}_${entry.collegeCode}_${entry.branchCode}_${block.seatBlockType}_${catCode}`;
            cutoffMap.set(uniqueKey, {
              exam_id: examId,
              round_id: roundId,
              year: year,
              college_code: entry.collegeCode,
              branch_code: entry.branchCode,
              seat_block_type: block.seatBlockType,
              category_code: catCode,
              stage1_merit_no: catData.stage1MeritNo || null,
              stage1_percentile: catData.stage1Percentile !== null && catData.stage1Percentile !== undefined 
                ? parseFloat(catData.stage1Percentile) 
                : null,
              stage2_merit_no: catData.stage2MeritNo || null,
              stage2_percentile: catData.stage2Percentile !== null && catData.stage2Percentile !== undefined 
                ? parseFloat(catData.stage2Percentile) 
                : null,
              updated_at: new Date().toISOString()
            });
          });
        }
      });
    }
  });

  const collegesList = Array.from(collegeMap.values());
  const branchesList = Array.from(branchMap.values());
  const cutoffRecords = Array.from(cutoffMap.values());

  // 2. Upsert Colleges in batches of 200
  console.log(`   Upserting ${collegesList.length} colleges...`);
  const collegeChunks = chunkArray(collegesList, 200);
  for (const chunk of collegeChunks) {
    const { error } = await supabase
      .from('colleges')
      .upsert(chunk, { onConflict: 'college_code' });
    if (error) throw new Error(`Colleges upsert failed: ${error.message}`);
  }

  // 3. Upsert Branches in batches of 200
  console.log(`   Upserting ${branchesList.length} branches...`);
  const branchChunks = chunkArray(branchesList, 200);
  for (const chunk of branchChunks) {
    const { error } = await supabase
      .from('branches')
      .upsert(chunk, { onConflict: 'branch_code' });
    if (error) throw new Error(`Branches upsert failed: ${error.message}`);
  }

  // 4. Upsert Cutoffs in batches of 1000 to prevent hitting payload/parameter limits
  console.log(`   Upserting ${cutoffRecords.length} flat cutoff rows...`);
  const cutoffChunks = chunkArray(cutoffRecords, 1000);
  let processedCount = 0;
  for (const chunk of cutoffChunks) {
    const { error } = await supabase
      .from('cutoffs')
      .upsert(chunk, { onConflict: 'exam_id,round_id,college_code,branch_code,seat_block_type,category_code' });
    if (error) throw new Error(`Cutoffs upsert failed at batch starting at ${processedCount}: ${error.message}`);
    processedCount += chunk.length;
  }

  console.log(`✅ Supabase migration complete. Loaded ${collegesList.length} colleges, ${branchesList.length} branches, and ${cutoffRecords.length} cutoffs.`);
  return {
    totalColleges: collegesList.length,
    totalBranches: parsedData.length
  };
}

/**
 * Get all unique branch names.
 */
async function getUniqueBranches(roundId, examId = 'mhtcet') {
  if (!supabase) return [];

  // Query branches directly from the branches table
  // This is highly efficient and covers all branches loaded in the database
  const { data, error } = await supabase
    .from('branches')
    .select('branch_name')
    .order('branch_name');

  if (error) {
    console.error('❌ Supabase error fetching branches:', error);
    return [];
  }

  // Deduplicate and return
  const names = new Set(data.map(b => b.branch_name));
  return Array.from(names);
}

/**
 * Get all colleges.
 */
async function getAllColleges() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('colleges')
    .select('*')
    .order('college_name');

  if (error) {
    console.error('❌ Supabase error fetching colleges:', error);
    return [];
  }

  return data.map(c => ({
    collegeCode: c.college_code,
    collegeName: c.college_name,
    collegeType: c.college_type,
    homeUniversity: c.home_university
  }));
}

/**
 * Get unique college types.
 */
async function getCollegeTypes() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('colleges')
    .select('college_type');

  if (error) {
    console.error('❌ Supabase error fetching college types:', error);
    return [];
  }

  const types = new Set();
  data.forEach(d => {
    if (d.college_type) types.add(d.college_type);
  });
  return Array.from(types).sort();
}

/**
 * Get rounds metadata.
 */
async function getRoundsMetadata() {
  if (!supabase) return {};

  const { data, error } = await supabase
    .from('rounds_metadata')
    .select('*');

  if (error) {
    console.error('❌ Supabase error fetching rounds metadata:', error);
    return {};
  }

  const result = {};
  data.forEach(r => {
    result[r.round_id] = {
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
  return result;
}

/**
 * Helper to split array into chunks.
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

module.exports = {
  saveCutoffsToSupabase,
  getUniqueBranches,
  getAllColleges,
  getCollegeTypes,
  getRoundsMetadata
};
