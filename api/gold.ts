import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(
      'https://finance.naver.com/marketindex/goldDailyQuote.naver',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const html = await response.text();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/html; charset=euc-kr');
    res.status(200).send(html);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch gold data' });
  }
}
