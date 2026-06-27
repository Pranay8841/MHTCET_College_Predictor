const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase } = require('../supabaseClient');

// Initialize Gemini API
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('✅ Gemini API client successfully initialized.');
} else {
  console.warn('⚠️ GEMINI_API_KEY is not defined. Using DuckDuckGo search as fallback.');
}

let cache = {};

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

/**
 * Scrape search snippets from DuckDuckGo HTML for a college.
 */
async function fetchDDGSnippets(collegeName, collegeCode) {
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
      console.log(`✨ DDG search fetched snippets successfully for ${collegeName}.`);
      console.log(`🔍 Scraped Snippets for "${collegeName}":\n- ${snippets.slice(0, 5).join('\n- ')}\n`);
      return snippets.join(' | ');
    } else {
      console.warn(`⚠️ DDG search failed with status: ${response.status}`);
    }
  } catch (err) {
    console.error(`❌ Failed fetching DDG details for ${collegeCode}:`, err.message);
  }
  return '';
}

/**
 * Use Groq API to parse scraped search result snippets into structured JSON.
 */
async function parseSnippetsWithGroq(collegeName, collegeCode, collegeType, snippetsText) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not defined');
  }

  console.log(`⚡ Parsing scraped snippets using Groq API (llama-3.3-70b-versatile) for "${collegeName}"...`);

  const prompt = `You are an expert data extraction assistant. Extract placement statistics, NIRF rank, tuition fee details, and top recruiters for this college from the raw search snippets provided below:

College Name: "${collegeName}"
College Code: "${collegeCode}"
College Type: "${collegeType}"

Raw Search Snippets:
"""
${snippetsText}
"""

Instructions:
1. Extract NIRF rank (e.g. "90 (Engineering)", "101-150 Band" or "N/A").
2. Extract total tuition fees or annual fees (e.g. "₹4.5 Lakhs", "₹1.2 Lakhs/yr" or "₹12.0 Lakhs (Total)").
3. Extract average annual package (e.g. "₹5.2 LPA" or "₹6.5 LPA").
4. Extract highest annual package (e.g. "₹15.0 LPA" or "₹1.12 Cr" or "₹112.0 LPA").
5. Extract top recruiters as a simple array of strings (e.g. ["TCS", "Wipro", "Capgemini"]). If not clear, list the most prominent ones.
6. If the snippets don't contain specific fields, return null for those fields (do not guess or hallucinate).

CRITICAL FORMATTING RULES:
- Output values MUST be clean, single strings (e.g. "₹45.0 LPA" or "₹1.12 Cr").
- Do NOT include any parenthetical explanations, ranges, multiple alternatives, or verbose descriptions inside the string values (e.g. do NOT write "₹11.2 LPA (or ₹1.12 Crores)" or similar options).
- If the snippets mention both international and domestic packages, output the highest overall package cleanly.
- Respond ONLY with a valid, raw JSON block. The JSON structure MUST match:
{
  "nirfRank": "string or null",
  "totalFees": "string or null",
  "averagePackage": "string or null",
  "highestPackage": "string or null",
  "topRecruiters": ["string", "string", "string"] or null
}`;

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  console.log(response)

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API returned status ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result.choices[0].message.content.trim();
  const parsed = JSON.parse(content);

  return {
    nirfRank: parsed.nirfRank || null,
    totalFees: parsed.totalFees || null,
    averagePackage: parsed.averagePackage || null,
    highestPackage: parsed.highestPackage || null,
    topRecruiters: Array.isArray(parsed.topRecruiters) ? parsed.topRecruiters : null
  };
}

/**
 * Run dynamic Gemini API scrape with Search Grounding.
 */
