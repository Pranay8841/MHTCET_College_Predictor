/**
 * Category Code Decoder for MHTCET Cutoff Data
 * 
 * Category codes like "GOPENS", "LSEBCS", "TFWS" encode:
 *   Position 1: Gender (G=General/All, L=Ladies)
 *   Position 2-N: Caste/Category (OPEN, SC, ST, VJ, NT1, NT2, NT3, OBC, SEBC, EWS, PWD, DEF, TFW, ORPHAN)
 *   Last char: Seat Type (S=State, H=Home University, O=Other than Home University)
 */

// All valid caste/category values
const CATEGORIES = [
  'OPEN', 'SC', 'ST', 'VJ', 'NT1', 'NT2', 'NT3',
  'OBC', 'SEBC', 'EWS', 'PWD', 'DEF', 'TFW', 'ORPHAN'
];

// Special categories that don't follow the G/L gender prefix pattern
const SPECIAL_CATEGORIES = ['TFW', 'EWS', 'ORPHAN', 'PWD', 'DEF'];

/**
 * Decode a category code into its components.
 * @param {string} code - e.g., "GOPENS", "LSEBCS", "TFWS"
 * @returns {{ gender: string, category: string, seatType: string }}
 */
function decodeCategory(code) {
  if (!code || typeof code !== 'string') return null;

  const upperCode = code.toUpperCase();

  // Handle special categories first
  for (const special of SPECIAL_CATEGORIES) {
    if (upperCode.startsWith(special)) {
      const remaining = upperCode.slice(special.length);
      let seatType = 'S'; // default to State
      if (remaining === 'H') seatType = 'H';
      else if (remaining === 'O') seatType = 'O';
      else if (remaining === 'S') seatType = 'S';

      // For PWD and DEF, they might have subcategory like PWDOPENS
      if ((special === 'PWD' || special === 'DEF') && remaining.length > 1) {
        // e.g., PWDOPENS → PWD + OPEN + S
        for (const cat of CATEGORIES) {
          if (remaining.startsWith(cat)) {
            const subRemaining = remaining.slice(cat.length);
            seatType = subRemaining === 'H' ? 'H' : subRemaining === 'O' ? 'O' : 'S';
            return { gender: 'G', category: `${special}${cat}`, seatType };
          }
        }
      }

      return { gender: 'G', category: special, seatType };
    }
  }

  // Standard pattern: G/L prefix + category + S/H/O suffix
  const gender = upperCode[0];
  if (gender !== 'G' && gender !== 'L') return null;

  const rest = upperCode.slice(1);
  for (const cat of CATEGORIES) {
    if (rest.startsWith(cat)) {
      const suffix = rest.slice(cat.length);
      let seatType = 'S'; // default
      if (suffix === 'H') seatType = 'H';
      else if (suffix === 'O') seatType = 'O';
      else if (suffix === 'S') seatType = 'S';

      return { gender, category: cat, seatType };
    }
  }

  return null;
}

/**
 * Build all possible category codes that a student is eligible for.
 * 
 * @param {string} gender - 'G' (Male/General) or 'L' (Ladies/Female)
 * @param {string} category - 'OPEN', 'SC', 'ST', etc.
 * @param {string} seatType - 'S' (State), 'H' (Home University), 'O' (Other)
 * @returns {string[]} Array of category codes to check
 */
function buildCategoryCodes(gender, category, seatType) {
  const codes = new Set();

  // Handle special categories
  if (['TFW', 'ORPHAN'].includes(category)) {
    codes.add(`${category}S`);
    if (seatType === 'H') codes.add(`${category}H`);
    if (seatType === 'O') codes.add(`${category}O`);
    // Also add the plain form (e.g., TFWS, EWS)
    codes.add(category);
    return [...codes];
  }

  if (category === 'EWS') {
    codes.add('EWS');
    codes.add('EWSS');
    if (seatType === 'H') codes.add('EWSH');
    if (seatType === 'O') codes.add('EWSO');
    return [...codes];
  }

  if (category === 'PWD') {
    // PWD can appear as PWDOPENS, PWDOPENS, etc.
    codes.add(`PWDOPEN${seatType}`);
    codes.add(`PWD${seatType}`);
    if (gender === 'L') {
      codes.add(`PWDOPEN${seatType}`);
    }
    return [...codes];
  }

  if (category === 'DEF') {
    codes.add(`DEFOPEN${seatType}`);
    codes.add(`DEF${seatType}`);
    if (gender === 'L') {
      codes.add(`DEFOPEN${seatType}`);
    }
    return [...codes];
  }

  // Standard pattern: Gender + Category + SeatType
  // General (male) candidates can only use G-prefixed seats
  codes.add(`G${category}${seatType}`);

  // Ladies can use both G and L prefixed seats
  if (gender === 'L') {
    codes.add(`L${category}${seatType}`);
  }

  // OPEN category candidates should also check their specific category
  // But category-specific students should also check OPEN seats
  if (category !== 'OPEN') {
    codes.add(`G${category}${seatType}`);
    if (gender === 'L') {
      codes.add(`L${category}${seatType}`);
    }
  }

  return [...codes];
}

/**
 * Get a human-readable label for a category code.
 * @param {string} code - e.g., "GOPENS"
 * @returns {string} Human-readable label
 */
function getCategoryLabel(code) {
  const decoded = decodeCategory(code);
  if (!decoded) return code;

  const genderLabel = decoded.gender === 'L' ? 'Ladies' : 'General';
  const seatTypeLabel = {
    'S': 'State Level',
    'H': 'Home University',
    'O': 'Other University'
  }[decoded.seatType] || decoded.seatType;

  return `${genderLabel} ${decoded.category} (${seatTypeLabel})`;
}

module.exports = {
  decodeCategory,
  buildCategoryCodes,
  getCategoryLabel,
  CATEGORIES,
  SPECIAL_CATEGORIES
};
