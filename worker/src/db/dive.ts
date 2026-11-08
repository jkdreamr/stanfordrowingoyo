import type { DiveAnswerResult, DiveReveal } from '../../../shared/types';
import { divePromptsFor } from '../games/divePrompts';
import { toGameResult, type ResultRow } from './games';

export function diveResult(storage: DurableObjectStorage, date: string, userId: string) {
  const row = storage.sql
    .exec<ResultRow>(
      "SELECT * FROM game_results WHERE game_id='dive' AND date=? AND user_id=?",
      date,
      userId,
    )
    .toArray()[0];
  return row ? toGameResult(row) : null;
}

export function diveAnswers(
  storage: DurableObjectStorage,
  date: string,
  userId: string,
): Omit<DiveAnswerResult, 'gem' | 'notable'>[] {
  return storage.sql
    .exec<{
      prompt_index: number;
      answer: string;
      canonical: string | null;
      tier: DiveAnswerResult['tier'];
      points: number;
      count: number;
      total: number;
      hidden: number;
    }>(
      `WITH counts AS (
      SELECT prompt_index,normalized,COUNT(*) AS n FROM dive_answers
      WHERE date=? AND hidden_at IS NULL GROUP BY prompt_index,normalized
    ), totals AS (SELECT prompt_index,SUM(n) AS n FROM counts GROUP BY prompt_index)
    SELECT a.prompt_index,a.answer,a.canonical,a.tier,a.points,
      CASE WHEN a.hidden_at IS NOT NULL THEN 0 ELSE COALESCE(c.n,0) END AS count,
      COALESCE(t.n,0) AS total,a.hidden_at IS NOT NULL AS hidden
    FROM dive_answers a LEFT JOIN counts c USING(prompt_index,normalized)
    LEFT JOIN totals t USING(prompt_index)
    WHERE a.date=? AND a.user_id=? ORDER BY a.prompt_index`,
      date,
      date,
      userId,
    )
    .toArray()
    .map((row) => ({ ...row, hidden: !!row.hidden }));
}

export function diveReveal(
  storage: DurableObjectStorage,
  date: string,
  userId: string,
  staff: boolean,
): DiveReveal[] {
  const rows = storage.sql
    .exec<{
      prompt_index: number;
      normalized: string;
      canonical: string | null;
      answer: string;
      count: number;
      points: number;
      tier: DiveAnswerResult['tier'];
      hidden: number;
      mine: number;
      group_count: number;
      teammates_json: string;
    }>(
      `WITH group_sizes AS (
      SELECT prompt_index,normalized,COUNT(*) AS n FROM dive_answers WHERE date=?
      GROUP BY prompt_index,normalized
    ) SELECT a.prompt_index,a.normalized,a.canonical,
      COALESCE(a.canonical,MIN(a.answer)) AS answer,COUNT(*) AS count,
      MAX(a.points) AS points,MIN(a.tier) AS tier,
      MAX(a.hidden_at IS NOT NULL) AS hidden,MAX(a.user_id=?) AS mine,
      MAX(g.n) AS group_count,
      json_group_array(json_object('user_id',u.id,'name',u.name)) AS teammates_json
    FROM dive_answers a JOIN users u ON u.id=a.user_id
    JOIN group_sizes g ON g.prompt_index=a.prompt_index AND g.normalized=a.normalized
    WHERE a.date=? AND (a.hidden_at IS NULL OR ? OR a.user_id=?)
    GROUP BY a.prompt_index,a.normalized,a.canonical
    ORDER BY a.prompt_index,count DESC,a.normalized`,
      date,
      userId,
      date,
      Number(staff),
      userId,
    )
    .toArray();
  return divePromptsFor(date).map((prompt, prompt_index) => ({
    prompt_index,
    prompt,
    groups: rows
      .filter((row) => row.prompt_index === prompt_index)
      .map(({ prompt_index: _, teammates_json, group_count, ...row }) => ({
        ...row,
        hidden: !!row.hidden,
        mine: !!row.mine,
        teammates: JSON.parse(teammates_json) as { user_id: string; name: string }[],
        only_you: !!row.mine && group_count === 1,
      })),
  }));
}
