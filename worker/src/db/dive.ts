import type { DiveAnswerResult, DiveReveal } from '../../../shared/types';
import { divePoints } from '../../../shared/games/dive';
import { divePromptsFor } from '../games/divePrompts';

const counts = `WITH counts AS (
  SELECT prompt_index,normalized,COUNT(*) AS n FROM dive_answers
  WHERE date=? AND hidden_at IS NULL AND normalized<>'' GROUP BY prompt_index,normalized
), totals AS (SELECT prompt_index,SUM(n) AS n FROM counts GROUP BY prompt_index)`;

export function recomputeDive(storage: DurableObjectStorage, date: string, now: string) {
  storage.sql.exec(
    `${counts}, scores AS (
    SELECT a.user_id,COUNT(*) AS answered,SUM(CASE
      WHEN a.hidden_at IS NOT NULL OR a.normalized='' THEN 0
      WHEN c.n=1 THEN 100 WHEN c.n*10<=t.n THEN 75 WHEN c.n*4<=t.n THEN 50
      WHEN c.n*2<=t.n THEN 25 ELSE 10 END) AS score
    FROM dive_answers a LEFT JOIN counts c USING(prompt_index,normalized)
    LEFT JOIN totals t USING(prompt_index) WHERE a.date=? GROUP BY a.user_id
  ) UPDATE game_results SET score=COALESCE((SELECT score FROM scores WHERE user_id=game_results.user_id),0),
    payload_json=json_object('answered',COALESCE((SELECT answered FROM scores WHERE user_id=game_results.user_id),0)),
    updated_at=? WHERE game_id='dive' AND date=?`,
    date,
    date,
    now,
    date,
  );
}

export function diveAnswers(
  storage: DurableObjectStorage,
  date: string,
  userId: string,
): DiveAnswerResult[] {
  return storage.sql
    .exec<{ prompt_index: number; answer: string; count: number; total: number; hidden: number }>(
      `${counts}
    SELECT a.prompt_index,a.answer,CASE WHEN a.hidden_at IS NOT NULL THEN 0 ELSE COALESCE(c.n,0) END AS count,
      COALESCE(t.n,0) AS total,a.hidden_at IS NOT NULL AS hidden
    FROM dive_answers a LEFT JOIN counts c USING(prompt_index,normalized) LEFT JOIN totals t USING(prompt_index)
    WHERE a.date=? AND a.user_id=? ORDER BY a.prompt_index`,
      date,
      date,
      userId,
    )
    .toArray()
    .map((row) => ({
      ...row,
      hidden: !!row.hidden,
      ...divePoints(row.count, row.total, !!row.hidden),
    }));
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
      answer: string;
      count: number;
      total: number;
      hidden: number;
      mine: number;
    }>(
      `${counts}, ordered AS (
    SELECT *,ROW_NUMBER() OVER(PARTITION BY prompt_index,normalized ORDER BY created_at,user_id) AS ordinal
    FROM dive_answers WHERE date=? AND normalized<>''
  ), groups AS (
    SELECT prompt_index,normalized,MAX(CASE WHEN ordinal=1 THEN answer END) AS first_answer,
      MAX(CASE WHEN user_id=? THEN answer END) AS my_answer,COUNT(*) AS count,
      MAX(hidden_at IS NOT NULL) AS hidden,MAX(user_id=?) AS mine
    FROM ordered GROUP BY prompt_index,normalized
  ) SELECT g.prompt_index,g.normalized,CASE WHEN g.hidden AND NOT ? THEN g.my_answer ELSE g.first_answer END AS answer,
      CASE WHEN g.hidden AND NOT ? THEN 1 ELSE g.count END AS count,COALESCE(t.n,0) AS total,g.hidden,g.mine
    FROM groups g LEFT JOIN totals t USING(prompt_index) WHERE NOT g.hidden OR ? OR g.mine
    ORDER BY g.prompt_index,g.count DESC,g.normalized`,
      date,
      date,
      userId,
      userId,
      Number(staff),
      Number(staff),
      Number(staff),
    )
    .toArray();
  return divePromptsFor(date).map((prompt, prompt_index) => ({
    prompt_index,
    prompt,
    groups: rows
      .filter((row) => row.prompt_index === prompt_index)
      .map(({ prompt_index: _, total, ...row }) => ({
        ...row,
        hidden: !!row.hidden,
        mine: !!row.mine,
        ...divePoints(row.count, total, !!row.hidden),
      })),
  }));
}
