/**
 * Debug Script v2 — Test the category splitting and data flow
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

// Category codes for splitting
const KNOWN_CATEGORIES = [
  'PWDROBC', 'PWDRSCS', 'PWDRNT1', 'PWDRNT2', 'PWDRNT3', 'PWDRVJ', 'PWDRST',
  'DEFROBC', 'DEFRSCS', 'DEFRNT1', 'DEFRNT2', 'DEFRNT3', 'DEFRVJ', 'DEFRST', 'DEFRSEBC',
  'PWDOPEN', 'PWDSC', 'PWDST', 'PWDVJ', 'PWDNT1', 'PWDNT2', 'PWDNT3', 'PWDOBC', 'PWDSEBC',
  'DEFOPEN', 'DEFSC', 'DEFST', 'DEFVJ', 'DEFNT1', 'DEFNT2', 'DEFNT3', 'DEFOBC', 'DEFSEBC',
  'GOPEN', 'GSC', 'GST', 'GVJ', 'GNT1', 'GNT2', 'GNT3', 'GOBC', 'GSEBC',
  'LOPEN', 'LSC', 'LST', 'LVJ', 'LNT1', 'LNT2', 'LNT3', 'LOBC', 'LSEBC',
  'ORPHAN', 'TFW', 'EWS', 'MI'
];

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
  return codes;
}

const ALL_CATEGORY_CODES = buildAllCategoryCodes();

function splitCategoryHeaders(concatenated) {
  const result = [];
  let remaining = concatenated;
  while (remaining.length > 0) {
    let found = false;
    const candidates = [...ALL_CATEGORY_CODES]
      .filter(code => remaining.startsWith(code))
      .sort((a, b) => b.length - a.length);
    if (candidates.length > 0) {
      result.push(candidates[0]);
      remaining = remaining.slice(candidates[0].length);
      found = true;
    }
    if (!found) {
      console.log(`  ⚠️ Unrecognized character at: "${remaining.substring(0, 20)}..."`);
      remaining = remaining.slice(1);
    }
  }
  return result;
}

async function main() {
  const pdfPath = process.argv[2] || path.resolve(__dirname, '../../../2024ENGG_CAP1_CutOff.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(pdfBuffer);
  const lines = data.text.split('\n');

  // Test splitting the first concatenated header
  const testHeaders = [
    "GOPENSGSCSGSTSGVJSGNT1SGNT2SGNT3SGOBCSGSEBCSLOPENSLSCSLSTSLVJSLNT2SLOBCSLSEBCSPWDOPENSPWDOBCSDEFOPENSDEFOBCSTFWSPWDROBC",
    "DEFRSEBC",
    "EWS",
    "S"
  ];

  console.log('\n=== TEST SPLITTING CATEGORY HEADERS ===\n');
  for (const h of testHeaders) {
    const split = splitCategoryHeaders(h);
    console.log(`Input:  "${h}"`);
    console.log(`Output: [${split.join(', ')}] (${split.length} codes)\n`);
  }

  // Now trace through lines 10-70 to understand the flow
  console.log('\n=== TRACING LINES 10-70 ===\n');
  for (let i = 9; i < 70 && i < lines.length; i++) {
    const line = lines[i].trim();
    const isUpperAll = /^[A-Z0-9]+$/.test(line);
    const isNumber = /^\d+$/.test(line);
    const isPct = /^\(\d+\.?\d*\)$/.test(line);
    const isStage = /^\s*(I|II)\s*$/.test(lines[i]);
    
    let type = 'OTHER';
    if (isStage) type = 'STAGE';
    else if (isPct) type = 'PERCENTILE';
    else if (isNumber) type = 'NUMBER';
    else if (isUpperAll && line.length > 5) type = 'CATEGORY_HEADER';
    else if (isUpperAll) type = 'SHORT_UPPER';
    
    console.log(`[${String(i + 1).padStart(4)}] [${type.padEnd(16)}] "${line}"`);
  }

  // Check what happens with "S" — is it being treated as a category?
  console.log('\n\n=== TESTING "S" ALONE ===');
  console.log(`Split "S": [${splitCategoryHeaders("S").join(', ')}]`);
}

main().catch(console.error);
