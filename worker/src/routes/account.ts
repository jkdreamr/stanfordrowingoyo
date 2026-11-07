import type { Context } from '../context';
import { refreshUser, requireAdmin, requireUser } from '../auth/guards';
import { accountExport, removeAccount, workoutsCsv } from '../db/account';
import { audit } from '../db/audit';
import { byId } from '../db/users';
import { today } from '../../../shared/dates';
import { HttpError, noContent, readJson } from '../http';
import * as v from '../validate';

function download(body: string, type: string, filename: string) {
  return new Response(body, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function exportData(ctx: Context) {
  const user = requireUser(ctx);
  return download(
    JSON.stringify(accountExport(ctx.storage, user, ctx.now.toISOString())),
    'application/json; charset=utf-8',
    `oyo-my-data-${today(ctx.now)}.json`,
  );
}
export function exportWorkouts(ctx: Context) {
  const user = requireUser(ctx);
  return download(
    workoutsCsv(ctx.storage, user.id),
    'text/csv; charset=utf-8',
    `oyo-my-workouts-${today(ctx.now)}.csv`,
  );
}
export async function removeUser(ctx: Context) {
  const body = await readJson(ctx.request);
  ctx.storage.transactionSync(() => {
    refreshUser(ctx);
    const actor = requireAdmin(ctx);
    const target = byId(ctx.storage, ctx.params.id);
    if (!target) throw new HttpError(404, 'NOT_FOUND', 'Record not found.');
    if (target.id === actor.id)
      throw new HttpError(409, 'CONFLICT', 'You cannot remove your own account.');
    if (target.role !== 'rower')
      throw new HttpError(409, 'CONFLICT', 'Only rower accounts can be removed.');
    const confirmation = v.string(body.confirmation_email, 'Confirmation email', 1, 254, true);
    if (confirmation.toLowerCase() !== target.email.toLowerCase())
      throw new HttpError(
        400,
        'CONFIRMATION_MISMATCH',
        "Type the rower's account email exactly to confirm removal.",
      );
    const removed = removeAccount(ctx.storage, target);
    audit(
      ctx,
      'user.remove',
      target.id,
      { role: target.role, active: !!target.active },
      { removed },
    );
  });
  return noContent();
}
