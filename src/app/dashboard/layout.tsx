import AdminShell from '@/app/admin/AdminShell';
import styles from '@/app/admin/admin.module.css';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.admin}><AdminShell>{children}</AdminShell></div>;
}
