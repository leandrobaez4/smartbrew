import Link from 'next/link';
import { logoutAction } from '../login/actions';
import { Package, FileText, Share2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex transition-colors">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-900 shadow-md hidden md:flex flex-col border-r border-gray-200 dark:border-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-3">
          <img src="/logo.jpg" alt="SmartBrew Logo" className="w-8 h-8 rounded-full object-cover shadow-sm" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">SmartBrew Admin</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/admin/products" className="flex items-center space-x-2 p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <Package size={20} />
            <span>Products</span>
          </Link>
          <Link href="/admin/imports" className="flex items-center space-x-2 p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <FileText size={20} />
            <span>HTML Imports</span>
          </Link>
          <Link href="/admin/drafts" className="flex items-center space-x-2 p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <FileText size={20} />
            <span>Drafts</span>
          </Link>
          <Link href="/admin/publications" className="flex items-center space-x-2 p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <Share2 size={20} />
            <span>Publications</span>
          </Link>
          <Link href="/admin/logs" className="flex items-center space-x-2 p-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
            <span>System Logs</span>
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <form action={logoutAction}>
            <button type="submit" className="w-full text-left text-sm text-red-600 dark:text-red-400 font-medium hover:text-red-700 dark:hover:text-red-300">Log out</button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto text-black dark:text-gray-100">
        {children}
      </main>
    </div>
  );
}
