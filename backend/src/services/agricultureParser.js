const pdfParse = require('pdf-parse');

/**
 * Parse a B.Sc. Agriculture CAP Round cutoff PDF buffer and extract structured data.
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<Array>} Array of parsed college entries with cutoff data
 */
async function parseAgriculturePDF(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  const lines = data.text.split('\n');

  const results = [];
  let currentCollegeCode = null;
  let currentCollegeNameParts = [];
  let currentCollegeName = '';

  // Regex to match the cutoff pattern at the end of a line
  const cutoffRegex = /(OPEN|SC|ST|OBC|SEBC|EWS|VJ\(a\)|VJ|NT\(b\)|NT\(c\)|NT\(d\)|NT1|NT2|NT3)(GN|PWD|PAP|OR|FF|DP|ORPHAN)(M|U|OS)(B|F)(\d+)(Not Allotted|\d+(?:\.\d+)?)$/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip headers and metadata
    if (line.includes('CAP 1 Cut Off') || line.includes('Cut offs are generated') || line.includes('CollegeName') || line.includes('Last Merit')) {
      continue;
    }

    const cutoffMatch = line.match(cutoffRegex);

    if (cutoffMatch) {
      // It's a cutoff line!
      const [fullMatch, category, specialCategory, quota, gender, seats, cutoffStr] = cutoffMatch;
      
      // Determine college info from the prefix of the line
      const prefix = line.slice(0, line.length - fullMatch.length).trim();
      
      if (prefix) {
        // Check if prefix starts with 5-digit code
        const codeMatch = prefix.match(/^(\d{5})/);
        if (codeMatch) {
          currentCollegeCode = codeMatch[1];
          const namePart = prefix.slice(codeMatch[0].length).trim();
          currentCollegeNameParts = [namePart];
          currentCollegeName = namePart;
        }
      }

      if (!currentCollegeCode) {
        continue;
      }

      // Finalize college name if we have parts
      if (currentCollegeNameParts.length > 0 && !currentCollegeName) {
        currentCollegeName = currentCollegeNameParts.join(' ').replace(/\s+/g, ' ').trim();
      }

      const cleanCollegeName = (currentCollegeName || '').replace(/\.$/, '').trim();

      // Parse Quota to Seat Block Type and Category to category code
      const seatTypeSuffix = quota.toUpperCase() === 'M' ? 'S' : quota.toUpperCase() === 'U' ? 'H' : 'O';
      const seatBlockType = quota.toUpperCase() === 'M' ? 'State Level' : quota.toUpperCase() === 'U' ? 'Home University' : 'Other than Home University';
      
      const categoryCode = buildAgricultureCategoryCode(category, specialCategory, gender, seatTypeSuffix);

      // Determine branch based on college name
      const nameLower = cleanCollegeName.toLowerCase();
      let branchName = "B. Sc. (Hons) Agriculture";
      let branchCodeSuffix = "99001"; // default agriculture suffix

      if (nameLower.includes('horticulture')) {
        branchName = "B. Sc. (Hons) Horticulture";
        branchCodeSuffix = "99002";
      } else if (nameLower.includes('forestry')) {
        branchName = "B. Sc. (Hons) Forestry";
        branchCodeSuffix = "99003";
      } else if (nameLower.includes('fisheries') || nameLower.includes('fishery')) {
        branchName = "B. F. Sc. (Fisheries)";
        branchCodeSuffix = "99004";
      } else if (nameLower.includes('food technology') || nameLower.includes('food tech')) {
        branchName = "B. Tech. (Food Technology)";
        branchCodeSuffix = "99005";
      } else if (nameLower.includes('business management') || nameLower.includes('abm') || nameLower.includes('agri. business')) {
        branchName = "B. Sc. (Hons) Agri. Business Management";
        branchCodeSuffix = "99006";
      } else if (nameLower.includes('engineering') || nameLower.includes('agri. engineering')) {
        branchName = "B. Tech. (Agricultural Engineering)";
        branchCodeSuffix = "99007";
      } else if (nameLower.includes('biotechnology')) {
        branchName = "B. Tech. (Biotechnology)";
        branchCodeSuffix = "99008";
      } else if (nameLower.includes('community science')) {
        branchName = "B. Sc. (Hons) Community Science";
        branchCodeSuffix = "99009";
      }

      const branchCode = `${currentCollegeCode}${branchCodeSuffix}`;
      
      // Determine college type (Private vs Government)
      const collegeType = nameLower.includes('govt') || nameLower.includes('government') ? 'Government' : 'Un-Aided';

      // 3. Find or create college entry in results
      let entry = results.find(r => r.collegeCode === currentCollegeCode && r.branchCode === branchCode);
      if (!entry) {
        entry = {
          collegeCode: currentCollegeCode,
          collegeName: cleanCollegeName.replace(/\s+/g, ' ').trim(),
          branchCode,
          branchName,
          collegeType,
          homeUniversity: 'State Level',
          seatBlocks: []
        };
        results.push(entry);
      }

      // Find or create seat block
      let block = entry.seatBlocks.find(b => b.seatBlockType === seatBlockType);
      if (!block) {
        block = { seatBlockType, categories: {} };
        entry.seatBlocks.push(block);
      }

      // Parse cutoff score
      const cutoff = cutoffStr.toLowerCase() === 'not allotted' ? null : parseFloat(cutoffStr);

      if (cutoff !== null) {
        block.categories[categoryCode] = {
          stage1MeritNo: null,
          stage1Percentile: cutoff,
          stage2MeritNo: null,
          stage2Percentile: null
        };
      }

    } else {
      // Not a cutoff line. Check if it's a 5-digit code alone or code + start of name
      const codeMatch = line.match(/^(\d{5})/);
      if (codeMatch) {
        currentCollegeCode = codeMatch[1];
        const rest = line.slice(codeMatch[0].length).trim();
        currentCollegeNameParts = rest ? [rest] : [];
        currentCollegeName = rest;
      } else if (currentCollegeCode) {
        // Continuation of college name
        if (line.length > 3 && !line.includes('Page') && !line.includes('STATE COMMON')) {
          currentCollegeNameParts.push(line);
          currentCollegeName = currentCollegeNameParts.join(' ').replace(/\s+/g, ' ').trim();
        }
      }
    }
  }

  return results;
}

function buildAgricultureCategoryCode(category, specialCategory, gender, seatTypeSuffix) {
  let cat = category.toUpperCase();
  if (cat === 'VJ(A)' || cat === 'VJ') cat = 'VJ';
  else if (cat === 'NT(B)' || cat === 'NT1') cat = 'NT1';
  else if (cat === 'NT(C)' || cat === 'NT2') cat = 'NT2';
  else if (cat === 'NT(D)' || cat === 'NT3') cat = 'NT3';

  const spec = specialCategory.toUpperCase();
  
  if (spec === 'PWD') {
    return `PWD${cat}${seatTypeSuffix}`;
  }
  if (spec === 'OR') {
    return 'ORPHAN';
  }
  if (spec === 'FF' || spec === 'PAP' || spec === 'DP') {
    return `DEF${cat}${seatTypeSuffix}`;
  }

  // Standard GN (General)
  const genPrefix = gender.toUpperCase() === 'F' ? 'L' : 'G';
  
  if (cat === 'EWS') {
    return 'EWS';
  }

  return `${genPrefix}${cat}${seatTypeSuffix}`;
}

module.exports = { parseAgriculturePDF };
