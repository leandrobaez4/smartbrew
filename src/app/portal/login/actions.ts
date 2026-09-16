'use server';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { redirect } from 'next/navigation';
import { portalDb, startPortalSession } from '@/lib/portal';
import { hashSecret } from '@/lib/portal-crypto';

export async function portalLogin(_state: { error: string }, form: FormData) {
  const parsed = z.object({ email: z.string().email().max(254), password: z.string().min(12).max(128), code: z.string().max(64) }).safeParse({ email: String(form.get('email') || '').trim().toLowerCase(), password: form.get('password'), code: String(form.get('code') || '').trim() });
  const failure = { error: 'Acceso inválido o temporalmente bloqueado. Revisá los datos o consultá al administrador.' };
  if (!parsed.success) return failure;
  const { email, password, code } = parsed.data;
  const member = await portalDb.portalMember.findUnique({ where: { email } });
  if (!member || member.disabled || member.reviewExpiresAt) return failure;
  // Database-backed limit; increment atomically before expensive password verification.
  const now = new Date();
  await portalDb.portalMember.updateMany({ where: { id: member.id, OR: [{ loginWindowEnd: null }, { loginWindowEnd: { lte: now } }] }, data: { loginAttempts: 0, loginWindowEnd: new Date(Date.now() + 15 * 60000) } });
  const admitted = await portalDb.portalMember.updateMany({ where: { id: member.id, disabled: false, loginAttempts: { lt: 5 } }, data: { loginAttempts: { increment: 1 } } });
  if (!admitted.count) return failure;
  if (code) {
    if (!/^[a-f0-9]{64}$/.test(code) || member.passwordHash || member.inviteHash !== hashSecret(code) || !member.inviteExpiresAt || member.inviteExpiresAt <= now) return failure;
    const passwordHash = await argon2.hash(password);
    const used = await portalDb.portalMember.updateMany({ where: { id: member.id, inviteHash: hashSecret(code), passwordHash: null, disabled: false, inviteExpiresAt: { gt: new Date() } }, data: { passwordHash, inviteHash: null, inviteExpiresAt: null } });
    if (!used.count) return failure;
  } else if (!member.passwordHash || !await argon2.verify(member.passwordHash, password)) return failure;
  await startPortalSession(member.id);
  redirect('/portal/instagram');
}
