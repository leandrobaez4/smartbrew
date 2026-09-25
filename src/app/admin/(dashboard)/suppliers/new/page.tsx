import SupplierForm from '../SupplierForm';
import { createSupplierAction } from '../actions';

export default async function NewSupplierPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <div className="mx-auto max-w-4xl"><h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Nuevo proveedor</h1><SupplierForm action={createSupplierAction} error={error} /></div>;
}
