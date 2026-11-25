export type ScoreRow = { wineId: string; vintageId: string | null; score: number };

/**
 * The score shown next to a wine someone drank: the vintage's own ratings
 * if there are any, otherwise the wine's (same rule as the bottle card).
 * Several ratings (separate ratings per member) are averaged, to one decimal.
 */
export function shownScore(ratings: ScoreRow[], wineId: string, vintageId: string | null): number | null {
  const ofWine = ratings.filter((r) => r.wineId === wineId);
  const ofVintage = vintageId ? ofWine.filter((r) => r.vintageId === vintageId) : [];
  const pick = ofVintage.length > 0 ? ofVintage : ofWine.filter((r) => r.vintageId === null);
  if (pick.length === 0) return null;
  return Math.round((pick.reduce((n, r) => n + r.score, 0) / pick.length) * 10) / 10;
}
