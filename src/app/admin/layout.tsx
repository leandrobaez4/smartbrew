import type { Metadata } from 'next';
import styles from './admin.module.css';

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminTypographyLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.admin}>{children}</div>;
}
