import { portalDb } from '../src/lib/portal';
import { syncSuppliers } from '../src/lib/suppliers/sync';

function supplierArgument(args: string[]) {
  const inline = args.find((argument) => argument.startsWith('--supplier='));
  const index = args.indexOf('--supplier');
  const value = inline?.slice('--supplier='.length) || (index >= 0 ? args[index + 1] : undefined);
  if (value && !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new Error('Invalid supplier id');
  return value;
}

async function main() {
  const result = await syncSuppliers({ supplierId: supplierArgument(process.argv.slice(2)) });
  console.log(JSON.stringify(result, null, 2));
  if (result.failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Supplier synchronization failed');
    process.exitCode = 1;
  })
  .finally(() => portalDb.$disconnect());
