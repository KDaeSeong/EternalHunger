import AdminGuard from './AdminGuard';
import AdminNav from './AdminNav';

export default function AdminShell({ children }) {
  return (
    <AdminGuard>
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <div className="tag">DEV TOOLS</div>
            <div className="title">Eternal Hunger Admin</div>
          </div>
          <AdminNav />
          <div className="admin-muted" style={{ padding: '12px 10px' }}>
            로드맵 항목(아이템/맵/키오스크/드론/크레딧/특전/게시판) 기준으로 정리했습니다.
          </div>
        </aside>

        <main className="admin-main">{children}</main>
      </div>
    </AdminGuard>
  );
}
