// Supabase → Cloudflare KV 데이터 마이그레이션
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://gvalfmtmslnykmwegwfi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWxmbXRtc2xueWttd2Vnd2ZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NTc2MTQsImV4cCI6MjA3ODQzMzYxNH0.kLOgm2ag31ZW3qD-AmVsp-yK2aCZcvIeU-Xn6D-wElw';
const TABLE = 'kv_store_cee564ea';
const WORKER_URL = 'https://asset-dashboard-api.jilliankim200.workers.dev';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  console.log('[migrate] Supabase에서 데이터 읽는 중...');

  const { data, error } = await supabase.from(TABLE).select('key, value');
  if (error) { console.error(error); process.exit(1); }

  console.log(`[migrate] ${data.length}개 키 발견: ${data.map(d => d.key).join(', ')}`);

  for (const { key, value } of data) {
    console.log(`[migrate] ${key} → Cloudflare KV 저장 중...`);
    const res = await fetch(`${WORKER_URL}/kv/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      console.error(`  실패: ${res.status}`);
    } else {
      const size = JSON.stringify(value).length;
      console.log(`  완료 (${Math.round(size / 1024)}KB)`);
    }
  }

  console.log('[migrate] 완료! 검증 중...');

  for (const { key } of data) {
    const res = await fetch(`${WORKER_URL}/kv/${key}`);
    const val = await res.json();
    if (val) {
      const count = Array.isArray(val) ? `${val.length}건` : '저장됨';
      console.log(`  ✓ ${key}: ${count}`);
    } else {
      console.error(`  ✗ ${key}: 데이터 없음`);
    }
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
