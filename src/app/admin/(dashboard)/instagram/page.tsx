import { portalDb, requireAdmin } from '@/lib/portal';
import InviteForm from './invite-form';
import { revokeMember } from './actions';
export const dynamic = 'force-dynamic';
export default async function InstagramAdmin() {
  await requireAdmin();
  const members = await portalDb.portalMember.findMany({ select: { id: true, email: true, disabled: true, passwordHash: false, inviteExpiresAt: true }, orderBy: { createdAt: 'desc' } });
  return <section className="max-w-3xl space-y-6">
    <h1 className="text-2xl font-bold">Accesos a Instagram</h1>
    <p>Invitaciones al portal aislado. No otorgan acceso al admin ni modifican la automatización de SmartBrew.</p>
    <a className="underline" href="/portal/login">Abrir portal de invitados</a>
    <InviteForm />
    {members.map(m => <div key={m.id} className="border rounded p-4 flex flex-wrap justify-between gap-3"><span>{m.email} · {m.disabled ? 'Revocado' : 'Habilitado'}</span>
      {!m.disabled && <form action={revokeMember}><input type="hidden" name="memberId" value={m.id} /><button className="text-red-500">Revocar acceso y eliminar conexión guardada</button></form>}
    </div>)}
  </section>;
}
