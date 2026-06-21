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
    codes.add(base);
  }
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

    // Try longest match first (greedy)
    const candidates = [...ALL_CATEGORY_CODES]
      .filter(code => remaining.startsWith(code))
      .sort((a, b) => b.length - a.length);

    if (candidates.length > 0) {
      result.push(candidates[0]);
      remaining = remaining.slice(candidates[0].length);
      found = true;
    }

    if (!found) {
      remaining = remaining.slice(1);
    }
  }

  return result;
}

/**
 * Map each merit/percentile x-coordinate to the closest category header's x-coordinate.
 */
function findClosestCategory(valueX, headers) {
  if (headers.length === 0) return null;
  let closestHeader = null;
  let minDistance = Infinity;

  for (const header of headers) {
    const dist = Math.abs(valueX - header.x);
    if (dist < minDistance) {
      minDistance = dist;
      closestHeader = header;
    }
  }

  // Column width is roughly 50 points, so values should be within 35 points of the header center
  if (minDistance > 35) {
    return null;
  }
  return closestHeader;
}

/**
 * Coordinate-Aware parser for Maharashtra CAP Round PDF cutoffs.
 */
async function parseCutoffPDF(pdfBuffer) {
  const pageItemsList = [];

  // Custom page renderer to extract text items and their coordinates
  function pagerender(pageData) {
    return pageData.getTextContent().then(function(textContent) {
      const items = textContent.items.map(item => ({
        text: item.str,
        x: item.transform[4],
        y: item.transform[5]
      }));
      pageItemsList.push(items);
      return ''; // Prevent full text buffering to save memory
    });
  }

  await pdfParse(pdfBuffer, { pagerender });

  const results = [];

  const COLLEGE_REGEX = /^(\d{5})\s*-\s*(.+)$/;
  const BRANCH_REGEX = /^(\d{10})\s*-\s*(.+)$/;
  const SEAT_BLOCK_KEYWORDS = [
    'Home University Seats Allotted to Other Than Home University Candidates',
    'Other Than Home University Seats Allotted to Other Than Home University Candidates',
    'Home University Seats Allotted to Home University Candidates',
    'All India Seats',
    'State Level'
  ];

  const STAGE_REGEX = /^\s*(I|II|III|IV|V|VI|VII|VIII|IX|X|I-Non PWD)\s*$/i;

  // Process each page
  for (let p = 0; p < pageItemsList.length; p++) {
    const rawItems = pageItemsList[p];
    
    // Sort items by y descending (top to bottom), and then by x ascending (left to right)
    const items = [...rawItems].sort((a, b) => {
      if (Math.abs(b.y - a.y) < 4) {
        return a.x - b.x;
      }
      return b.y - a.y;
    });

    let currentCollege = null;
    let currentBranch = null;
    let currentSeatBlock = null;
    let currentHeaders = []; // [{ code, x }]
    let collectingMeritData = false;
    let currentStage = 1; // 1 for Stage I, 2 for subsequent stages

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const text = item.text.trim();
      if (!text) continue;

      // 1. Detect College (5-digit code)
      const collegeMatch = text.match(COLLEGE_REGEX);
      if (collegeMatch) {
        currentCollege = {
          collegeCode: collegeMatch[1],
          collegeName: collegeMatch[2].trim()
        };
        currentBranch = null;
        currentSeatBlock = null;
        currentHeaders = [];
        collectingMeritData = false;
        continue;
      }

      // 2. Detect Branch (10-digit code)
      const branchMatch = text.match(BRANCH_REGEX);
      if (branchMatch) {
        currentBranch = {
          branchCode: branchMatch[1],
          branchName: branchMatch[2].trim(),
          collegeType: '',
          homeUniversity: '',
          seatBlocks: []
        };
        
        // Push an empty template row to results which we update inline below
        results.push({
          collegeCode: currentCollege ? currentCollege.collegeCode : '',
          collegeName: currentCollege ? currentCollege.collegeName : '',
          branchCode: currentBranch.branchCode,
          branchName: currentBranch.branchName,
          collegeType: '',
          homeUniversity: '',
          seatBlocks: currentBranch.seatBlocks
        });
        
        currentSeatBlock = null;
        currentHeaders = [];
        collectingMeritData = false;
        continue;
      }

      // 3. Detect Status line
      if (text === 'Status:' && currentBranch) {
        // Collect status components on the same visual line
        let statusText = '';
        let nextIdx = idx + 1;
        while (nextIdx < items.length && Math.abs(items[nextIdx].y - item.y) < 5) {
          statusText += items[nextIdx].text;
          nextIdx++;
        }
        
        const huMatch = statusText.match(/^(.+?)\s*Home\s*University\s*:\s*(.+)$/i);
        const activeResult = results.find(r => r.branchCode === currentBranch.branchCode);
        
        if (activeResult) {
          if (huMatch) {
            activeResult.collegeType = huMatch[1].trim();
            activeResult.homeUniversity = huMatch[2].trim();
            currentBranch.collegeType = huMatch[1].trim();
            currentBranch.homeUniversity = huMatch[2].trim();
          } else {
            activeResult.collegeType = statusText.trim();
            activeResult.homeUniversity = 'State Level';
            currentBranch.collegeType = statusText.trim();
            currentBranch.homeUniversity = 'State Level';
          }
        }
        idx = nextIdx - 1; // skip processed items
        continue;
      }

      // 4. Detect Seat Block
      const seatBlockKeyword = SEAT_BLOCK_KEYWORDS.find(kw => text.includes(kw));
      if (seatBlockKeyword && currentBranch) {
        currentSeatBlock = {
          seatBlockType: seatBlockKeyword,
          categories: {}
        };
        currentBranch.seatBlocks.push(currentSeatBlock);
        currentHeaders = [];
        collectingMeritData = false;
        continue;
      }

      // 5. Detect Stage Marker
      if (currentSeatBlock && STAGE_REGEX.test(text)) {
        const stageStr = text.toUpperCase();
        currentStage = (stageStr === 'I' || stageStr === 'I-NON PWD') ? 1 : 2;
        collectingMeritData = true;
        continue;
      }

      // 6. Detect Category Headers
      if (currentSeatBlock && !collectingMeritData) {
        const splitCodes = splitCategoryHeaders(text);
        if (splitCodes.length > 0) {
          splitCodes.forEach((code, codeIdx) => {
            currentHeaders.push({
              code,
              x: item.x + codeIdx * 50
            });
          });
          continue;
        }
      }

      // 7. Match Merit Numbers and Percentiles using coordinates
      if (collectingMeritData && currentSeatBlock && currentHeaders.length > 0) {
        // Merit number (pure integer)
        const meritMatch = text.match(/^(\d+)$/);
        if (meritMatch) {
          const meritNo = parseInt(meritMatch[1], 10);
          
          // Ignore page numbers (which are always at the bottom, e.g. y < 45)
          if (meritNo > 0 && item.y > 45) {
            const matchedHeader = findClosestCategory(item.x, currentHeaders);
            if (matchedHeader) {
              const cat = matchedHeader.code;
              if (!currentSeatBlock.categories[cat]) {
                currentSeatBlock.categories[cat] = {
                  stage1MeritNo: null,
                  stage1Percentile: null,
                  stage2MeritNo: null,
                  stage2Percentile: null
                };
              }
              if (currentStage === 1) {
                currentSeatBlock.categories[cat].stage1MeritNo = meritNo;
              } else {
                currentSeatBlock.categories[cat].stage2MeritNo = meritNo;
              }
            }
          }
          continue;
        }

        // Percentile value (parenthesized float)
        const pctMatch = text.match(/^\((\d+\.?\d*)\)$/);
        if (pctMatch) {
          const percentile = parseFloat(pctMatch[1]);
          const matchedHeader = findClosestCategory(item.x, currentHeaders);
          
          if (matchedHeader) {
            const cat = matchedHeader.code;
            if (!currentSeatBlock.categories[cat]) {
              currentSeatBlock.categories[cat] = {
                stage1MeritNo: null,
                stage1Percentile: null,
                stage2MeritNo: null,
                stage2Percentile: null
              };
            }
            if (currentStage === 1) {
              currentSeatBlock.categories[cat].stage1Percentile = percentile;
            } else {
              currentSeatBlock.categories[cat].stage2Percentile = percentile;
            }
          }
          continue;
        }

        // End marker for the block
        if (text === 'Stage') {
          collectingMeritData = false;
          continue;
        }
      }
    }
  }

  // Filter valid parsed entries
  const finalResults = results.filter(r => r.branchCode);
  console.log(`📊 Coordinate-Aware Parsed ${finalResults.length} branch entries from PDF`);
  return finalResults;
}

module.exports = { parseCutoffPDF };
