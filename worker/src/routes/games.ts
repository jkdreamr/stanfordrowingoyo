import { addDays, today, weekStart } from '../../../shared/dates';
import type { Context } from '../context';
import { refreshUser } from '../auth/guards';
import { toPublicUser, type UserRow } from '../db/users';
import { HttpError, json, readJson } from '../http';
import * as v from '../validate';
import { oyoGameAccess, requireGameAccess, requireGameFinished } from '../games/access';
import { GAMES, type ServerGame } from '../games/registry';
import { toGameResult, type ResultRow } from '../db/games';

export function gameRoutes(registry: Record<string, ServerGame>) {
  function game(ctx: Context) {
    const id = ctx.params.game;
    if (!/^[a-z][a-z0-9-]{1,31}$/.test(id) || !Object.hasOwn(registry, id))
      throw new HttpError(404, 'NOT_FOUND', 'Game not found.');
    return registry[id];
  }
  function date(ctx: Context) {
    const value = new URL(ctx.request.url).searchParams.get('date');
    const result = value === null ? today(ctx.now) : v.date(value);
    if (result > today(ctx.now)) v.invalid('Date cannot be in the future.');
    return result;
  }
  function mine(ctx: Context, gameId: string, day: string, userId: string) {
    const row = ctx.storage.sql
      .exec<ResultRow>(
        'SELECT * FROM game_results WHERE game_id=? AND date=? AND user_id=?',
        gameId,
        day,
        userId,
      )
      .toArray()[0];
    return row ? toGameResult(row) : null;
  }
  return {
    list(ctx: Context) {
      const user = refreshUser(ctx),
        day = today(ctx.now);
      return json({
        date: day,
        access: oyoGameAccess(ctx.storage, user, day),
        games: Object.values(registry).map(({ id, direction }) => ({ id, direction })),
        results: ctx.storage.sql
          .exec<ResultRow>(
            'SELECT * FROM game_results WHERE user_id=? AND date=? AND game_id IN (SELECT value FROM json_each(?))',
            user.id,
            day,
            JSON.stringify(Object.keys(registry)),
          )
          .toArray()
          .map(toGameResult),
      });
    },
    access(ctx: Context) {
      const user = refreshUser(ctx);
      return json(oyoGameAccess(ctx.storage, user, today(ctx.now)));
    },
    async submit(ctx: Context) {
      refreshUser(ctx);
      const selected = game(ctx);
      const body = await readJson(ctx.request);
      const result = ctx.storage.transactionSync(() => {
        const user = refreshUser(ctx),
          day = today(ctx.now);
        requireGameAccess(ctx, user, day);
        if (!selected.score)
          throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Use this game’s own submit endpoint.');
        if (mine(ctx, selected.id, day, user.id))
          throw new HttpError(409, 'ALREADY_PLAYED', 'Already played today.');
        const scored = selected.score(body.payload, ctx, day);
        if (!Number.isSafeInteger(scored.score)) v.invalid('Score must be a safe integer.');
        const payload = JSON.stringify(scored.payload);
        if (payload === undefined) v.invalid('Result payload must be JSON.');
        const now = ctx.now.toISOString();
        ctx.storage.sql.exec(
          'INSERT INTO game_results VALUES (?,?,?,?,?,?,?)',
          selected.id,
          day,
          user.id,
          scored.score,
          payload,
          now,
          now,
        );
        return mine(ctx, selected.id, day, user.id);
      });
      return json(result, 201);
    },
    me(ctx: Context) {
      const user = refreshUser(ctx),
        selected = game(ctx);
      return json(mine(ctx, selected.id, date(ctx), user.id));
    },
    day(ctx: Context) {
      const user = refreshUser(ctx),
        selected = game(ctx),
        day = date(ctx);
      requireGameFinished(ctx, user, selected.id, day);
      const ranked = ctx.storage.sql
        .exec<UserRow & { score: number; rank: number }>(
          `SELECT u.*,r.score,RANK() OVER (ORDER BY r.score ${selected.direction === 'lower' ? 'ASC' : 'DESC'}) AS rank FROM game_results r JOIN users u ON u.id=r.user_id WHERE r.game_id=? AND r.date=? AND u.active=1 ORDER BY rank,u.name,u.id`,
          selected.id,
          day,
        )
        .toArray();
      return json({
        game_id: selected.id,
        date: day,
        final: day < today(ctx.now),
        players: ranked.length,
        rows: ranked.map(({ score, rank, ...row }) => ({
          score,
          rank,
          user: toPublicUser(row),
          me: row.id === user.id,
        })),
      });
    },
    week(ctx: Context) {
      const user = refreshUser(ctx);
      const value = new URL(ctx.request.url).searchParams.get('week');
      const start = weekStart(value === null ? today(ctx.now) : v.date(value));
      if (start > weekStart(today(ctx.now))) v.invalid('Week cannot be in the future.');
      const lower = Object.values(registry)
        .filter((g) => g.direction === 'lower')
        .map((g) => g.id);
      const ranked = ctx.storage.sql
        .exec<UserRow & { points: number; days: number; rank: number }>(
          `WITH placements AS (
          SELECT r.user_id,r.date,COUNT(*) OVER (PARTITION BY game_id,date) AS players,
            RANK() OVER (PARTITION BY game_id,date ORDER BY CASE WHEN game_id IN (SELECT value FROM json_each(?)) THEN -score ELSE score END DESC) AS place
          FROM game_results r JOIN users u ON u.id=r.user_id
          WHERE u.active=1 AND r.date BETWEEN ? AND ? AND game_id IN (SELECT value FROM json_each(?))
        ), totals AS (
          SELECT user_id,SUM(players-place+1) AS points,COUNT(DISTINCT date) AS days FROM placements GROUP BY user_id
        ) SELECT u.*,t.points,t.days,RANK() OVER (ORDER BY points DESC) AS rank FROM totals t JOIN users u ON u.id=t.user_id ORDER BY rank,days DESC,u.name,u.id`,
          JSON.stringify(lower),
          start,
          addDays(start, 6),
          JSON.stringify(Object.keys(registry)),
        )
        .toArray();
      return json({
        week_start: start,
        rows: ranked.map(({ points, days, rank, ...row }) => ({
          points,
          days,
          rank,
          user: toPublicUser(row),
          me: row.id === user.id,
        })),
      });
    },
  };
}
export const { list, access, submit, me, day, week } = gameRoutes(GAMES);
