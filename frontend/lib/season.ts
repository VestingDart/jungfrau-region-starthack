export type Season = 'summer' | 'winter';

// April–October = summer, November–March = winter
export function getAutoSeason(): Season {
  const month = new Date().getMonth() + 1;
  return month >= 4 && month <= 10 ? 'summer' : 'winter';
}

export function getStoredSeason(): Season {
  if (typeof window === 'undefined') return getAutoSeason();
  const v = localStorage.getItem('jfr-season') as Season | null;
  if (v === 'summer' || v === 'winter') return v;
  return getAutoSeason();
}

export function storeSeason(s: Season): void {
  localStorage.setItem('jfr-season', s);
}
