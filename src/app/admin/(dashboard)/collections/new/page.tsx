import CollectionForm from '../CollectionForm';
import { createCollectionAction } from '../actions';

export default async function NewCollectionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">Nueva colección</h1>
      <CollectionForm action={createCollectionAction} error={error} />
    </div>
  );
}

