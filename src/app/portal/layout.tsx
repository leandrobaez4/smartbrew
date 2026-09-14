import Link from 'next/link';
export const metadata = { title: 'Conectar Instagram | SmartBrew', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-950 text-slate-100 px-5 py-12"><div className="max-w-xl mx-auto space-y-6"><p className="text-cyan-400 font-bold text-xl">SmartBrew · Instagram</p>{children}<footer className="text-sm text-slate-400"><Link href="/politica-de-privacidad" className="underline">Política de privacidad</Link></footer></div></main>;
}