async function scrapeWithGeminiGrounding(collegeName, collegeCode, collegeType, modelName) {
  if (!genAI) {
    throw new Error('Gemini API client is not initialized');
  }

  console.log(`🤖 Attempting dynamic Gemini API scrape with Search Grounding using ${modelName} for "${collegeName}"...`);
  const model = genAI.getGenerativeModel({
    model: modelName,
    tools: [{ googleSearch: {} }]
  });

  const prompt = `You are a real-time web scraper agent. Retrieve the latest placement and fee details for this engineering/pharmacy/nursing/agriculture college in Maharashtra:
Name: "${collegeName}"
Code: "${collegeCode}"
Type: "${collegeType}"

Perform a web search using your search tool to find:
1. Average annual package (in LPA, e.g. "₹4.5 LPA")
2. Highest annual package (in LPA, e.g. "₹18.0 LPA")
3. Total tuition fees or annual fees (in Lakhs, e.g. "₹3.4 Lakhs")
4. NIRF rank (e.g. "90 (Engineering)" or "101-150 Band" or "N/A")
5. Top 4-5 recruiters (e.g. ["TCS", "Wipro", "L&T"])

Respond ONLY with a valid, raw JSON block. Do not include markdown code block syntax (like \`\`\`json). The JSON structure MUST match:
{
  "nirfRank": "string or N/A",
  "totalFees": "string or N/A",
  "averagePackage": "string or N/A",
  "highestPackage": "string or N/A",
  "topRecruiters": ["string", "string", "string", "string"]
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonStr = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    nirfRank: parsed.nirfRank && parsed.nirfRank !== 'N/A' ? parsed.nirfRank : null,
    totalFees: parsed.totalFees && parsed.totalFees !== 'N/A' ? parsed.totalFees : null,
    averagePackage: parsed.averagePackage && parsed.averagePackage !== 'N/A' ? parsed.averagePackage : null,
    highestPackage: parsed.highestPackage && parsed.highestPackage !== 'N/A' ? parsed.highestPackage : null,
    topRecruiters: Array.isArray(parsed.topRecruiters) ? parsed.topRecruiters : null
  };
}

/**
 * Use standard Gemini API (no grounding tools) to parse scraped search result snippets into structured JSON.
 */
async function parseSnippetsWithGemini(collegeName, collegeCode, collegeType, snippetsText) {
  if (!genAI) {
    throw new Error('Gemini API client is not initialized');
  }

  console.log(`🤖 Parsing scraped snippets using standard Gemini API model gemini-2.5-flash...`);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You are an expert data extraction assistant. Extract placement statistics, NIRF rank, tuition fee details, and top recruiters for this college from the raw search snippets provided below:

College Name: "${collegeName}"
College Code: "${collegeCode}"
College Type: "${collegeType}"

Raw Search Snippets:
"""
${snippetsText}
"""

Instructions:
1. Extract NIRF rank (e.g. "90 (Engineering)", "101-150 Band" or "N/A").
2. Extract total tuition fees or annual fees (e.g. "₹4.5 Lakhs", "₹1.2 Lakhs/yr" or "₹12.0 Lakhs (Total)").
3. Extract average annual package (e.g. "₹5.2 LPA" or "₹6.5 LPA").
4. Extract highest annual package (e.g. "₹15.0 LPA" or "₹1.12 Cr" or "₹112.0 LPA").
5. Extract top recruiters as a simple array of strings (e.g. ["TCS", "Wipro", "Capgemini"]). If not clear, list the most prominent ones.
6. If the snippets don't contain specific fields, return null for those fields (do not guess or hallucinate).

CRITICAL FORMATTING RULES:
- Output values MUST be clean, single strings (e.g. "₹45.0 LPA" or "₹1.12 Cr").
- Do NOT include any parenthetical explanations, ranges, multiple alternatives, or verbose descriptions inside the string values (e.g. do NOT write "₹11.2 LPA (or ₹1.12 Crores)" or similar options).
- If the snippets mention both international and domestic packages, output the highest overall package cleanly.
- Respond ONLY with a valid, raw JSON block. Do not include markdown code block syntax (like \`\`\`json). The JSON structure MUST match:
{
  "nirfRank": "string or null",
  "totalFees": "string or null",
  "averagePackage": "string or null",
  "highestPackage": "string or null",
  "topRecruiters": ["string", "string", "string"] or null
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonStr = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(jsonStr);

  return {
    nirfRank: parsed.nirfRank || null,
    totalFees: parsed.totalFees || null,
    averagePackage: parsed.averagePackage || null,
    highestPackage: parsed.highestPackage || null,
    topRecruiters: Array.isArray(parsed.topRecruiters) ? parsed.topRecruiters : null
  };
}

/**
 * Fetch and parse college details dynamically using web search.
 * Uses cache if available.
 */
async function getCollegeDetails(collegeCode, collegeName, collegeType) {
  const code = String(collegeCode || '').trim();

  // 1. Return from memory cache if hits
  if (cache[code]) {
    return cache[code];
  }

  // 2. Query Supabase cache table
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('college_details')
        .select('*')
        .eq('college_code', code)
        .maybeSingle();

      if (error) {
        console.warn(`⚠️ Supabase select query returned error for ${code}:`, error.message);
      } else if (data) {
        console.log(`📦 Loaded college details from Supabase cache: ${code}`);
        const mapped = {
          nirfRank: data.nirf_rank,
          stateRank: data.state_rank,
          totalFees: data.total_fees,
          averagePackage: data.average_package,
          highestPackage: data.highest_package,
          topRecruiters: data.top_recruiters,
          isEstimated: data.is_estimated
        };
        cache[code] = mapped; // sync to local memory cache
        return mapped;
      }
    } catch (err) {
      console.warn(`⚠️ Failed reading details from Supabase for ${code}:`, err.message);
    }
  }

  console.log(`🔍 Cache miss for college details: ${code} - "${collegeName}". Retrieving details...`);

  let scraped = {};
  let scrapeSuccess = false;
  let joinedSnippets = '';

  const hasGroq = !!process.env.GROQ_API_KEY;
  if (hasGroq) {
    // Groq Pipeline (Strictly bypasses Gemini API to avoid rate limits)
    joinedSnippets = await fetchDDGSnippets(collegeName, collegeCode);
    if (joinedSnippets) {
      try {
        scraped = await parseSnippetsWithGroq(collegeName, collegeCode, collegeType, joinedSnippets);
        scrapeSuccess = true;
        console.log(`✨ Groq LLM Scraper succeeded for ${collegeName}. Results:`, scraped);
      } catch (err) {
        console.warn(`❌ Groq parsing failed for ${collegeCode}, falling back to Regex:`, err.message);
      }
    }

    // Fall back to Regex directly if Groq parsing failed
    if (!scrapeSuccess && joinedSnippets) {
      scraped = {
        nirfRank: extractNIRF(joinedSnippets),
        totalFees: extractFees(joinedSnippets),
        averagePackage: extractAveragePackage(joinedSnippets),
        highestPackage: extractHighestPackage(joinedSnippets),
        topRecruiters: null
      };
      scrapeSuccess = true;
      console.log(`✨ Offline Regex fallback parsed DDG snippets successfully. Results:`, scraped);
    }
  } else {
    // Gemini Pipeline (Used only when GROQ_API_KEY is not configured)

    // Layer 1: Gemini Search Grounding
    if (genAI) {
      try {
        scraped = await scrapeWithGeminiGrounding(collegeName, collegeCode, collegeType, "gemini-2.5-flash");
        scrapeSuccess = true;
        console.log(`✨ Gemini 2.5 AI Scraper succeeded for ${collegeName}.`);
      } catch (err) {
        console.warn(`❌ Gemini 2.5 with grounding failed for ${collegeCode}:`, err.message);
      }
    }

    // Layer 3: DuckDuckGo Snippets Fallback
    if (!scrapeSuccess) {
      joinedSnippets = await fetchDDGSnippets(collegeName, collegeCode);
      if (joinedSnippets) {
        // Layer 4: Parse snippets with standard Gemini API
        if (genAI) {
          try {
            scraped = await parseSnippetsWithGemini(collegeName, collegeCode, collegeType, joinedSnippets);
            scrapeSuccess = true;
            console.log(`✨ DDG snippets successfully parsed using standard Gemini API. Results:`, scraped);
          } catch (err) {
            console.warn(`❌ Gemini parsing of DDG snippets failed for ${collegeCode}, falling back to Regex:`, err.message);
          }
        }

        // Layer 5: Parse snippets with offline Regex extraction helpers
        if (!scrapeSuccess) {
          scraped = {
            nirfRank: extractNIRF(joinedSnippets),
            totalFees: extractFees(joinedSnippets),
            averagePackage: extractAveragePackage(joinedSnippets),
            highestPackage: extractHighestPackage(joinedSnippets),
            topRecruiters: null
          };
          scrapeSuccess = true;
          console.log(`✨ Offline Regex fallback parsed DDG snippets successfully. Results:`, scraped);
        }
      }
    }
  }

  // Generate fallback heuristics for any missing values
  const fallback = getFallbackData(collegeName, collegeType);

  const finalDetails = {
    nirfRank: scraped.nirfRank || fallback.nirfRank,
    stateRank: fallback.stateRank, // Default to N/A or matching estimated rank
    totalFees: scraped.totalFees || fallback.totalFees,
    averagePackage: scraped.averagePackage || fallback.averagePackage,
    highestPackage: scraped.highestPackage || fallback.highestPackage,
    topRecruiters: scraped.topRecruiters && scraped.topRecruiters.length > 0 ? scraped.topRecruiters : fallback.topRecruiters,
    isEstimated: (!scraped.averagePackage && !scraped.totalFees) // tag as estimated if scraping failed to find core stats
  };

  // Write to in-memory cache
  cache[code] = finalDetails;

  // 3. Write to Supabase cache table
  if (supabase) {
    try {
      const { error } = await supabase
        .from('college_details')
        .upsert({
          college_code: code,
          nirf_rank: finalDetails.nirfRank,
          state_rank: finalDetails.stateRank,
          total_fees: finalDetails.totalFees,
          average_package: finalDetails.averagePackage,
          highest_package: finalDetails.highestPackage,
          top_recruiters: finalDetails.topRecruiters,
          is_estimated: finalDetails.isEstimated
        }, { onConflict: 'college_code' });

      if (error) {
        console.error(`❌ Failed saving college details to Supabase for ${code}:`, error.message);
      } else {
        console.log(`💾 Saved scraped college details for ${code} to Supabase.`);
      }
    } catch (err) {
      console.error(`❌ Exception saving college details to Supabase for ${code}:`, err.message);
    }
  }

  return finalDetails;
}

module.exports = {
  getCollegeDetails,
  parseSnippetsWithGemini,
  parseSnippetsWithGroq
};
