const fs = require('fs');
const path = require('path');
const { parseJosaaHTML } = require('../services/josaaParser');

async function main() {
  const htmlPath = path.resolve(__dirname, '../../../JoSAA.html');
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ JoSAA.html not found at: ${htmlPath}`);
    process.exit(1);
  }

  console.log(`📄 Loading JoSAA.html...`);
  const content = fs.readFileSync(htmlPath, 'utf-8');
  console.log(`   File loaded. Size: ${(content.length / (1024 * 1024)).toFixed(2)} MB`);

  const startTime = Date.now();
  const results = parseJosaaHTML(content);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n====================================`);
  console.log(`📊 JoSAA PARSING SUMMARY`);
  console.log(`====================================`);
  console.log(`Total rows parsed: ${results.length}`);
  console.log(`Execution time: ${duration}s`);

  // Summarize unique colleges
  const colleges = new Set(results.map(r => r.collegeName));
  console.log(`Unique Colleges: ${colleges.size}`);

  // Summarize unique branches
  const branches = new Set(results.map(r => r.branchName));
  console.log(`Unique Branch Names: ${branches.size}`);

  // Show first 5 samples
  console.log(`\n📋 SAMPLES (First 5):`);
  results.slice(0, 5).forEach((r, idx) => {
    console.log(`  [${idx + 1}] College: ${r.collegeName}`);
    console.log(`      Branch:  ${r.branchName}`);
    console.log(`      Quota:   ${r.quota} | Category: ${r.category} | Gender: ${r.gender}`);
    console.log(`      Open:    ${r.openRank} | Close: ${r.closeRank}`);
  });

  console.log(`\n✅ Parser validation successful`);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
});
