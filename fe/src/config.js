export const BE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
export const SK_SESSION = 'elf_sid';
export const SK_DICT = 'elf_dict';
export const PAGE_SIZE = 12;

export const norm = (v) => {
  const s = String(v ?? '').trim();
  return s === '' ? '' : /^-?\d+$/.test(s) ? Number(s) : s;
};

export const isDt = (n) => {
  const l = String(n).toLowerCase();
  return l === 'time_created' || l.includes('time') || l.includes('date');
};

export const fmtDt = (v) => (v ? v.replace('T', ' ') + ':00' : null);
