import { RankingCriteria } from '@prisma/client';

export interface RankedAttempt {
  id: number;
  score: number;
  timeTaken: number | null;
  completedAt: Date | null;
  student: {
    id: number;
    user: { name: string; avatar: string | null };
  };
}

/**
 * يرتب المحاولات حسب معيار التصنيف المحدد:
 * - SCORE: الدرجة الأعلى أولاً
 * - SPEED: الوقت الأقل أولاً
 * - BOTH: الدرجة الأعلى أولاً، ثم الوقت الأقل عند التعادل
 */
export function sortByRankingCriteria(
  attempts: RankedAttempt[],
  criteria: RankingCriteria,
): RankedAttempt[] {
  return [...attempts].sort((a, b) => {
    if (criteria === RankingCriteria.SCORE) {
      return b.score - a.score;
    }

    if (criteria === RankingCriteria.SPEED) {
      const aTime = a.timeTaken ?? Infinity;
      const bTime = b.timeTaken ?? Infinity;
      return aTime - bTime;
    }

    // BOTH: الدرجة أولاً، ثم الوقت (بالميلي ثانية للدقة العالية)
    if (b.score !== a.score) return b.score - a.score;
    const aTime = a.timeTaken ?? Infinity;
    const bTime = b.timeTaken ?? Infinity;
    return aTime - bTime;
  });
}

/**
 * يحسب مستوى الدرجة بناءً على النسبة المئوية
 */
export function getGradeLabel(
  score: number,
  totalPoints: number,
): 'excellent' | 'veryGood' | 'good' | 'acceptable' | 'failed' {
  if (totalPoints === 0) return 'failed';
  const pct = (score / totalPoints) * 100;
  if (pct >= 90) return 'excellent';
  if (pct >= 75) return 'veryGood';
  if (pct >= 60) return 'good';
  if (pct >= 50) return 'acceptable';
  return 'failed';
}
