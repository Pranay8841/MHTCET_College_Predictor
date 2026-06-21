/**
 * PDF Parser for MHTCET CAP Round Cutoff PDFs
 * 
 * Parses the structured cutoff data from Maharashtra State CET Cell PDFs.
 * 
 * ACTUAL PDF TEXT FORMAT (from pdf-parse):
 * - Category headers are concatenated without spaces: "GOPENSGSCSGSTSGVJSGNT1S..."
 * - Merit numbers and percentiles are each on their OWN line (not space-separated)
 * - "Status:" is on one line, the value on the next
 * - "Stage" appears alone at end of data block (not "Stage GOPENS GSCS...")
 * - Category header may wrap across multiple lines
 */

const pdfParse = require('pdf-parse');

// All known category codes for splitting concatenated headers
const KNOWN_CATEGORIES = [
  'PWDROBC', 'PWDRSCS', 'PWDRNT1', 'PWDRNT2', 'PWDRNT3', 'PWDRVJ', 'PWDRST',
  'DEFROBC', 'DEFRSCS', 'DEFRNT1', 'DEFRNT2', 'DEFRNT3', 'DEFRVJ', 'DEFRST', 'DEFRSEBC',
  'PWDOPEN', 'PWDSC', 'PWDST', 'PWDVJ', 'PWDNT1', 'PWDNT2', 'PWDNT3', 'PWDOBC', 'PWDSEBC',
  'DEFOPEN', 'DEFSC', 'DEFST', 'DEFVJ', 'DEFNT1', 'DEFNT2', 'DEFNT3', 'DEFOBC', 'DEFSEBC',
  'GOPEN', 'GSC', 'GST', 'GVJ', 'GNT1', 'GNT2', 'GNT3', 'GOBC', 'GSEBC',
  'LOPEN', 'LSC', 'LST', 'LVJ', 'LNT1', 'LNT2', 'LNT3', 'LOBC', 'LSEBC',
  'ORPHAN', 'TFW', 'EWS',
  'MI'
];

// Build category codes with suffixes (S, H, O) for matching
function buildAllCategoryCodes() {
  const codes = new Set();
  for (const base of KNOWN_CATEGORIES) {
    codes.add(base + 'S');
    codes.add(base + 'H');
    codes.add(base + 'O');
    codes.add(base); // some like EWS, ORPHAN may appear without suffix
  }
  // Also add codes that appear without standard suffix
  codes.add('EWS');
  codes.add('ORPHAN');
  codes.add('TFWS');
  codes.add('TFWH');
  codes.add('TFWO');
  return codes;
}

const ALL_CATEGORY_CODES = buildAllCategoryCodes();

/**
 * Split a concatenated category string like "GOPENSGSCSGSTSGVJSGNT1S..."
 * into individual codes: ["GOPENS", "GSCS", "GSTS", "GVJS", "GNT1S", ...]
 */
function splitCategoryHeaders(concatenated) {
  const result = [];
  let remaining = concatenated;

  while (remaining.length > 0) {
    let found = false;

    // Try longest match first (greedy) — sort candidates by length descending
    const candidates = [...ALL_CATEGORY_CODES]
      .filter(code => remaining.startsWith(code))
      .sort((a, b) => b.length - a.length);

    if (candidates.length > 0) {
      result.push(candidates[0]);
      remaining = remaining.slice(candidates[0].length);
      found = true;
    }

    if (!found) {
      // Skip one character and try again (handles garbage)
      remaining = remaining.slice(1);
    }
  }

  return result;
}

/**
 * Parse a CAP Round cutoff PDF buffer and extract all structured data.
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Array} Array of parsed branch entries with cutoff data
 */
