"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Admin 좌측 네비게이션
 * - /admin(대시보드) 활성화 처리를 정확히
 * - 하위 경로(/admin/items/...)일 때도 해당 메뉴가 활성화되도록 처리
 */
export default function AdminNav() {
  const pathname = usePathname() || "/";

  const items = [
    { label: "Dashboard", href: "/admin" },
    { label: "Items", href: "/admin/items" },
    { label: "Users", href: "/admin/users" },
    { label: "Events", href: "/admin/events" },
    { label: "Posts", href: "/admin/posts" },
  ];

  const isActive = (href) => {
    if (!href) return false;
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "rounded-lg px-3 py-2 text-sm transition-colors",
              "hover:bg-white/10 hover:text-white",
              active ? "bg-white/15 text-white" : "text-white/70",
            ].join(" ")}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
