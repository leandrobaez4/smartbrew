import { normalizeAdminReturnTo } from '@/lib/admin-return-to';
import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const query = await searchParams;
  return <LoginForm returnTo={normalizeAdminReturnTo(query.returnTo) || ''} />;
}