async function parseCutoffPDF(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  const lines = data.text.split('\n');

  const results = [];
  let currentCollege = null;
  let currentBranch = null;
  let currentSeatBlock = null;
  let categoryHeaders = [];
  let collectingMeritData = false;
  let meritValues = [];  // [{merit, percentile}, ...]

  // --- Regex Patterns ---
  const COLLEGE_REGEX = /^(\d{5})\s*-\s*(.+)$/;
  const BRANCH_REGEX = /^(\d{10})\s*-\s*(.+)$/;

  const SEAT_BLOCK_KEYWORDS = [
    'Home University Seats Allotted to Other Than Home University Candidates',
    'Other Than Home University Seats Allotted to Other Than Home University Candidates',
    'Home University Seats Allotted to Home University Candidates',
    'All India Seats',
    'State Level'
  ];

  // Lines to skip
  const SKIP_PATTERNS = [
    /^D$/,
    /^i$/,
    /^r$/,
    /^State Common Entrance Test Cell/,
    /^Cut Off List/,
    /^Degree Courses/,
    /^Government of Maharashtra/,
    /^Legends:/,
    /^Maharashtra State Seats/,
    /^Page\s+\d+/,
    /^--+$/,
    /^Figures in bracket/,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip known header/footer lines
    if (SKIP_PATTERNS.some(p => p.test(line))) continue;

    // --- Detect College (5-digit code) ---
    const collegeMatch = line.match(COLLEGE_REGEX);
    if (collegeMatch) {
      // Finalize previous branch
      finalizeBranch(results, currentCollege, currentBranch, currentSeatBlock, categoryHeaders, meritValues);

      currentCollege = {
        collegeCode: collegeMatch[1],
        collegeName: collegeMatch[2].trim()
      };
      currentBranch = null;
      currentSeatBlock = null;
      categoryHeaders = [];
      meritValues = [];
      collectingMeritData = false;
      continue;
    }

    // --- Detect Branch (10-digit code) ---
    const branchMatch = line.match(BRANCH_REGEX);
    if (branchMatch) {
      // Finalize previous branch
      finalizeBranch(results, currentCollege, currentBranch, currentSeatBlock, categoryHeaders, meritValues);

      currentBranch = {
        branchCode: branchMatch[1],
        branchName: branchMatch[2].trim(),
        collegeType: '',
        homeUniversity: '',
        seatBlocks: []
      };
      currentSeatBlock = null;
      categoryHeaders = [];
      meritValues = [];
      collectingMeritData = false;
      continue;
    }

    // --- Detect Status line ---
    if (line === 'Status:' && currentBranch) {
      // Next line has the actual status+university info
      const nextLine = (lines[i + 1] || '').trim();
      // Format: "Government Autonomous Home University : Autonomous Institute"
      const huMatch = nextLine.match(/^(.+?)\s*Home\s*University\s*:\s*(.+)$/i);
      if (huMatch) {
        currentBranch.collegeType = huMatch[1].trim();
        currentBranch.homeUniversity = huMatch[2].trim();
      } else {
        // If there's no "Home University :" separator, the entire next line is the status / college type
        currentBranch.collegeType = nextLine;
        currentBranch.homeUniversity = 'State Level';
      }
      i++; // skip the next line since we consumed it
      continue;
    }

    // --- Detect Seat Block ---
    const seatBlockType = SEAT_BLOCK_KEYWORDS.find(kw => line.includes(kw));
    if (seatBlockType && currentBranch) {
      // Save previous seat block data
      if (currentSeatBlock && categoryHeaders.length > 0) {
        assignMeritToCategories(currentSeatBlock, categoryHeaders, meritValues);
      }
      currentSeatBlock = { seatBlockType, categories: {} };
      currentBranch.seatBlocks.push(currentSeatBlock);
      categoryHeaders = [];
      meritValues = [];
      collectingMeritData = false;
      continue;
    }

    // --- Detect Stage marker "  I" or "  II" (merit data start) ---
    // Must check BEFORE category header detection since "I" is all uppercase
    if (currentSeatBlock && /^\s*(I|II)\s*$/.test(line)) {
      collectingMeritData = true;
      // Save previous block data if this is stage II
      if (line.trim() === 'II' && meritValues.length > 0) {
        assignMeritToCategories(currentSeatBlock, categoryHeaders, meritValues, 'I');
        meritValues = [];
      }
      continue;
    }

    // --- Detect concatenated category header ---
    // It looks like: "GOPENSGSCSGSTSGVJSGNT1SGNT2SGNT3SGOBCSGSEBCSLOPENSLSCSLSTSLVJSLNT2SLOBCSLSEBCS..."
    // It starts with a known category prefix and is all uppercase letters and digits
    if (currentSeatBlock && !collectingMeritData && /^[A-Z0-9]{6,}$/.test(line)) {
      // Accumulate header lines (they may wrap across multiple lines)
      const newHeaders = splitCategoryHeaders(line);
      if (newHeaders.length > 0) {
        categoryHeaders = categoryHeaders.concat(newHeaders);
      }
      continue;
    }

    // --- Handle short wrapped header lines like "S", "H", "O" or "DEFRSEBC" ---
    if (currentSeatBlock && !collectingMeritData && /^[A-Z0-9]{1,12}$/.test(line)) {
      if (line === 'Stage') {
        // "Stage" at end = end of data block
        continue;
      }

      // A lone "S", "H", or "O" is likely a suffix that wrapped from the previous line
      // Append it to the last category header code
      if ((line === 'S' || line === 'H' || line === 'O') && categoryHeaders.length > 0) {
        const lastCode = categoryHeaders[categoryHeaders.length - 1];
        // Only append if the last code doesn't already end with S/H/O
        if (!lastCode.endsWith('S') && !lastCode.endsWith('H') && !lastCode.endsWith('O')) {
          categoryHeaders[categoryHeaders.length - 1] = lastCode + line;
        } else {
          // It might be a new code prefix — try splitting
          const newHeaders = splitCategoryHeaders(line);
          if (newHeaders.length > 0) {
            categoryHeaders = categoryHeaders.concat(newHeaders);
          }
        }
        continue;
      }

      // Try to split as category codes (handles things like "DEFRSEBC", "EWS", etc.)
      const newHeaders = splitCategoryHeaders(line);
      if (newHeaders.length > 0) {
        categoryHeaders = categoryHeaders.concat(newHeaders);
      }
      continue;
    }

    // --- Collect merit numbers and percentiles ---
    if (collectingMeritData && currentSeatBlock) {
      // Merit number: a plain number like "34240"
      const meritMatch = line.match(/^(\d+)$/);
      if (meritMatch) {
        const meritNo = parseInt(meritMatch[1], 10);
        // Don't treat page numbers (standalone small numbers after legends) as merit
        if (meritNo > 0) {
          meritValues.push({ merit: meritNo, percentile: null });
        }
        continue;
      }

      // Percentile: "(88.5013511)"
      const pctMatch = line.match(/^\((\d+\.?\d*)\)$/);
      if (pctMatch && meritValues.length > 0) {
        // Assign to the last merit entry that doesn't have a percentile
        const lastMerit = meritValues[meritValues.length - 1];
        if (lastMerit && lastMerit.percentile === null) {
          lastMerit.percentile = parseFloat(pctMatch[1]);
        }
        continue;
      }

      // "Stage" alone = end of current data block
      if (line === 'Stage') {
        collectingMeritData = false;
        continue;
      }

      // If we hit something that doesn't match, stop collecting
      // (could be next branch, status line, etc.)
      if (!meritMatch && !pctMatch) {
        collectingMeritData = false;
        // Don't skip this line — let it be processed by other handlers
        i--;
        continue;
      }
    }
  }

  // Finalize last branch
  finalizeBranch(results, currentCollege, currentBranch, currentSeatBlock, categoryHeaders, meritValues);

  console.log(`📊 Parsed ${results.length} branch entries from PDF`);
  return results;
}

