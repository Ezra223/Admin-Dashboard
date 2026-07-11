"use client";

import {
  BarChartOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  LineChartOutlined,
  PieChartOutlined,
  PrinterOutlined,
  ReloadOutlined,
  RiseOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Divider,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getDailyIncomeBreakdown,
  getMonthlyIncomeBreakdown,
  getRouteUtilization,
  getTopFareTrips,
  getTripAnalytics,
} from "../../lib/queries";
import { useAuth } from "../providers/AuthProvider";

const { Title, Text } = Typography;

const formatPHP = (amount: number) =>
  `₱${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });

interface AnalyticsData {
  tripAnalytics: any[];
  routeUtilization: any[];
  dailyIncome: { date: string; income: number }[];
  monthlyIncome: { month: string; income: number }[];
  topFareTrips: any[];
}

export default function AnalyticsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && !isAdmin) {
      message.error("Access denied. Admin privileges required.");
      router.push("/");
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    let isSubscribed = true;
    if (user && isAdmin && !dataLoaded && isSubscribed) {
      loadAnalyticsData();
      setDataLoaded(true);
    }
    return () => { isSubscribed = false; };
  }, [user, isAdmin, dataLoaded]);

  const loadAnalyticsData = async () => {
    try {
      setLoadingData(true);
      const [tripResult, routeResult, dailyResult, monthlyResult, topFareResult] =
        await Promise.all([
          getTripAnalytics(30),
          getRouteUtilization(),
          getDailyIncomeBreakdown(30),
          getMonthlyIncomeBreakdown(6),
          getTopFareTrips(10),
        ]);

      if (tripResult.error) throw tripResult.error;
      if (routeResult.error) throw routeResult.error;

      setAnalyticsData({
        tripAnalytics: tripResult.data || [],
        routeUtilization: routeResult.data || [],
        dailyIncome: dailyResult.data || [],
        monthlyIncome: monthlyResult.data || [],
        topFareTrips: topFareResult.data || [],
      });
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("aborted")) return;
      console.error("Error loading analytics data:", error);
      message.error("Failed to load analytics data");
    } finally {
      setLoadingData(false);
    }
  };

  const calculateMetrics = () => {
    if (!analyticsData) return null;
    const trips = analyticsData.tripAnalytics;
    const completedTrips = trips.filter((t: any) => t.status === "completed");
    const cancelledTrips = trips.filter((t: any) => t.status === "cancelled");
    const ongoingTrips = trips.filter((t: any) => t.status === "ongoing");
    const totalTrips = trips.length;
    const completionRate = totalTrips > 0 ? (completedTrips.length / totalTrips) * 100 : 0;
    const cancellationRate = totalTrips > 0 ? (cancelledTrips.length / totalTrips) * 100 : 0;
    const uniqueDays = new Set(
      trips.map((t: any) => {
        const d = t.started_at || t.updated_at;
        return d ? new Date(d).toDateString() : null;
      }).filter(Boolean)
    ).size;
    const avgTripsPerDay = uniqueDays > 0 ? totalTrips / uniqueDays : 0;
    const activeRoutes = analyticsData.routeUtilization.filter(
      (r: any) => r.buses && r.buses.length > 0
    ).length;
    const totalRoutes = analyticsData.routeUtilization.length;
    const routeUtilizationRate = totalRoutes > 0 ? (activeRoutes / totalRoutes) * 100 : 0;

    // Income totals
    const totalIncomeAllTime = analyticsData.dailyIncome.reduce(
      (s, r) => s + r.income, 0
    );
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthlyEntry = analyticsData.monthlyIncome.find((m) => m.month === currentMonth);
    const currentMonthIncome = monthlyEntry?.income || 0;

    // Last month from monthlyIncome array
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthEntry = analyticsData.monthlyIncome.find((m) => m.month === lastMonthKey);
    const lastMonthIncome = lastMonthEntry?.income || 0;

    const today = new Date().toISOString().split("T")[0];
    const todayEntry = analyticsData.dailyIncome.find((d) => d.date === today);
    const todayIncome = todayEntry?.income || 0;

    // Month-over-month trend
    const momTrend = lastMonthIncome > 0
      ? Math.round(((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100)
      : null;

    return {
      totalTrips,
      completedTrips: completedTrips.length,
      cancelledTrips: cancelledTrips.length,
      ongoingTrips: ongoingTrips.length,
      completionRate: Math.round(completionRate),
      cancellationRate: Math.round(cancellationRate),
      avgTripsPerDay: Math.round(avgTripsPerDay * 10) / 10,
      activeRoutes,
      totalRoutes,
      routeUtilizationRate: Math.round(routeUtilizationRate),
      currentMonthIncome,
      lastMonthIncome,
      todayIncome,
      momTrend,
    };
  };

  const metrics = calculateMetrics();

  const handlePrint = () => {
    window.print();
  };

  if ((loading && !user) || (loadingData && !dataLoaded)) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", height: "100vh",
        background: "#f8fafc", gap: "16px",
      }}>
        <Spin size="large" />
        <Text style={{ color: "#475569", fontSize: "16px" }}>Loading analytics...</Text>
      </div>
    );
  }

  const routeColumns = [
    { title: "Route", dataIndex: "name", key: "name", render: (n: string) => <Text strong style={{ color: "#1e293b" }}>{n}</Text> },
    { title: "From", dataIndex: "start_address", key: "from", render: (a: string) => <Text style={{ color: "#64748b" }}>{a?.substring(0, 30)}{a?.length > 30 ? "…" : ""}</Text> },
    { title: "To", dataIndex: "end_address", key: "to", render: (a: string) => <Text style={{ color: "#64748b" }}>{a?.substring(0, 30)}{a?.length > 30 ? "…" : ""}</Text> },
    { title: "Active Buses", dataIndex: "buses", key: "buses", render: (b: any[]) => <Tag color={b?.length > 0 ? "green" : "default"}>{b?.length || 0} bus{b?.length !== 1 ? "es" : ""}</Tag> },
  ];

  const topFareColumns = [
    {
      title: "Bus / Route", key: "bus", render: (r: any) => (
        <div>
          <Text strong>{r.buses?.plate_number || "—"}</Text>
          {r.buses?.body_number && <Text type="secondary"> · #{r.buses.body_number}</Text>}
          <div style={{ fontSize: 12, color: "#64748b" }}>{r.buses?.routes?.name || "Unknown Route"}</div>
        </div>
      )
    },
    { title: "Status", dataIndex: "status", key: "status", render: (s: string) => <Tag color={s === "completed" ? "green" : s === "ongoing" ? "purple" : "red"}>{s}</Tag> },
    { title: "Fare Total", dataIndex: "fare_total", key: "fare_total", render: (f: number) => <Text strong style={{ color: "#10b981" }}>{formatPHP(f)}</Text>, sorter: (a: any, b: any) => a.fare_total - b.fare_total },
    { title: "Date", dataIndex: "fare_updated_at", key: "date", render: (d: string) => <Text type="secondary">{d ? new Date(d).toLocaleDateString("en-PH") : "—"}</Text> },
  ];

  return (
    <div className="admin-layout admin-layout--minimal">
      <div className="admin-header">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(102,126,234,0.35)",
            }}
          >
            <BarChartOutlined style={{ fontSize: "20px", color: "white" }} />
          </div>
          <div style={{ cursor: "default" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b" }}>Analytics</div>
            <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase" }}>
              Reports and insights
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Button onClick={handlePrint} icon={<PrinterOutlined />} style={{ borderRadius: "12px", fontWeight: 600, height: "40px" }}>Print Report</Button>
          <Button onClick={loadAnalyticsData} icon={<ReloadOutlined spin={loadingData} />} style={{ borderRadius: "12px", fontWeight: 600, height: "40px" }}>Refresh</Button>
        </div>
      </div>

      <div className="admin-content" id="screen-content">
        {/* ── Income Metric Cards ─────────────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
          <Col xs={24} sm={12} lg={8}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <DollarOutlined style={{ fontSize: "24px", color: "#10b981" }} />
                <Statistic
                  title="Today's Income"
                  value={metrics?.todayIncome || 0}
                  formatter={(value) => formatPHP(Number(value || 0))}
                  valueStyle={{ color: "#10b981" }}
                />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <RiseOutlined style={{ fontSize: "24px", color: "#6366f1" }} />
                <Statistic
                  title="This Month's Income"
                  value={metrics?.currentMonthIncome || 0}
                  formatter={(value) => formatPHP(Number(value || 0))}
                  valueStyle={{ color: "#6366f1" }}
                />
                {metrics?.momTrend !== null && (
                  <Text style={{ color: (metrics?.momTrend ?? 0) >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                    {(metrics?.momTrend ?? 0) >= 0 ? "+" : "-"}
                    {Math.abs(metrics?.momTrend ?? 0)}% vs last month
                  </Text>
                )}
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <BarChartOutlined style={{ fontSize: "24px", color: "#f59e0b" }} />
                <Statistic
                  title="Last Month's Income"
                  value={metrics?.lastMonthIncome || 0}
                  formatter={(value) => formatPHP(Number(value || 0))}
                  valueStyle={{ color: "#f59e0b" }}
                />
              </Space>
            </Card>
          </Col>
        </Row>

        {/* ── Trip Metrics ────────────────────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
          {[
            { icon: <BarChartOutlined />, value: metrics?.totalTrips || 0, label: "Total Trips (30d)", color: "#6366f1", suffix: undefined, subtext: `${metrics?.avgTripsPerDay || 0}/day` },
            { icon: <CheckCircleOutlined />, value: metrics?.completionRate || 0, label: "Completion Rate", color: "#10b981", suffix: "%", subtext: undefined },
            { icon: <LineChartOutlined />, value: metrics?.avgTripsPerDay || 0, label: "Avg Trips / Day", color: "#8b5cf6", suffix: undefined, subtext: undefined },
            { icon: <PieChartOutlined />, value: metrics?.routeUtilizationRate || 0, label: "Route Utilization", color: "#06b6d4", suffix: "%", subtext: undefined },
          ].map((c, i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card bordered={false} style={{ height: "100%" }}>
                <Space direction="vertical" size={10}>
                  <span style={{ fontSize: "24px", color: c.color }}>{c.icon}</span>
                  <Statistic
                    title={c.label}
                    value={c.value}
                    suffix={c.suffix}
                    valueStyle={{ color: c.color }}
                  />
                  {c.subtext && <Text type="secondary">{c.subtext}</Text>}
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Daily Income Bar Chart ──────────────────────────────────────── */}
        <Row gutter={[24, 24]} style={{ marginBottom: "32px" }}>
          <Col span={24}>
            <Card title={
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#11998e 0%,#38ef7d 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <DollarOutlined style={{ color: "white", fontSize: "18px" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px", color: "#1e293b" }}>Daily Income — Last 30 Days</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Fare totals aggregated from completed trip passengers</div>
                </div>
              </div>
            } style={{ borderRadius: "20px", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
              {analyticsData?.dailyIncome.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
                  <DollarOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>No income data yet — fares will appear here once trips are completed.</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analyticsData?.dailyIncome || []} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tickFormatter={(v) => `₱${v.toLocaleString()}`} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip formatter={(v: number) => [formatPHP(v), "Income"]} labelFormatter={formatDate} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }} />
                    <Bar dataKey="income" fill="url(#incomeGradient)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#11998e" />
                        <stop offset="100%" stopColor="#38ef7d" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        </Row>

        {/* ── Monthly Income Bar Chart ────────────────────────────────────── */}
        <Row gutter={[24, 24]} style={{ marginBottom: "32px" }}>
          <Col span={24}>
            <Card title={
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <RiseOutlined style={{ color: "white", fontSize: "18px" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px", color: "#1e293b" }}>Monthly Income — Last 6 Months</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Month-over-month revenue trend</div>
                </div>
              </div>
            } style={{ borderRadius: "20px", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
              {analyticsData?.monthlyIncome.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
                  <RiseOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>No monthly data yet.</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={analyticsData?.monthlyIncome || []} margin={{ top: 8, right: 24, left: 24, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis tickFormatter={(v) => `₱${v.toLocaleString()}`} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip formatter={(v: number) => [formatPHP(v), "Income"]} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }} />
                    <Bar dataKey="income" fill="url(#monthGradient)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="monthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#667eea" />
                        <stop offset="100%" stopColor="#764ba2" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </Col>
        </Row>

        {/* ── Trip Status + Top Fare Trips ────────────────────────────────── */}
        <Row gutter={[20, 20]} style={{ marginBottom: "32px" }}>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: "20px", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", height: "100%" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg,#10b981 0%,#059669 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 16px rgba(16,185,129,0.3)" }}>
                  <CheckCircleOutlined style={{ fontSize: "28px", color: "white" }} />
                </div>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "#10b981" }}>{metrics?.completedTrips || 0}</div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>Completed Trips</div>
                <Progress percent={metrics?.completionRate || 0} showInfo={false} strokeColor={{ from: "#10b981", to: "#059669" }} style={{ marginTop: "16px" }} />
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: "20px", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", height: "100%" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 16px rgba(239,68,68,0.3)" }}>
                  <CloseCircleOutlined style={{ fontSize: "28px", color: "white" }} />
                </div>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "#ef4444" }}>{metrics?.cancelledTrips || 0}</div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>Cancelled Trips</div>
                <Progress percent={metrics?.cancellationRate || 0} showInfo={false} strokeColor={{ from: "#ef4444", to: "#dc2626" }} style={{ marginTop: "16px" }} />
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ borderRadius: "20px", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", height: "100%" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 16px rgba(245,158,11,0.3)" }}>
                  <TeamOutlined style={{ fontSize: "28px", color: "white" }} />
                </div>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "#f59e0b" }}>{metrics?.routeUtilizationRate || 0}%</div>
                <div style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>Route Utilization</div>
                <Progress percent={metrics?.routeUtilizationRate || 0} showInfo={false} strokeColor={{ from: "#f59e0b", to: "#d97706" }} style={{ marginTop: "16px" }} />
              </div>
            </Card>
          </Col>
        </Row>

        {/* ── Top Fare Trips Table ────────────────────────────────────────── */}
        <Row gutter={[24, 24]} style={{ marginBottom: "32px" }}>
          <Col span={24}>
            <Card title={
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#f093fb 0%,#f5576c 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <DollarOutlined style={{ color: "white", fontSize: "18px" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px", color: "#1e293b" }}>Top Earning Trips</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>Highest fare totals recorded</div>
                </div>
              </div>
            } style={{ borderRadius: "20px", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
              <Table dataSource={analyticsData?.topFareTrips || []} columns={topFareColumns} rowKey="id" pagination={false} size="middle" />
            </Card>
          </Col>
        </Row>

        {/* ── Route Performance Table ─────────────────────────────────────── */}
        <Row gutter={[24, 24]}>
          <Col span={24}>
            <Card title={
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#06b6d4 0%,#0891b2 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CarOutlined style={{ color: "white", fontSize: "18px" }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "16px", color: "#1e293b" }}>Route Performance</div>
                  <div style={{ fontSize: "12px", color: "#64748b" }}>{metrics?.activeRoutes || 0} of {metrics?.totalRoutes || 0} routes active</div>
                </div>
              </div>
            } extra={<Tag color="cyan" style={{ fontWeight: 600 }}>{metrics?.routeUtilizationRate || 0}% Utilization</Tag>}
              style={{ borderRadius: "20px", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
              <Table dataSource={analyticsData?.routeUtilization || []} columns={routeColumns} rowKey="id" pagination={false} size="middle" />
            </Card>
          </Col>
        </Row>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PRINT-ONLY REPORT — hidden on screen, shown when printing          */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div id="print-report" ref={printRef} style={{ display: "none" }}>
        {/* Print styles injected via globals.css @media print */}
        <div className="print-header">
          <div className="print-company">MINIWAY TRANSPORT SERVICES, INC.</div>
          <div className="print-title">Operations and Revenue Performance Report</div>
          <div className="print-subtitle">Administrative Analytics Department</div>
        </div>

        <div className="print-meta">
          <div className="print-meta-item"><span>Report ID:</span> MTS-OPS-30D</div>
          <div className="print-meta-item"><span>Coverage Period:</span> Last 30 Days</div>
          <div className="print-meta-item"><span>Date Generated:</span> {new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</div>
          <div className="print-meta-item"><span>Time Generated:</span> {new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="print-meta-item"><span>Prepared By:</span> Miniway Admin System</div>
          <div className="print-meta-item"><span>Classification:</span> Internal Use Only</div>
        </div>

        <div className="print-summary-note">
          This report presents trip performance, revenue summary, and route utilization metrics for operational review.
          All values are system-generated from completed and historical trip records.
        </div>

        <Divider className="print-divider" />

        <div className="print-section-title">1. Trip Performance Summary (30 Days)</div>
        <div className="print-grid-4">
          {[
            { label: "Total Trips", value: metrics?.totalTrips || 0 },
            { label: "Completed Trips", value: metrics?.completedTrips || 0 },
            { label: "Cancelled Trips", value: metrics?.cancelledTrips || 0 },
            { label: "Completion Rate", value: `${metrics?.completionRate || 0}%` },
          ].map((s, i) => (
            <div key={i} className="print-stat-box">
              <div className="print-stat-value">{s.value}</div>
              <div className="print-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <Divider className="print-divider" />

        <div className="print-section-title">2. Revenue Summary</div>
        <div className="print-grid-3">
          {[
            { label: "Today's Revenue", value: formatPHP(metrics?.todayIncome || 0) },
            { label: "Current Month Revenue", value: formatPHP(metrics?.currentMonthIncome || 0) },
            { label: "Previous Month Revenue", value: formatPHP(metrics?.lastMonthIncome || 0) },
          ].map((s, i) => (
            <div key={i} className="print-stat-box print-income">
              <div className="print-stat-value">{s.value}</div>
              <div className="print-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <Divider className="print-divider" />

        <div className="print-section-title">3. Daily Revenue Breakdown</div>
        <table className="print-table">
          <thead>
            <tr><th>Date</th><th>Revenue (PHP)</th></tr>
          </thead>
          <tbody>
            {(analyticsData?.dailyIncome || []).map((row) => (
              <tr key={row.date}>
                <td>{new Date(row.date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}</td>
                <td>{formatPHP(row.income)}</td>
              </tr>
            ))}
            {analyticsData?.dailyIncome.length === 0 && (
              <tr><td colSpan={2} style={{ textAlign: "center", color: "#94a3b8" }}>No revenue recorded for this period.</td></tr>
            )}
          </tbody>
        </table>

        <Divider className="print-divider" />

        <div className="print-section-title">4. Top Earning Trips</div>
        <table className="print-table">
          <thead>
            <tr><th>Bus</th><th>Route</th><th>Status</th><th>Fare Total</th><th>Date</th></tr>
          </thead>
          <tbody>
            {(analyticsData?.topFareTrips || []).map((row: any) => (
              <tr key={row.id}>
                <td>{row.buses?.plate_number || "-"}{row.buses?.body_number ? ` #${row.buses.body_number}` : ""}</td>
                <td>{row.buses?.routes?.name || "Unknown"}</td>
                <td style={{ textTransform: "capitalize" }}>{row.status}</td>
                <td><strong>{formatPHP(row.fare_total)}</strong></td>
                <td>{row.fare_updated_at ? new Date(row.fare_updated_at).toLocaleDateString("en-PH") : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Divider className="print-divider" />

        <div className="print-section-title">5. Route Utilization Overview</div>
        <table className="print-table">
          <thead>
            <tr><th>Route Name</th><th>From</th><th>To</th><th>Active Buses</th></tr>
          </thead>
          <tbody>
            {(analyticsData?.routeUtilization || []).map((row: any) => (
              <tr key={row.id}>
                <td><strong>{row.name}</strong></td>
                <td>{row.start_address?.substring(0, 40)}</td>
                <td>{row.end_address?.substring(0, 40)}</td>
                <td>{row.buses?.length || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-signoff">
          <div className="print-signature-block">
            <div className="print-signature-line" />
            <div className="print-signature-label">Prepared By</div>
          </div>
          <div className="print-signature-block">
            <div className="print-signature-line" />
            <div className="print-signature-label">Reviewed By</div>
          </div>
        </div>

        <div className="print-footer">
          Miniway Transport Services, Inc. | Printed {new Date().toLocaleString("en-PH")} | Internal Confidential Report
        </div>
      </div>
    </div>
  );
}
