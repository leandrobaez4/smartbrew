import Image from 'next/image';
import Link from 'next/link';
import {
  Bell,
  Camera,
  ChartNoAxesCombined,
  FileText,
  Layers3,
  Package,
  Settings,
  Share2,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { logoutAction } from './login/actions';

const navigation: Array<{ href: string; label: string; icon: LucideIcon; accent?: boolean }> = [
  { href: '/admin/instagram', label: 'Accesos a Instagram', icon: Camera, accent: true },
  { href: '/admin/products', label: 'Productos', icon: Package },
  { href: '/admin/suppliers', label: 'Proveedores', icon: Truck },
  { href: '/dashboard/opportunities', label: 'Oportunidades', icon: ChartNoAxesCombined },
  { href: '/dashboard/dropshipping', label: 'Dashboard Dropshipping', icon: ChartNoAxesCombined },
  { href: '/admin/orders', label: 'Órdenes', icon: ShoppingCart },
  { href: '/dashboard/alerts', label: 'Alertas', icon: Bell },
  { href: '/admin/settings/dropshipping', label: 'Settings / Dropshipping', icon: Settings },
  { href: '/admin/collections', label: 'Colecciones', icon: Layers3 },
  { href: '/admin/imports', label: 'Importaciones HTML', icon: FileText },
  { href: '/admin/drafts', label: 'Borradores', icon: FileText },
  { href: '/admin/publications', label: 'Publicaciones', icon: Share2 },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen bg-gray-100 transition-colors dark:bg-gray-950">
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white shadow-md dark:border-gray-800 dark:bg-gray-900 md:flex">
      <div className="flex items-center space-x-3 border-b border-gray-200 p-4 dark:border-gray-800">
        <Image src="/logo.jpg" alt="SmartBrew Logo" width={32} height={32} className="h-8 w-8 rounded-full object-cover shadow-sm" />
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">SmartBrew Admin</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navigation.map(({ href, label, icon: Icon, accent }) => <Link
          key={href}
          href={href}
          className={`flex items-center space-x-2 rounded-md p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${accent ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}
        >
          <Icon size={20} className="shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </Link>)}
        <Link href="/admin/logs" className="flex items-center space-x-2 rounded-md p-2 text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
          <span>Registros del Sistema</span>
        </Link>
      </nav>
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <form action={logoutAction}>
          <button type="submit" className="w-full text-left text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">Cerrar sesión</button>
        </form>
      </div>
    </aside>
    <main className="min-w-0 flex-1 overflow-auto p-4 text-black dark:text-gray-100 sm:p-6 lg:p-8">
      {children}
    </main>
  </div>;
}
