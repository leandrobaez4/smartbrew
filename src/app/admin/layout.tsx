import styles from './admin.module.css';

export default function AdminTypographyLayout({ children }: { children: React.ReactNode }) {
  return <div className={styles.admin}>{children}</div>;
}
