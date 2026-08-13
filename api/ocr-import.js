// /api/ocr-import.js
//
// Vercel serverless function. Receives a base64-encoded screenshot from the
// browser, sends it to Gemini for vision-based extraction, and returns a
// clean JSON array of { name, tag, score } rows.
//
// SETUP:
// 1. Get a free Gemini API key: https://aistudio.google.com/apikey
// 2. In Vercel: Project Settings -> Environment Variables -> add
//    GEMINI_API_KEY = <your key>   (do NOT put this in client-side code)
// 3. Deploy. This file only needs to live at /api/ocr-import.js in your repo
//    root (or wherever your other Vercel functions live) — no extra config
//    needed for a simple Node serverless function.
//
// NOTE (Aug 2026): switched from gemini-3.6-flash back to gemini-2.5-flash.
// gemini-3.6-flash's free tier caps at just 20 requests/day per project
// (GenerateRequestsPerDayPerProjectPerModel-FreeTier), which is too low for
// regular screenshot-import use. gemini-2.5-flash has a much higher free
// daily quota and is more than capable for this OCR/extraction task — no
// need for the newest model here. If quotas change again, check
// https://ai.google.dev/gemini-api/docs/rate-limits for current numbers,
// or consider enabling billing on the Google Cloud project instead.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 in request body' });
  }

  const prompt = `You are reading a mobile game leaderboard/ranking screenshot.
Extract every row you can see into a JSON array. Each row has:
- "name": the player/member display name, exactly as shown (may be Chinese, Korean, Vietnamese, English, or a mix, possibly with decorative symbols like • or °)
- "tag": the alliance tag shown in brackets near the name, if visible (e.g. "z0.0"), otherwise empty string
- "score": the numeric score/points value as a plain integer (convert "23.2M" to 23200000, "800K" to 800000, remove commas)

Rules:
- Include every row visible, even partially cut-off ones at the top/bottom of the image.
- Do not include UI chrome like "View Rewards", tab labels, or timers.
- If a value is unreadable, use null for that field rather than guessing.
- Return ONLY a raw JSON array, no markdown fences, no commentary, no explanation.

Example output:
[{"name":"Airon-小兽","tag":"z0.0","score":23200000},{"name":"继国缘一","tag":"z0.0","score":12200000}]`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType || 'image/png',
                    data: imageBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Gemini API request failed', detail: errText });
    }

    const data = await geminiRes.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

    let rows;
    try {
      rows = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini response as JSON:', rawText);
      return res.status(502).json({ error: 'Gemini returned non-JSON output', raw: rawText });
    }

    if (!Array.isArray(rows)) rows = [];

    // Basic sanitation before handing back to the client.
    const cleanRows = rows
      .filter(r => r && typeof r === 'object')
      .map(r => ({
        name: typeof r.name === 'string' ? r.name.trim() : '',
        tag: typeof r.tag === 'string' ? r.tag.trim() : '',
        score: (typeof r.score === 'number' && isFinite(r.score)) ? Math.round(r.score) : null
      }))
      .filter(r => r.name || r.score !== null);

    return res.status(200).json({ rows: cleanRows, raw: rawText });
  } catch (err) {
    console.error('OCR import handler error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err) });
  }
}
