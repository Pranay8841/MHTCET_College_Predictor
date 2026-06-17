const fs = require('fs');
const path = require('path');
const { parseJosaaHTML } = require('../services/josaaParser');
const { saveJosaaCutoffsToSupabase } = require('../services/supabaseService');
const { supabase } = require('../supabaseClient');

async function main() {
  const htmlPath = path.resolve(__dirname, '../../../JoSAA.html');
  if (!fs.existsSync(htmlPath)) {
    console.error(`❌ JoSAA.html not found at: ${htmlPath}`);
    process.exit(1);
  }

  const roundName = 'JoSAA Round 1';
  const year = '2024';
  const roundId = `${year}_${roundName.replace(/\s+/g, '_')}`;

  console.log(`📄 Loading JoSAA.html...`);
  const content = fs.readFileSync(htmlPath, 'utf-8');
  console.log(`   File loaded. Size: ${(content.length / (1024 * 1024)).toFixed(2)} MB`);

  console.log(`⏳ Parsing HTML...`);
  const parsedData = parseJosaaHTML(content);
  console.log(`   Found ${parsedData.length} entries`);

  // Create metadata doc in Supabase
  if (supabase) {
    console.log(`Creating metadata for ${roundId}...`);
    await supabase.from('rounds_metadata').upsert({
      round_id: roundId,
      round_name: roundName,
      year,
      uploaded_at: new Date().toISOString(),
      cloudinary_url: '',
      status: 'processing',
      total_colleges: 0,
      total_branches: 0
    });

    console.log(`Saving to Supabase...`);
    const { totalColleges, totalBranches } = await saveJosaaCutoffsToSupabase(parsedData, roundId, year);

    await supabase.from('rounds_metadata').upsert({
      round_id: roundId,
      round_name: roundName,
      year,
      status: 'ready',
      total_colleges: totalColleges,
      total_branches: totalBranches,
      processed_at: new Date().toISOString()
    });

    console.log(`✅ JoSAA round data successfully loaded and metadata marked as ready!`);
  } else {
    console.error('❌ Supabase not initialized.');
  }
}

main().catch(err => {
  console.error('❌ Seeding failed:', err);
});
