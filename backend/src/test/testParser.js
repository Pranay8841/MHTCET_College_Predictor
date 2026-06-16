/**
 * Test Script — Validate PDF Parser
 * Run: node src/test/testParser.js <path-to-pdf>
 * 
 * Parses the reference PDF and outputs sample results for manual validation.
 */

const fs = require('fs');
const path = require('path');
const { parseCutoffPDF } = require('../services/pdfParser');

async function main() {
  // Default to the reference PDF in the project root
  const pdfPath = process.argv[2] || path.resolve(__dirname, '../../../2024ENGG_CAP1_CutOff.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF not found at: ${pdfPath}`);
    console.error('Usage: node src/test/testParser.js <path-to-pdf>');
    process.exit(1);
  }

  console.log(`\n📄 Parsing PDF: ${pdfPath}`);
  console.log(`   File size: ${(fs.statSync(pdfPath).size / (1024 * 1024)).toFixed(2)} MB\n`);

  const startTime = Date.now();
  const pdfBuffer = fs.readFileSync(pdfPath);
  const results = await parseCutoffPDF(pdfBuffer);
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n====================================`);
  console.log(`📊 PARSING RESULTS SUMMARY`);
  console.log(`====================================`);
  console.log(`Total branch entries: ${results.length}`);
  console.log(`Parse time: ${duration} seconds`);

  // Unique colleges
  const colleges = new Set(results.map(r => r.collegeCode));
  console.log(`Unique colleges: ${colleges.size}`);

  // Unique branches
  const branches = new Set(results.map(r => r.branchName));
  console.log(`Unique branch names: ${branches.size}`);

  // College type distribution
  const typeDistribution = {};
  results.forEach(r => {
    const type = r.collegeType || 'Unknown';
    typeDistribution[type] = (typeDistribution[type] || 0) + 1;
  });
  console.log(`\nCollege Type Distribution:`);
  Object.entries(typeDistribution).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Seat block types
  const seatBlockTypes = {};
  results.forEach(r => {
    r.seatBlocks.forEach(sb => {
      seatBlockTypes[sb.seatBlockType] = (seatBlockTypes[sb.seatBlockType] || 0) + 1;
    });
  });
  console.log(`\nSeat Block Types:`);
  Object.entries(seatBlockTypes).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Category codes found
  const allCategories = new Set();
  results.forEach(r => {
    r.seatBlocks.forEach(sb => {
      Object.keys(sb.categories).forEach(cat => allCategories.add(cat));
    });
  });
  console.log(`\nUnique Category Codes (${allCategories.size}):`);
  console.log(`  ${[...allCategories].sort().join(', ')}`);

  // Sample entries with data
  console.log(`\n====================================`);
  console.log(`📋 SAMPLE ENTRIES (first 5 with seat block data)`);
  console.log(`====================================\n`);

  const entriesWithData = results.filter(r => r.seatBlocks.length > 0);
  entriesWithData.slice(0, 5).forEach((entry, idx) => {
    console.log(`--- Entry ${idx + 1} ---`);
    console.log(`College: [${entry.collegeCode}] ${entry.collegeName}`);
    console.log(`Branch:  [${entry.branchCode}] ${entry.branchName}`);
    console.log(`Type:    ${entry.collegeType}`);
    console.log(`Home University: ${entry.homeUniversity}`);
    console.log(`Seat Blocks: ${entry.seatBlocks.length}`);
    entry.seatBlocks.forEach(sb => {
      console.log(`  📌 ${sb.seatBlockType}`);
      const catEntries = Object.entries(sb.categories);
      catEntries.slice(0, 4).forEach(([cat, data]) => {
        console.log(`     ${cat}: Merit=${data.stage1MeritNo}, Pct=${data.stage1Percentile}`);
      });
      if (catEntries.length > 4) {
        console.log(`     ... and ${catEntries.length - 4} more categories`);
      }
    });
    console.log();
  });

  // Entries without seat block data
  const emptyEntries = results.filter(r => r.seatBlocks.length === 0);
  if (emptyEntries.length > 0) {
    console.log(`⚠️  ${emptyEntries.length} entries have no seat block data`);
    emptyEntries.slice(0, 3).forEach(e => {
      console.log(`   [${e.collegeCode}] ${e.collegeName} → ${e.branchName}`);
    });
  }

  console.log(`\n✅ Parser test complete\n`);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
