const pdfParse = require('pdf-parse');

// Map of Nursing PDF category names to standard database category codes
const NURSING_CATEGORY_MAP = {
  'OPEN': 'GOPENS',
  'SC': 'GSCS',
  'ST': 'GSTS',
  'VJ-A': 'GVJS',
  'NT-A': 'GVJS',
  'VJ': 'GVJS',
  'NT-B': 'GNT1S',
  'NT1': 'GNT1S',
  'NT-C': 'GNT2S',
  'NT2': 'GNT2S',
  'NT-D': 'GNT3S',
  'NT3': 'GNT3S',
  'OBC': 'GOBCS',
  'SEBC': 'GSEBCS',
  'EWS': 'EWS',
  'D1': 'DEFOPENS',
  'D2': 'DEFOPENS',
  'ORPHEN': 'ORPHAN',
  'ORPHAN': 'ORPHAN',
  'PH': 'PWDOPENS'
};

/**
 * Parse a B.Sc. Nursing CAP Round cutoff PDF buffer and extract structured data.
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<Array>} Array of parsed college entries with cutoff data
 */
async function parseNursingPDF(pdfBuffer) {
  const pagesData = [];
  const options = {
    pagerender: async function(pageData) {
      const textContent = await pageData.getTextContent();
      const items = textContent.items.map(item => ({
        text: item.str.trim(),
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        w: Math.round(item.width),
        h: Math.round(item.height)
      }));
      pagesData.push(items);
      return "";
    }
  };

  await pdfParse(pdfBuffer, options);
  
  const results = [];

  for (let pageIndex = 0; pageIndex < pagesData.length; pageIndex++) {
    const items = pagesData[pageIndex];
    if (items.length === 0) continue;

    // Separate items by dividing line y = 240
    // Cutoff entries are in the upper part (y >= 240)
    // College names/codes are in the lower part (y < 240)
    const cutoffItems = items.filter(item => item.y >= 240);
    const metaItems = items.filter(item => item.y < 240);

    // 1. Identify college columns on this page
    const columns = [];
    metaItems.forEach(item => {
      let code = null;
      if (/^\d{5}$/.test(item.text)) {
        code = item.text;
      } else {
        const match = item.text.match(/^(\d+)\s+(\d{5})$/);
        if (match) {
          code = match[2];
        }
      }

      if (code) {
        // Prevent adding duplicate columns at the same X coordinate
        if (!columns.some(col => Math.abs(col.x - item.x) < 5)) {
          columns.push({
            x: item.x,
            collegeCode: code,
            nameParts: []
          });
        }
      }
    });

    if (columns.length === 0) {
      continue;
    }

    // Sort columns by X coordinate (left to right)
    columns.sort((a, b) => a.x - b.x);

    // 2. Associate name parts with closest column X coordinates
    metaItems.forEach(item => {
      // Skip numbers/codes/header words
      if (/^\d+$/.test(item.text) || /^\d+\s+\d{5}$/.test(item.text) || 
          item.text.includes('CODE') || item.text.includes('COLLEGE NAME') || 
          item.text === 'SR') {
        return;
      }

      let closestCol = null;
      let minDist = Infinity;
      columns.forEach(col => {
        const dist = Math.abs(col.x - item.x);
        if (dist < minDist) {
          minDist = dist;
          closestCol = col;
        }
      });

      if (closestCol && minDist < 25) {
        closestCol.nameParts.push({ y: item.y, text: item.text });
      }
    });

    // Create preliminary college entries for this page
    const collegeEntries = columns.map(col => {
      col.nameParts.sort((a, b) => b.y - a.y);
      const name = col.nameParts.map(p => p.text).join(' ').replace(/\s+/g, ' ').trim();
      
      const collegeCode = col.collegeCode;
      const branchCode = `${collegeCode}99999`;
      const branchName = "B. Sc. Nursing";
      
      // Determine college type
      const nameLower = name.toLowerCase();
      const collegeType = nameLower.includes('govt') || nameLower.includes('government') ? 'Government' : 'Un-Aided';

      return {
        collegeCode,
        collegeName: name || `College ${collegeCode}`,
        branchCode,
        branchName,
        collegeType,
        homeUniversity: 'State Level',
        seatBlocks: [
          {
            seatBlockType: 'State Level',
            categories: {}
          }
        ]
      };
    });

    // 3. Process cutoff rows (y >= 240)
    // Group Y coordinates within a 4px threshold
    const rowsMap = new Map();
    cutoffItems.forEach(item => {
      let foundY = null;
      for (const existingY of rowsMap.keys()) {
        if (Math.abs(existingY - item.y) < 4) {
          foundY = existingY;
          break;
        }
      }
      if (foundY !== null) {
        rowsMap.get(foundY).push(item);
      } else {
        rowsMap.set(item.y, [item]);
      }
    });

    const sortedY = Array.from(rowsMap.keys()).sort((a, b) => b - a);
    let currentCategory = null;

    sortedY.forEach(y => {
      const rowItems = rowsMap.get(y);
      
      // Find category label in the row
      rowItems.forEach(item => {
        const txt = item.text.toUpperCase();
        const catKeys = Object.keys(NURSING_CATEGORY_MAP);
        for (const catKey of catKeys) {
          if (txt === catKey || txt.startsWith(catKey + ' ') || txt.endsWith(' ' + catKey)) {
            currentCategory = catKey;
            break;
          }
        }
      });

      if (!currentCategory) return;

      const dbCategory = NURSING_CATEGORY_MAP[currentCategory];

      // Check if it's a Rank row or a Pct row
      const hasRank = rowItems.some(item => item.text.toLowerCase() === 'rank');
      const hasPct = rowItems.some(item => item.text.toLowerCase() === 'pct' || item.text.toLowerCase() === 'percentile');

      rowItems.forEach(item => {
        const valStr = item.text;
        const valNum = parseFloat(valStr);
        if (isNaN(valNum)) return;

        // Skip category labels and words
        if (/^[a-zA-Z]/.test(valStr)) return;

        // Find closest column X coordinate
        let closestIndex = -1;
        let minDist = Infinity;
        columns.forEach((col, idx) => {
          const dist = Math.abs(col.x - item.x);
          if (dist < minDist) {
            minDist = dist;
            closestIndex = idx;
          }
        });

        if (closestIndex !== -1 && minDist < 15) {
          const entry = collegeEntries[closestIndex];
          const categories = entry.seatBlocks[0].categories;

          if (!categories[dbCategory]) {
            categories[dbCategory] = {
              stage1MeritNo: null,
              stage1Percentile: null,
              stage2MeritNo: null,
              stage2Percentile: null
            };
          }

          if (hasRank) {
            categories[dbCategory].stage1MeritNo = Math.round(valNum);
          } else if (hasPct) {
            categories[dbCategory].stage1Percentile = valNum;
          }
        }
      });
    });

    collegeEntries.forEach(entry => {
      // Only keep entries that have at least one parsed cutoff category
      if (Object.keys(entry.seatBlocks[0].categories).length > 0) {
        results.push(entry);
      }
    });
  }

  return results;
}

module.exports = { parseNursingPDF };
