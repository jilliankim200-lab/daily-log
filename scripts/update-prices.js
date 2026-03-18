// 매일 실행: Supabase의 etf_ranking 데이터에서 각 ETF 현재가를 네이버 금융에서 업데이트
const { createClient } = require('./node_modules/@supabase/supabase-js' in {} ? '@supabase/supabase-js' : '../node_modules/@supabase/supabase-js');

let supabase;
try {
  const { createClient: cc } = require('../node_modules/@supabase/supabase-js');
  supabase = cc(
    'https://gvalfmtmslnykmwegwfi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWxmbXRtc2xueWttd2Vnd2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTc2MTQsImV4cCI6MjA3ODQzMzYxNH0.kLOgm2ag31ZW3qD-AmVsp-yK2aCZcvIeU-Xn6D-wElw'
  );
} catch {
  const { createClient: cc } = require('@supabase/supabase-js');
  supabase = cc(
    'https://gvalfmtmslnykmwegwfi.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWxmbXRtc2xueWttd2Vnd2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTc2MTQsImV4cCI6MjA3ODQzMzYxNH0.kLOgm2ag31ZW3qD-AmVsp-yK2aCZcvIeU-Xn6D-wElw'
  );
}

const TABLE = 'kv_store_cee564ea';

async function fetchPrice(ticker) {
  try {
    const url = `https://finance.naver.com/item/sise.naver?code=${ticker}`;
    const res = await fetch(url);
    const html = await res.text();
    // Extract current price from the page
    const match = html.match(/현재가\s*<\/th>\s*<td[^>]*>\s*<strong[^>]*>\s*([\d,]+)/);
    if (match) return parseInt(match[1].replace(/,/g, ''));

    // Alternative pattern
    const match2 = html.match(/<strong[^>]*id="_nowVal"[^>]*>([\d,]+)/);
    if (match2) return parseInt(match2[1].replace(/,/g, ''));

    // Try API
    const apiRes = await fetch(`https://m.stock.naver.com/api/stock/${ticker}/basic`);
    if (apiRes.ok) {
      const json = await apiRes.json();
      if (json.closePrice) return parseInt(String(json.closePrice).replace(/,/g, ''));
    }

    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Loading ETF ranking from Supabase...');
  const { data, error } = await supabase
    .from(TABLE)
    .select('value')
    .eq('key', 'etf_ranking')
    .maybeSingle();

  if (error || !data?.value?.data) {
    console.error('Failed to load ranking:', error);
    return;
  }

  const etfs = data.value.data;
  console.log(`Updating prices for ${etfs.length} ETFs...`);

  let updated = 0;
  for (const etf of etfs) {
    const price = await fetchPrice(etf.ticker);
    if (price && price > 0) {
      etf.price = price;
      updated++;
    }
    // Avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`Updated ${updated}/${etfs.length} prices`);

  // Save back
  const { error: saveErr } = await supabase.from(TABLE).upsert({
    key: 'etf_ranking',
    value: { ...data.value, priceUpdatedAt: new Date().toISOString(), data: etfs },
  });

  if (saveErr) console.error('Save error:', saveErr);
  else console.log('Prices saved to Supabase');

  // Show first 5 for verification
  etfs.slice(0, 5).forEach(e => {
    console.log(`  ${e.name} (${e.ticker}): ${e.price?.toLocaleString()}원`);
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