/**
 * Assign collected merit/percentile values to category headers.
 */
function assignMeritToCategories(seatBlock, categoryHeaders, meritValues, stage = 'I') {
  if (!seatBlock || categoryHeaders.length === 0 || meritValues.length === 0) return;

  categoryHeaders.forEach((cat, idx) => {
    if (!seatBlock.categories[cat]) {
      seatBlock.categories[cat] = {
        stage1MeritNo: null,
        stage1Percentile: null,
        stage2MeritNo: null,
        stage2Percentile: null
      };
    }

    if (idx < meritValues.length) {
      const val = meritValues[idx];
      if (stage === 'I') {
        seatBlock.categories[cat].stage1MeritNo = val.merit;
        seatBlock.categories[cat].stage1Percentile = val.percentile;
      } else {
        seatBlock.categories[cat].stage2MeritNo = val.merit;
        seatBlock.categories[cat].stage2Percentile = val.percentile;
      }
    }
  });
}

/**
 * Finalize current branch and save to results.
 */
function finalizeBranch(results, college, branch, seatBlock, categoryHeaders, meritValues) {
  if (!college || !branch) return;

  // Assign remaining merit data to current seat block
  if (seatBlock && categoryHeaders.length > 0 && meritValues.length > 0) {
    assignMeritToCategories(seatBlock, categoryHeaders, meritValues);
  }

  // Only save if there's meaningful data
  if (branch.branchCode) {
    results.push({
      collegeCode: college.collegeCode,
      collegeName: college.collegeName,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      collegeType: branch.collegeType,
      homeUniversity: branch.homeUniversity,
      seatBlocks: branch.seatBlocks
    });
  }
}

module.exports = { parseCutoffPDF };
