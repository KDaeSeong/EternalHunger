import AdminShell from './_components/AdminShell';

export const metadata = {
  title: 'Admin | Eternal Hunger',
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
