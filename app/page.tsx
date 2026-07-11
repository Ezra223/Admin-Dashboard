"use client";

import {
  BarChartOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CompassOutlined,
  DollarOutlined,
  LoadingOutlined,
  LogoutOutlined,
  MoonOutlined,
  RiseOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Spin, Statistic, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardMetrics, getDashboardMetrics } from "../lib/queries";
import { realtimeManager } from "../lib/realtime";
import { useAuth } from "./providers/AuthProvider";
import { useAppTheme } from "./providers/ThemeProvider";

const { Title, Text } = Typography;

export default function HomePage() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const router = useRouter();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const { darkMode, toggleDarkMode } = useAppTheme();

  // Prefetch all quick-action JS bundles as soon as the dashboard loads
  useEffect(() => {
    const paths = ["/fleet", "/users", "/role-requests", "/routes", "/trips", "/analytics"];
    paths.forEach((p) => router.prefetch(p));
  }, [router]);

  // Handle authentication redirect
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (!isAdmin) {
        message.error("Access denied. Admin privileges required.");
        signOut();
      }
    }
  }, [user, loading, isAdmin, router, signOut]);

  // Load metrics when component mounts and user is authenticated
  useEffect(() => {
    let isSubscribed = true;
    if (user && isAdmin && isSubscribed) {
      loadMetrics();
      setupRealtime();
    }
    return () => {
      isSubscribed = false;
      realtimeManager.unsubscribeAll();
    };
  }, [user, isAdmin]);

  // Reduce timeout and improve error handling
  useEffect(() => {
    // Reset timeout flag when loading starts
    if (loading || metricsLoading) {
      setLoadingTimeout(false);
    }

    const timer = setTimeout(() => {
      if (loading || metricsLoading) {
        console.warn("Loading timeout reached - check your connection");
        setLoadingTimeout(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [loading, metricsLoading]);

  const loadMetrics = async () => {
    try {
      setMetricsLoading(true);
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (error) {
      console.error("Error loading metrics:", error);
      message.error("Failed to load dashboard metrics");
      setMetrics({
        activeBuses: 0,
        ongoingTrips: 0,
        totalRoutes: 0,
        totalPassengers: 0,
        todayTrips: 0,
        totalUsers: 0,
        completedTrips: 0,
        cancelledTrips: 0,
        dailyIncome: 0,
        monthlyIncome: 0,
        lastMonthIncome: 0,
      });
    } finally {
      setMetricsLoading(false);
    }
  };
  const setupRealtime = () => {
    realtimeManager.subscribeToAll({
      onTripUpdate: () => {
        // Silently refresh metrics in background (don't show loading)
        loadMetrics();
      },
      onBusUpdate: () => {
        // Silently refresh metrics in background (don't show loading)
        loadMetrics();
      },
    });
    setRealtimeConnected(true);
  };

  const theme = darkMode
    ? {
        pageBg: "#0b1220",
        headerBg: "#111827",
        headerBorder: "#1f2937",
        textPrimary: "#f8fafc",
        textSecondary: "#94a3b8",
        cardBg: "#111827",
        cardBorder: "#1f2937",
        cardShadow: "0 2px 10px rgba(0, 0, 0, 0.35)",
        realtimeBg: "rgba(16, 185, 129, 0.18)",
        realtimeBorder: "rgba(16, 185, 129, 0.45)",
      }
    : {
        pageBg: "#f8fafc",
        headerBg: "#ffffff",
        headerBorder: "#e2e8f0",
        textPrimary: "#1e293b",
        textSecondary: "#64748b",
        cardBg: "#ffffff",
        cardBorder: "#e2e8f0",
        cardShadow: "0 2px 10px rgba(15, 23, 42, 0.05)",
        realtimeBg: "#ecfdf5",
        realtimeBorder: "#a7f3d0",
      };

  const statusTheme = darkMode
    ? {
        neutralBg: "#0f172a",
        neutralBorder: "#1e293b",
        successBg: "rgba(16, 185, 129, 0.12)",
        successBorder: "rgba(16, 185, 129, 0.35)",
        infoBg: "rgba(59, 130, 246, 0.14)",
        infoBorder: "rgba(59, 130, 246, 0.35)",
        dangerBg: "rgba(239, 68, 68, 0.12)",
        dangerBorder: "rgba(239, 68, 68, 0.35)",
      }
    : {
        neutralBg: "#f8fafc",
        neutralBorder: "#e2e8f0",
        successBg: "#f0fdf4",
        successBorder: "#bbf7d0",
        infoBg: "#eff6ff",
        infoBorder: "#bfdbfe",
        dangerBg: "#fef2f2",
        dangerBorder: "#fecaca",
      };

  // Show minimal loading during initial auth check only
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: theme.pageBg,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // If not authenticated, return null (redirect will happen via useEffect)
  if (!user || !isAdmin) {
    return null;
  }

  const formatPHP = (amount: number) =>
    `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const metricCards = [
    {
      title: "Active Buses",
      value: metrics?.activeBuses || 0,
      icon: <CarOutlined />,
      color: "#1d4ed8",
      iconBg: "#dbeafe",
    },
    {
      title: "Ongoing Trips",
      value: metrics?.ongoingTrips || 0,
      icon: <ClockCircleOutlined />,
      color: "#047857",
      iconBg: "#d1fae5",
    },
    {
      title: "Total Routes",
      value: metrics?.totalRoutes || 0,
      icon: <CompassOutlined />,
      color: "#b45309",
      iconBg: "#fef3c7",
    },
    {
      title: "Total Passengers",
      value: metrics?.totalPassengers || 0,
      icon: <TeamOutlined />,
      color: "#6d28d9",
      iconBg: "#ede9fe",
    },
    {
      title: "Today's Trips",
      value: metrics?.todayTrips || 0,
      icon: <CheckCircleOutlined />,
      color: "#0369a1",
      iconBg: "#e0f2fe",
    },
    {
      title: "Total Users",
      value: metrics?.totalUsers || 0,
      icon: <UserOutlined />,
      color: "#be185d",
      iconBg: "#fce7f3",
    },
    {
      title: "Daily Income",
      value: formatPHP(metrics?.dailyIncome || 0),
      icon: <DollarOutlined />,
      color: "#047857",
      iconBg: "#dcfce7",
    },
    {
      title: "Monthly Income",
      value: formatPHP(metrics?.monthlyIncome || 0),
      icon: <RiseOutlined />,
      color: "#7c3aed",
      iconBg: "#f3e8ff",
    },
  ];

  return (
      <div className="admin-layout admin-layout--minimal" style={{ background: theme.pageBg }}>
        <div
          className="admin-header"
          style={{
            background: theme.headerBg,
            borderBottom: `1px solid ${theme.headerBorder}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CarOutlined style={{ fontSize: "20px", color: "white" }} />
            </div>
            <div style={{ cursor: "default" }}>
              <div style={{ fontSize: "20px", fontWeight: 800, color: theme.textPrimary }}>
                Dashboard Overview
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: theme.textSecondary,
                  fontWeight: 600,
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                }}
              >
                Live operations and platform health
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {realtimeConnected && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  background: theme.realtimeBg,
                  border: `1px solid ${theme.realtimeBorder}`,
                  borderRadius: "24px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#059669",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    background: "#10b981",
                    borderRadius: "50%",
                    animation: "pulse 2s infinite",
                    boxShadow: "0 0 0 0 rgba(16, 185, 129, 0.7)",
                  }}
                />
                Live
              </div>
            )}
            <Button
              onClick={toggleDarkMode}
              icon={darkMode ? <SunOutlined /> : <MoonOutlined />}
              style={{ borderRadius: "12px", fontWeight: 600, height: "40px" }}
            >
              {darkMode ? "Light" : "Dark"}
            </Button>
            <Button
              onClick={loadMetrics}
              icon={<LoadingOutlined spin={metricsLoading} />}
              style={{
                borderRadius: "12px",
                fontWeight: 600,
                height: "40px",
              }}
            >
              Refresh
            </Button>
            <Button
              onClick={signOut}
              icon={<LogoutOutlined />}
              danger
              style={{ borderRadius: "12px", fontWeight: 600, height: "40px" }}
            >
              Sign Out
            </Button>
          </div>
        </div>

        <div className="admin-content" style={{ color: theme.textPrimary }}>
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: "16px" }}>
              {metricCards.map((card, index) => (
                <Col xs={24} sm={12} md={8} lg={6} key={index}>
                  <Card
                    bordered={false}
                    style={{
                      height: "100%",
                      border: `1px solid ${theme.cardBorder}`,
                      boxShadow: theme.cardShadow,
                      background: theme.cardBg,
                    }}
                  >
                    <Space direction="vertical" size={10}>
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "10px",
                          background: darkMode ? "rgba(148, 163, 184, 0.12)" : card.iconBg,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "18px",
                          color: card.color,
                        }}
                      >
                        {card.icon}
                      </div>
                      <Statistic
                        title={<span style={{ color: theme.textSecondary }}>{card.title}</span>}
                        value={card.value}
                        valueStyle={{ color: theme.textPrimary, fontWeight: 700 }}
                      />
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>

            <Card
              title={
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "10px",
                      background: "#0f172a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCircleOutlined style={{ color: "white", fontSize: "18px" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "16px", color: theme.textPrimary }}>
                      System Status
                    </div>
                    <div style={{ fontSize: "12px", color: theme.textSecondary }}>
                      Connection health
                    </div>
                  </div>
                </div>
              }
              style={{
                borderRadius: "14px",
                border: `1px solid ${theme.cardBorder}`,
                boxShadow: theme.cardShadow,
                background: theme.cardBg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px",
                    background: statusTheme.neutralBg,
                    borderRadius: "12px",
                    border: `1px solid ${statusTheme.neutralBorder}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: "#10b981",
                      }}
                    />
                    <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                      Database Connection
                    </Text>
                  </div>
                  <Text style={{ color: "#10b981", fontWeight: "600" }}>Connected</Text>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px",
                    background: realtimeConnected ? statusTheme.successBg : statusTheme.dangerBg,
                    borderRadius: "12px",
                    border: realtimeConnected
                      ? `1px solid ${statusTheme.successBorder}`
                      : `1px solid ${statusTheme.dangerBorder}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        background: realtimeConnected ? "#10b981" : "#ef4444",
                      }}
                    />
                    <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                      Real-time Updates
                    </Text>
                  </div>
                  <Text
                    style={{
                      color: realtimeConnected ? "#10b981" : "#ef4444",
                      fontWeight: "600",
                    }}
                  >
                    {realtimeConnected ? "Active" : "Inactive"}
                  </Text>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px",
                    background: statusTheme.infoBg,
                    borderRadius: "12px",
                    border: `1px solid ${statusTheme.infoBorder}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <CheckCircleOutlined style={{ color: "#3b82f6", fontSize: "16px" }} />
                    <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                      Completed Trips (Today)
                    </Text>
                  </div>
                  <Text
                    style={{
                      color: "#3b82f6",
                      fontWeight: "700",
                      fontSize: "18px",
                    }}
                  >
                    {metrics?.completedTrips || 0}
                  </Text>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px",
                    background: statusTheme.dangerBg,
                    borderRadius: "12px",
                    border: `1px solid ${statusTheme.dangerBorder}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        background: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: "bold",
                      }}
                    >
                      X
                    </div>
                    <Text style={{ fontWeight: "600", color: theme.textPrimary }}>
                      Cancelled Trips (Today)
                    </Text>
                  </div>
                  <Text
                    style={{
                      color: "#ef4444",
                      fontWeight: "700",
                      fontSize: "18px",
                    }}
                  >
                    {metrics?.cancelledTrips || 0}
                  </Text>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
  );
}
