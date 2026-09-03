'use server';

import { z } from 'zod';
import * as argon2 from 'argon2';
import { encrypt } from '@/lib/session';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { redirect } from 'next/navigation';

const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginAction(prevState: { error: string | null }, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { error: 'Invalid data' };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: 'Invalid credentials' };
  }

  const isValid = await argon2.verify(user.passwordHash, password);
  if (!isValid) {
    return { error: 'Invalid credentials' };
  }

  const session = await encrypt({ user: { id: user.id, email: user.email } });
  (await cookies()).set('session', session, { httpOnly: true, secure: process.env.NODE_ENV === 'production' });

  redirect('/admin/products');
}

export async function logoutAction() {
  (await cookies()).delete('session');
  redirect('/admin/login');
}
