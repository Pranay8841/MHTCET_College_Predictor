const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, '..', 'data');
const CACHE_FILE = path.join(CACHE_DIR, 'college_details_cache.json');

let cache = {};

// Load cache from disk
function loadCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      cache = JSON.parse(data);
      console.log(`📦 Loaded ${Object.keys(cache).length} colleges from details cache file.`);
    } else {
      cache = {};
      saveCache();
      console.log('🌱 Initialized empty college details cache file.');
    }
  } catch (err) {
    console.error('⚠️ Failed to load college details cache:', err.message);
    cache = {};
  }
}

// Save cache to disk
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('⚠️ Failed to write college details cache to disk:', err.message);
  }
}

// Regex Helpers for Scraping
function extractAveragePackage(text) {
  const patterns = [
    /average package[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*(?:LPA|Lakh|lakhs|lakh per annum)/i,
    /average salary[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*(?:LPA|Lakh|lakhs|lakh per annum)/i,
    /avg package[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*(?:LPA|Lakh|lakhs|lakh per annum)/i,
    /placements average[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*(?:LPA|Lakh|lakhs|lakh per annum)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return `₹${match[1]} LPA`;
  }
  return null;
}

function extractHighestPackage(text) {
  const patterns = [
    /highest package[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*(?:LPA|Lakh|lakhs|lakh per annum)/i,
    /highest salary[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*(?:LPA|Lakh|lakhs|lakh per annum)/i,
    /highest placement[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*(?:LPA|Lakh|lakhs|lakh per annum)/i,
    /highest package[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9.]+)\s*Cr/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('Cr')) {
        return `₹${parseFloat(match[1]) * 100} LPA`; // Convert Cr to LPA
      }
      return `₹${match[1]} LPA`;
    }
  }
  return null;
}

function extractFees(text) {
  const patterns = [
    /annual fees?[\s\S]{1,60}?(?:Rs\.?|INR|₹)\s*([0-9,.]+)/i,
    /fees?[\s\S]{1,60}?(?:Rs\.?|INR|₹)\s*([0-9,.]+)/i,
    /fee structure[\s\S]{1,60}?(?:Rs\.?|INR|₹)\s*([0-9,.]+)/i,
    /tuition fees?[\s\S]{1,60}?(?:Rs\.?|INR|₹)\s*([0-9,.]+)/i,
    /fees? is[\s\S]{1,60}?(?:Rs\.?|INR|₹)?\s*([0-9,.]+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const cleanVal = match[1].replace(/,/g, '');
      const num = parseFloat(cleanVal);
      if (!isNaN(num) && num > 1000) {
        if (num > 1000000) {
          return `₹${(num / 100000).toFixed(2)} Lakhs (Total)`;
        }
        return `₹${(num / 100000).toFixed(2)} Lakhs/yr`;
      }
    }
  }
  return null;
}

function extractNIRF(text) {
  const patterns = [
    /NIRF[\s\S]{1,60}?(?:ranked |rank |ranking is |#)?\s*([0-9]+-[0-9]+|[0-9]+)/i,
    /ranked[\s\S]{1,40}?in NIRF/i,
    /NIRF range (?:is )?([0-9]+-[0-9]+)/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fallback Heuristics Generator
function getFallbackData(collegeName, collegeType) {
  const typeLower = String(collegeType || '').toLowerCase();
  const nameLower = String(collegeName || '').toLowerCase();

  let avgPackage = '₹3.8 LPA';
  let highestPackage = '₹12.0 LPA';
  let totalFees = '₹4.4 Lakhs (₹1.1L/yr)';
  let topRecruiters = ['TCS', 'Infosys', 'Cognizant'];

  const isGovtOrAided = typeLower.includes('government') || 
    (typeLower.includes('aided') && !typeLower.includes('un-aided')) || 
    nameLower.includes('government') || 
    (nameLower.includes('aided') && !nameLower.includes('un-aided'));

  if (isGovtOrAided) {
    avgPackage = '₹4.5 LPA';
    highestPackage = '₹14.0 LPA';
    totalFees = '₹2.8 Lakhs (₹70k/yr)';
    topRecruiters = ['L&T', 'TCS', 'Infosys', 'Tata Motors'];
  } else if (typeLower.includes('autonomous') || nameLower.includes('autonomous')) {
    avgPackage = '₹5.0 LPA';
    highestPackage = '₹18.0 LPA';
    totalFees = '₹5.2 Lakhs (₹1.3L/yr)';
    topRecruiters = ['Accenture', 'TCS', 'Capgemini', 'Persistent'];
  } else if (nameLower.includes('pharmacy') || nameLower.includes('pharma') || nameLower.includes('b.pharm')) {
    avgPackage = '₹3.5 LPA';
    highestPackage = '₹8.0 LPA';
    totalFees = '₹4.0 Lakhs (₹1.0L/yr)';
    topRecruiters = ['Cipla', 'Sun Pharma', 'Lupin', 'Reddy\'s'];
  } else if (nameLower.includes('nursing') || nameLower.includes('nurs')) {
    avgPackage = '₹2.8 LPA';
    highestPackage = '₹5.0 LPA';
    totalFees = '₹3.2 Lakhs (₹80k/yr)';
    topRecruiters = ['Apollo Hospitals', 'Fortis', 'Kokilaben Hospital'];
  } else if (nameLower.includes('agriculture') || nameLower.includes('agri')) {
    avgPackage = '₹3.0 LPA';
    highestPackage = '₹6.0 LPA';
    totalFees = '₹2.4 Lakhs (₹60k/yr)';
    topRecruiters = ['Mahyco', 'Bayer Crop Science', 'National Agro'];
  }

  return {
    nirfRank: 'N/A',
    stateRank: 'N/A',
    totalFees,
    averagePackage: avgPackage,
    highestPackage,
    topRecruiters,
    isEstimated: true
  };
}

// Initialize cache on service load
loadCache();

/**
 * Fetch and parse college details dynamically using web search.
 * Uses cache if available.
 */
async function getCollegeDetails(collegeCode, collegeName, collegeType) {
  const code = String(collegeCode || '').trim();
  
  // Return from memory cache if hits
  if (cache[code]) {
    return cache[code];
  }

  console.log(`🔍 Cache miss for college details: ${code} - "${collegeName}". Starting dynamic DDG scrape...`);
  
  let queryName = collegeName
    .replace(/^.*Charitable\s+Trust's\s+/i, '')
    .replace(/^.*Education\s+Society's\s+/i, '')
    .replace(/^.*Shikshan\s+Prasarak\s+Mandal's\s+/i, '')
    .replace(/^.*Foundation's\s+/i, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const query = encodeURIComponent(`${queryName} average package fees NIRF rank`);
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${query}`;
  
  let scraped = {};
  
  try {
    const response = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(8000) // 8 second network timeout
    });
    
    if (response.ok) {
      const html = await response.text();
      const matches = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];
      const snippets = matches.map(m => m[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
      const joinedText = snippets.join(' | ');

      scraped = {
        nirfRank: extractNIRF(joinedText),
        totalFees: extractFees(joinedText),
        averagePackage: extractAveragePackage(joinedText),
        highestPackage: extractHighestPackage(joinedText)
      };
      
      console.log(`✨ Dynamic scrape for ${collegeName} finished. Results:`, scraped);
    } else {
      console.warn(`⚠️ DDG search failed with status: ${response.status}`);
    }
  } catch (err) {
    console.error(`❌ Failed scraping DDG details for ${collegeCode}:`, err.message);
  }

  // Generate fallback heuristics for any missing values
  const fallback = getFallbackData(collegeName, collegeType);
  
  const finalDetails = {
    nirfRank: scraped.nirfRank || fallback.nirfRank,
    stateRank: fallback.stateRank, // Default to N/A or matching estimated rank
    totalFees: scraped.totalFees || fallback.totalFees,
    averagePackage: scraped.averagePackage || fallback.averagePackage,
    highestPackage: scraped.highestPackage || fallback.highestPackage,
    topRecruiters: fallback.topRecruiters, // recruiters from fallback structure
    isEstimated: (!scraped.averagePackage && !scraped.totalFees) // tag as estimated if scraping failed to find core stats
  };

  // Write to cache and file
  cache[code] = finalDetails;
  saveCache();
  
  return finalDetails;
}

module.exports = {
  getCollegeDetails
};
