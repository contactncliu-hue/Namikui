export function parseCpWithCommas(cpStr: string | undefined): { formatted: string; raw: number } {
  if (!cpStr) return { formatted: '0', raw: 0 };
  const cleanStr = cpStr.toString().trim();
  const numVal = parseFloat(cleanStr.replace(/[^0-9.]/g, '')) || 0;
  const formatted = numVal.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return { formatted, raw: numVal };
}

export function parseCpToRaw(cpStr: string | undefined): { formatted: string; raw: number } {
  if (!cpStr) return { formatted: '0G', raw: 0 };
  const cleanStr = cpStr.toString().trim().toUpperCase();
  const numVal = parseFloat(cleanStr.replace(/[^0-9.]/g, '')) || 0;
  const isExplicitG = cleanStr.includes('G');
  const isExplicitM = cleanStr.includes('M');
  let raw = 0;
  if (isExplicitG) {
    raw = numVal * 1000000000;
  } else if (isExplicitM) {
    raw = numVal * 1000000;
  } else if (numVal >= 0 && numVal <= 999 && !cleanStr.includes('.')) {
    raw = numVal * 1000000;
  } else {
    raw = numVal * 1000000000;
  }
  let formatted: string;
  if (raw >= 1000000000) {
    const gVal = raw / 1000000000;
    formatted = gVal % 1 === 0 ? gVal.toLocaleString() + 'G' : gVal.toFixed(1).replace(/\.0$/, '') + 'G';
  } else {
    const mVal = raw / 1000000;
    formatted = mVal % 1 === 0 ? mVal.toLocaleString() + 'M' : mVal.toFixed(1).replace(/\.0$/, '') + 'M';
  }
  return { formatted, raw };
}

export function nowStamp(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 16);
}

export const RANK_GROUP_ORDER: Record<string, number> = { R5: 0, R4: 1, R3: 2, R2: 3, R1: 4 };
