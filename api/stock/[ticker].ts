import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { ticker } = req.query;
  try {
    const response = await fetch(
      `https://polling.finance.naver.com/api/realtime/domestic/stock/${ticker}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
}
