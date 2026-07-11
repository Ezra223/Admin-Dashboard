"use client";

import {
  BarChartOutlined,
  CarOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  TeamOutlined,
  UserOutlined,
  CompassOutlined,
} from "@ant-design/icons";
import { Button, Menu, Spin, Typography } from "antd";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { prewarmers } from "../../lib/navCache";

const { Text } = Typography;

const NAV_ITEMS = [
  { key: "/", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/fleet", icon: <CarOutlined />, label: "Mini Buses" },
  { key: "/trips", icon: <ClockCircleOutlined />, label: "Trips" },
  { key: "/routes", icon: <CompassOutlined />, label: "Routes" },
  { key: "/users", icon: <TeamOutlined />, label: "Users" },
  { key: "/role-requests", icon: <UserOutlined />, label: "Role Requests" },
  { key: "/analytics", icon: <BarChartOutlined />, label: "Analytics" },
];

function isShellRoute(pathname: string): boolean {
  return NAV_ITEMS.some((item) => {
    if (item.key === "/") {
      return pathname === "/";
    }
    return pathname === item.key || pathname.startsWith(`${item.key}/`);
  });
}

export function AdminAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const inShell = isShellRoute(pathname);

  const selectedKey = useMemo(() => {
    const match = NAV_ITEMS.find((item) =>
      item.key === "/"
        ? pathname === "/"
        : pathname === item.key || pathname.startsWith(`${item.key}/`)
    );
    return match?.key ?? "/";
  }, [pathname]);

  useEffect(() => {
    NAV_ITEMS.forEach((item) => {
      router.prefetch(item.key);
    });
  }, [router]);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  const navigateTo = (path: string) => {
    if (path === pathname) return;
    setIsNavigating(true);
    router.push(path);
  };

  const menuItems = useMemo(
    () =>
      NAV_ITEMS.map((item) => ({
        ...item,
        label: (
          <span
            onMouseEnter={() => {
              prewarmers[item.key]?.();
              router.prefetch(item.key);
            }}
          >
            {item.label}
          </span>
        ),
      })),
    [router]
  );

  if (!inShell) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside
        className="app-shell-sidebar"
        style={{ width: collapsed ? 88 : 240, minWidth: collapsed ? 88 : 240 }}
      >
        <button
          type="button"
          className={`app-shell-brand ${collapsed ? "is-collapsed" : ""}`}
          onClick={() => navigateTo("/")}
        >
          <span className="app-shell-brand-icon" aria-hidden="true">
            <img src="/logo.png" alt="Miniway logo" />
          </span>
          {!collapsed && <span className="app-shell-brand-text">Miniway</span>}
        </button>

        <div className="app-shell-sidebar-top">
          {!collapsed && (
            <Text className="app-shell-sidebar-label">Navigation</Text>
          )}
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          />
        </div>

        <Menu
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigateTo(key)}
          style={{ borderInlineEnd: "none", background: "transparent" }}
        />
      </aside>

      <main className="app-shell-content">
        {isNavigating && (
          <div className="app-shell-nav-loading" role="status" aria-live="polite">
            <Spin size="large" />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
