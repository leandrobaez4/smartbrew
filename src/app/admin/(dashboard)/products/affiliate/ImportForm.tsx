'use client';
import { useActionState } from 'react';
import { confirmAffiliateImport } from './actions';

export default function ImportForm({ data, existingLink }: { data: { url: string; affiliateUrl: string; title: string; image: string }; existingLink: string | null }) {
  const [state, action, pending] = useActionState(confirmAffiliateImport, { message: '' });
  return <form action={action} className="space-y-4">
    {Object.entries(data).map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
    <input type="hidden" name="expectedLink" value={existingLink || ''} />
    {existingLink && existingLink !== data.affiliateUrl && <label className="block"><input type="checkbox" name="replace" required /> Confirmo reemplazar el enlace actual: {existingLink}</label>}
    {existingLink === data.affiliateUrl && <input type="hidden" name="replace" value="on" />}
    <button disabled={pending} className="cursor-pointer rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{pending ? 'Enviando…' : 'Confirmar envío a SmartBrew'}</button>
    <p role="status">{state.message}</p>
  </form>;
}
