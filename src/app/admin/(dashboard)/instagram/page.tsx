import { portalDb, requireAdmin } from '@/lib/portal';
import InviteForm from './invite-form';
import { revokeMember } from './actions';
export const dynamic = 'force-dynamic';
export default async function InstagramAdmin() {
  await requireAdmin();
  const members = await portalDb.portalMember.findMany({ select: { id: true, email: true, disabled: true, inviteExpiresAt: true, createdAt: true, connection: { select: { username: true, instagramId: true, expiresAt: true, updatedAt: true } } }, orderBy: { createdAt: 'desc' } });
  const connected = members.filter(m => m.connection);
  const date = (value: Date) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(value);
  return <section className="max-w-6xl space-y-6">
    <h1 className="text-2xl font-bold">Accesos a Instagram</h1>
    <p>Invitaciones al portal aislado. No otorgan acceso al admin ni modifican la automatización de SmartBrew.</p>
    <a className="underline" href="/portal/login">Abrir portal de invitados</a>
    <InviteForm />
    <h2 className="text-xl font-semibold">Cuentas de Instagram conectadas ({connected.length})</h2>
    <p className="text-sm">Conexiones guardadas en el portal. El vencimiento no verifica si Meta revocó el permiso. No incluye la cuenta del bot configurada por variables de entorno.</p>
    {connected.length === 0 ? <p>Todavía no hay cuentas conectadas mediante el portal.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr>{['Usuario del portal', 'Instagram', 'ID de Instagram', 'Estado del token', 'Última actualización', 'Vencimiento'].map(label => <th key={label} className="p-3 border-b">{label}</th>)}</tr></thead>
      <tbody>{connected.map(m => <tr key={m.id}>
        <td className="p-3 border-b">{m.email}</td><td className="p-3 border-b">@{m.connection!.username}</td><td className="p-3 border-b">{m.connection!.instagramId}</td>
        <td className="p-3 border-b">{m.connection!.expiresAt <= new Date() ? 'Vencido: reconectar' : 'No vencido'}</td>
        <td className="p-3 border-b">{date(m.connection!.updatedAt)}</td><td className="p-3 border-b">{date(m.connection!.expiresAt)}</td>
      </tr>)}</tbody></table></div>}
    <h2 className="text-xl font-semibold">Todos los accesos ({members.length})</h2>
    {members.length === 0 && <p>No hay usuarios invitados.</p>}
    {members.map(m => <div key={m.id} className="border rounded p-4 flex flex-wrap justify-between gap-3"><span>{m.email} · {m.disabled ? 'Revocado' : 'Habilitado'}</span>
      {!m.disabled && <form action={revokeMember}><input type="hidden" name="memberId" value={m.id} /><button type="submit" className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-red-700 bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-red-800 hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">Revocar acceso y eliminar conexión guardada</button></form>}
    </div>)}
  </section>;
}
