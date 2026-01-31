"use client";

import Link from "next/link";
import AdminNav from "./AdminNav";

/**
 * Admin 공통 Shell
 * - 가독성(대비) 개선: 사이드/헤더 배경을 진하게, 카드 영역은 밝게
 * - 레이아웃 파일(admin/layout.js)에서 이 컴포넌트를 감싸 쓰는 방식
 */
export default function AdminShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-sm font-semibold tracking-wide text-white">
            ETERNAL HUNGER
          </Link>

          <div className="text-xs text-white/70">ADMIN</div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6">
        {/* Sidebar */}
        <aside className="w-56 shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 px-2 text-xs font-semibold text-white/70">MENU</div>
            <AdminNav />
          </div>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
