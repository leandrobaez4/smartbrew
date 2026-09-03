import { PrismaClient } from '@prisma/client';
import { ImportForm } from './ImportForm';
import { Loader2, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export default async function ImportsPage() {
  const jobs = await prisma.htmlImportJob.findMany({
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HTML Imports</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel de Subida */}
        <div className="md:col-span-1">
          <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Subir Archivo de Búsqueda</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Navegá a Mercado Libre, realizá una búsqueda, guardá la página completa como HTML (Ctrl+S) y subí el archivo aquí.
            </p>
            <ImportForm />
          </div>
        </div>

        {/* Panel de Historial */}
        <div className="md:col-span-2">
          <div className="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950/50">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historial de Importación</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-950/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Archivo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Resultados</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(job.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 font-medium truncate max-w-xs" title={job.filename}>
                        {job.filename}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          {job.status === 'PENDING' && <Clock size={16} className="text-gray-400 dark:text-gray-500" />}
                          {job.status === 'PROCESSING' && <Loader2 size={16} className="text-blue-500 dark:text-blue-400 animate-spin" />}
                          {job.status === 'COMPLETED' && <CheckCircle size={16} className="text-green-500 dark:text-green-400" />}
                          {job.status === 'ERROR' && <AlertTriangle size={16} className="text-red-500 dark:text-red-400" />}
                          
                          <span className={`text-sm font-semibold
                            ${job.status === 'PENDING' ? 'text-gray-600 dark:text-gray-400' : ''}
                            ${job.status === 'PROCESSING' ? 'text-blue-600 dark:text-blue-400' : ''}
                            ${job.status === 'COMPLETED' ? 'text-green-600 dark:text-green-400' : ''}
                            ${job.status === 'ERROR' ? 'text-red-600 dark:text-red-400' : ''}
                          `}>
                            {job.status}
                          </span>
                        </div>
                        {job.status === 'ERROR' && job.errorMessage && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1 truncate max-w-xs" title={job.errorMessage}>
                            {job.errorMessage}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{job.productsFound}</span> detectados<br/>
                        <span className="font-medium text-green-600 dark:text-green-400">{job.productsImported}</span> candidatos
                      </td>
                    </tr>
                  ))}
                  
                  {jobs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        No hay importaciones registradas. Subí un archivo HTML para comenzar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
