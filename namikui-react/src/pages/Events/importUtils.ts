// Fuzzy name matching + OCR helpers, ported from the old vspoint.html import flow.

export function levenshteinDistance(a: string, b: string): number {
  a = a || ''; b = b || '';
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }
  return matrix[a.length][b.length];
}

export function normalizeForMatch(str: string): string {
  if (!str) return '';
  return str.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[•°´˙‧·|›»«"'`]/g, '').replace(/\s+/g, ' ').trim();
}

export function nameSimilarity(a: string, b: string): number {
  const normA = normalizeForMatch(a).toLowerCase();
  const normB = normalizeForMatch(b).toLowerCase();
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  const dist = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return 1 - dist / maxLen;
}

export function findBestMemberMatch<T extends { name: string }>(candidateName: string, memberList: T[]): { member: T | null; score: number } {
  let best: T | null = null;
  let bestScore = 0;
  memberList.forEach((m) => {
    const score = nameSimilarity(candidateName, m.name);
    if (score > bestScore) { bestScore = score; best = m; }
  });
  return { member: best, score: bestScore };
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface OcrEventsResult {
  war_event?: string;
  member_names: string[];
  raw?: string;
}

export async function callEventsOcrWithRetry(
  imageBase64: string,
  mimeType: string,
  fileLabel: string,
  onStatus?: (msg: string) => void,
  maxRetries = 3
): Promise<OcrEventsResult> {
  let attempt = 0;
  while (true) {
    const resp = await fetch('/api/events-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
    });
    if (resp.ok) return await resp.json();
    if (resp.status === 429 && attempt < maxRetries) {
      attempt++;
      const waitMs = 8000 * attempt;
      onStatus?.(`Rate limited, waiting ${waitMs / 1000}s before retrying ${fileLabel}… (${attempt}/${maxRetries})`);
      await sleep(waitMs);
      continue;
    }
    const errBody = await resp.json().catch(() => ({}));
    throw new Error(`${fileLabel}: ${errBody.error || (resp.status === 429 ? 'Rate limited — try fewer screenshots at once.' : `Server returned ${resp.status}`)}`);
  }
}
