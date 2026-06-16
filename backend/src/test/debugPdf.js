/**
 * Debug Script — Extract raw text from the PDF and output first 500 lines
 * to understand the actual text format produced by pdf-parse.
 */

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function main() {
  const pdfPath = process.argv[2] || path.resolve(__dirname, '../../../2024ENGG_CAP1_CutOff.pdf');
  const pdfBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(pdfBuffer);

  const lines = data.text.split('\n');

  // Output first 300 lines
  console.log('=== FIRST 300 LINES OF RAW PDF TEXT ===\n');
  lines.slice(0, 300).forEach((line, idx) => {
    console.log(`[${String(idx + 1).padStart(4, '0')}] "${line}"`);
  });

  // Find and output lines around a known college to see pattern
  console.log('\n\n=== LINES AROUND "01002" (Government College) ===\n');
  lines.forEach((line, idx) => {
    if (line.includes('01002')) {
      for (let j = Math.max(0, idx - 2); j <= Math.min(lines.length - 1, idx + 30); j++) {
        console.log(`[${String(j + 1).padStart(4, '0')}] "${lines[j]}"`);
      }
      console.log('---');
    }
  });

  // Find lines with "Status"
  console.log('\n\n=== LINES CONTAINING "Status" (first 10) ===\n');
  let statusCount = 0;
  lines.forEach((line, idx) => {
    if (line.includes('Status') && statusCount < 10) {
      for (let j = Math.max(0, idx - 1); j <= Math.min(lines.length - 1, idx + 1); j++) {
        console.log(`[${String(j + 1).padStart(4, '0')}] "${lines[j]}"`);
      }
      console.log('---');
      statusCount++;
    }
  });

  // Find lines with "Stage"
  console.log('\n\n=== LINES CONTAINING "Stage" (first 10) ===\n');
  let stageCount = 0;
  lines.forEach((line, idx) => {
    if (line.includes('Stage') && stageCount < 10) {
      for (let j = Math.max(0, idx - 2); j <= Math.min(lines.length - 1, idx + 8); j++) {
        console.log(`[${String(j + 1).padStart(4, '0')}] "${lines[j]}"`);
      }
      console.log('---');
      stageCount++;
    }
  });

  // Find lines with "GOPENS"
  console.log('\n\n=== LINES CONTAINING "GOPENS" (first 10) ===\n');
  let gopensCount = 0;
  lines.forEach((line, idx) => {
    if (line.includes('GOPENS') && gopensCount < 10) {
      for (let j = Math.max(0, idx - 2); j <= Math.min(lines.length - 1, idx + 8); j++) {
        console.log(`[${String(j + 1).padStart(4, '0')}] "${lines[j]}"`);
      }
      console.log('---');
      gopensCount++;
    }
  });

  // Find lines with percentile format "(xx.xxx)"
  console.log('\n\n=== LINES CONTAINING PERCENTILES "(xx.xxx)" (first 10) ===\n');
  let pctCount = 0;
  lines.forEach((line, idx) => {
    if (/\(\d+\.\d+\)/.test(line) && pctCount < 10) {
      for (let j = Math.max(0, idx - 2); j <= Math.min(lines.length - 1, idx + 2); j++) {
        console.log(`[${String(j + 1).padStart(4, '0')}] "${lines[j]}"`);
      }
      console.log('---');
      pctCount++;
    }
  });
}

main().catch(console.error);
