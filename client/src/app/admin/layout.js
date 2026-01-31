import AdminShell from "./_components/AdminShell";

export const metadata = {
  title: "Admin | EternalHunger",
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
