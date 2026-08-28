// /api/members-import.js
//
// Vercel serverless function for the MEMBERS tab's "Upload Screenshot" import.
// Mirrors /api/ocr-import.js (the VS tab's function) but:
//   1. Extracts { name, cp } instead of { name, tag, score }
//   2. Verifies the caller is logged in AND has role 'admin' or 'management'
//      before ever touching the Gemini key — the client-side role checks in
//      members.html are UI-only and don't stop someone from hitting this
//      endpoint directly, so this is the real enforcement point.
//
// 1. Set a GEMINI_API_KEY_MEMBERS env var (Project Settings -> Environment
//    Variables) using your separate Gemini key, so Members and VS draw from
//    independent free-tier quotas instead of sharing ocr-import.js's key.
// 2. Deploy this file at /api/members-import.js in your repo (same folder
//    as ocr-import.js).
// 3. In members.html, remove the client-side GEMINI_API_KEY constant and
//    POST to this endpoint instead (see accompanying members.html update).
//
// This uses plain fetch() against Supabase's REST/Auth endpoints instead of
// the @supabase/supabase-js package, so it doesn't add any new dependency
// to the project — same style as ocr-import.js.

const SUPABASE_URL = 'https://sqrrfslqwcgpsmzdovru.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rb70-VY2GstWzdoXmoUkwg_Iw3EiqFO';

async function getUserRole(accessToken) {
  // Step 1: resolve the access token to a user id.
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if (!user || !user.id) return null;

  // Step 2: look up that user's role in the accounts table.
  const accRes = await fetch(
    `${SUPABASE_URL}/rest/v1/accounts?select=role&user_id=eq.${user.id}`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`
      }
    }
  );
  if (!accRes.ok) return null;
  const rows = await accRes.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0].role || null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing Authorization bearer token' });
  }

  const role = await getUserRole(accessToken);
  if (!role) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  if (role !== 'admin' && role !== 'management') {
    return res.status(403).json({ error: 'Only admin or management members can use screenshot import' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server missing GEMINI_API_KEY' });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing imageBase64 in request body' });
  }

  const prompt = `You are reading a mobile game alliance member roster screenshot.
Extract every row you can see into a JSON array. Each row has:
- "name": the player/member in-game name, exactly as shown (may be Chinese, Korean, Vietnamese, English, or a mix, possibly with decorative symbols like • or °)
- "cp": the Combat Power value as a plain string exactly as displayed (e.g. "5,390,000,000" or "5.39B"), do not convert units yourself

Rules:
- Include every row visible, even partially cut-off ones at the top/bottom of the image.
- Do not include UI chrome like button labels, tab names, or timers.
- If a value is unreadable, use null for that field rather than guessing.
- Return ONLY a raw JSON array, no markdown fences, no commentary, no explanation.

Example output:
[{"name":"Airon-小兽","cp":"5,390,000,000"},{"name":"继国缘一","cp":"2.1B"}]`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`,
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

    const cleanRows = rows
      .filter(r => r && typeof r === 'object')
      .map(r => ({
        name: typeof r.name === 'string' ? r.name.trim() : '',
        cp: typeof r.cp === 'string' ? r.cp.trim() : (r.cp != null ? String(r.cp) : '')
      }))
      .filter(r => r.name);

    return res.status(200).json({ rows: cleanRows, raw: rawText });
  } catch (err) {
    console.error('Members import handler error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: String(err) });
  }
}
