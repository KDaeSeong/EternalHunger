import AdminShell from "./_components/AdminShell";

export const metadata = {
  title: "Admin | 케이(Kei)의 게임개발소",
};

export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
