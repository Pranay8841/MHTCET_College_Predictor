/**
 * JoSAA HTML Parser — Custom scanner for JoSAA Webpage Source
 * Parses opening/closing rank tables from saved .html files.
 */

/**
 * Parse the JoSAA opening/closing rank HTML string.
 * @param {string} htmlContent - The HTML file string
 * @returns {Array} Array of parsed cutoff rows
 */
function parseJosaaHTML(htmlContent) {
  // Split by newline (handles both LF and CRLF because of trim)
  const lines = htmlContent.split('\n');
  const results = [];

  let currentCollege = null;
  let currentBranch = null;
  let currentQuota = null;
  let currentCategory = null;
  let currentGender = null;
  let currentOpenRank = null;
  let currentCloseRank = null;

  console.log(`⏳ Scanning ${lines.length} lines of HTML...`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 1. Detect College (first cell in <tr>, e.g., <td align="left">Indian Institute...</td>)
    const collegeMatch = line.match(/<td align="left">([^<]+)<\/td>/i);
    if (collegeMatch && !line.includes('span id=')) {
      currentCollege = collegeMatch[1].replace(/\s+/g, ' ').trim();
      continue;
    }

    // 2. Detect Branch
    const branchMatch = line.match(/lblBranch">([^<]+)<\/span>/);
    if (branchMatch) {
      currentBranch = branchMatch[1].replace(/\s+/g, ' ').trim();
      continue;
    }

    // 3. Detect Quota
    const quotaMatch = line.match(/lblQuota">([^<]+)<\/span>/);
    if (quotaMatch) {
      currentQuota = quotaMatch[1].trim();
      continue;
    }

    // 4. Detect Category
    const categoryMatch = line.match(/lblCategory">([^<]+)<\/span>/);
    if (categoryMatch) {
      currentCategory = categoryMatch[1].trim();
      continue;
    }

    // 5. Detect Gender
    const genderMatch = line.match(/lblGender">([^<]+)<\/span>/);
    if (genderMatch) {
      currentGender = genderMatch[1].replace(/\s+/g, ' ').trim();
      continue;
    }

    // 6. Detect Open Rank
    const openRankMatch = line.match(/lblOpenRank">([^<]+)<\/span>/);
    if (openRankMatch) {
      currentOpenRank = openRankMatch[1].trim();
      continue;
    }

    // 7. Detect Close Rank
    const closeRankMatch = line.match(/lblCloseRank">([^<]+)<\/span>/);
    if (closeRankMatch) {
      currentCloseRank = closeRankMatch[1].trim();

      // Close Rank is the last column, so save the row
      if (currentCollege && currentBranch && currentCategory) {
        results.push({
          collegeName: currentCollege,
          branchName: currentBranch,
          quota: currentQuota || 'AI',
          category: currentCategory,
          gender: currentGender || 'Gender-Neutral',
          openRank: currentOpenRank || 'N/A',
          closeRank: currentCloseRank || 'N/A'
        });
      }
    }
  }

  console.log(`✅ JoSAA HTML scanning complete. Found ${results.length} records.`);
  return results;
}

module.exports = { parseJosaaHTML };
