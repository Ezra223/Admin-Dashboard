"use client";

import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  ReloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getActiveTrips,
  getTripHistory,
  updateTripStatus,
} from "../../lib/queries";
import { realtimeManager } from "../../lib/realtime";
import { useAuth } from "../providers/AuthProvider";

const { Title, Text } = Typography;

interface Trip {
  id: string;
  status: "waiting" | "ongoing" | "completed" | "cancelled";
  current_location?: any;
  started_at?: string;
  ended_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  buses: {
    id: string;
    plate_number: string;
    capacity: number;
    routes: {
      id: string;
      name: string;
      start_address: string;
      end_address: string;
    };
  };
  driver: {
    id: string;
    fullName: string;
    contact_number?: string;
  };
  trip_passengers: Array<{
    id: string;
    status: "boarded" | "completed" | "cancelled";
    boarded_at?: string;
    commuter: {
      id: string;
      fullName: string;
    };
  }>;
}

export default function TripsPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [tripHistory, setTripHistory] = useState<Trip[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data already loaded
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [form] = Form.useForm();

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
      console.log("Loading trips data for the first time");
      loadData();
      setupRealtime();
      setDataLoaded(true);
    }

    return () => {
      isSubscribed = false;
      realtimeManager.unsubscribe("trips");
    };
  }, [user, isAdmin, dataLoaded]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [activeResult, historyResult] = await Promise.all([
        getActiveTrips(),
        getTripHistory(),
      ]);

      if (activeResult.error) throw activeResult.error;
      if (historyResult.error) throw historyResult.error;

      // Transform data to match interface expectations
      const transformedActiveTrips = (activeResult.data || []).map(
        (trip: any) => ({
          ...trip,
          buses: Array.isArray(trip.buses) ? trip.buses[0] : trip.buses,
          driver: Array.isArray(trip.driver) ? trip.driver[0] : trip.driver,
        })
      );

      const transformedHistoryTrips = (historyResult.data || []).map(
        (trip: any) => ({
          ...trip,
          buses: Array.isArray(trip.buses) ? trip.buses[0] : trip.buses,
          driver: Array.isArray(trip.driver) ? trip.driver[0] : trip.driver,
        })
      );

      setActiveTrips(transformedActiveTrips);
      setTripHistory(transformedHistoryTrips);
    } catch (error) {
      console.error("Error loading trips data:", error);
      message.error("Failed to load trips data");
    } finally {
      setLoadingData(false);
    }
  };
  const setupRealtime = () => {
    realtimeManager.subscribeToTrips({
      onTripUpdate: (payload) => {
        // Silently refresh data in background (no loading screen)
        loadData();
      },
    });
  };

  const handleTripStatusChange = async (
    tripId: string,
    newStatus: string,
    reason?: string
  ) => {
    try {
      const { error } = await updateTripStatus(tripId, newStatus);
      if (error) throw error;

      message.success(`Trip status updated to ${newStatus}`);
      loadData();
    } catch (error) {
      console.error("Error updating trip status:", error);
      message.error("Failed to update trip status");
    }
  };

  const handleCancelTrip = async (values: { reason: string }) => {
    if (!selectedTrip) return;

    try {
      const { error } = await updateTripStatus(selectedTrip.id, "cancelled");
      if (error) throw error;

      message.success("Trip cancelled successfully");
      setCancelModalVisible(false);
      setSelectedTrip(null);
      form.resetFields();
      loadData();
    } catch (error) {
      console.error("Error cancelling trip:", error);
      message.error("Failed to cancel trip");
    }
  };

  const openCancelModal = (trip: Trip) => {
    setSelectedTrip(trip);
    setCancelModalVisible(true);
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      waiting: { color: "blue", text: "Waiting" },
      ongoing: { color: "green", text: "Ongoing" },
      completed: { color: "success", text: "Completed" },
      cancelled: { color: "red", text: "Cancelled" },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "N/A";
    return new Date(timeString).toLocaleString();
  };

  const activeColumns = [
    {
      title: "Trip ID",
      dataIndex: "id",
      key: "id",
      render: (text: string) => (
        <Text code style={{ fontSize: "12px" }}>
          {text.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: "Bus",
      key: "bus",
      render: (record: Trip) => (
        <div>
          <Text strong>{record.buses.routes.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.buses.plate_number}
          </Text>
        </div>
      ),
    },
    {
      title: "Driver",
      key: "driver",
      render: (record: Trip) => (
        <div>
          <Text>{record.driver.fullName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.driver.contact_number}
          </Text>
        </div>
      ),
    },
    {
      title: "Passengers",
      key: "passengers",
      render: (record: Trip) => {
        const boardedCount = record.trip_passengers.filter(
          (p) => p.status === "boarded"
        ).length;
        return (
          <div>
            <Text>
              {boardedCount}/{record.buses.capacity}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {Math.round((boardedCount / record.buses.capacity) * 100)}% full
            </Text>
          </div>
        );
      },
    },
    {
      title: "Started At",
      dataIndex: "started_at",
      key: "started_at",
      render: (text: string) => formatTime(text),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => getStatusTag(status),
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: Trip) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              // TODO: Implement trip details modal
              message.info("Trip details feature coming soon");
            }}
          >
            Details
          </Button>
          {record.status === "ongoing" && (
            <Button
              type="link"
              onClick={() => handleTripStatusChange(record.id, "completed")}
            >
              Complete
            </Button>
          )}
          {record.status !== "completed" && record.status !== "cancelled" && (
            <Button type="link" danger onClick={() => openCancelModal(record)}>
              Cancel
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: "Trip ID",
      dataIndex: "id",
      key: "id",
      render: (text: string) => (
        <Text code style={{ fontSize: "12px" }}>
          {text.slice(0, 8)}...
        </Text>
      ),
    },
    {
      title: "Bus",
      key: "bus",
      render: (record: Trip) => (
        <div>
          <Text strong>{record.buses.plate_number}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.buses.routes.name}
          </Text>
        </div>
      ),
    },
    {
      title: "Driver",
      key: "driver",
      render: (record: Trip) => <Text>{record.driver.fullName}</Text>,
    },
    {
      title: "Started At",
      dataIndex: "started_at",
      key: "started_at",
      render: (text: string) => formatTime(text),
    },
    {
      title: "Ended At",
      dataIndex: "ended_at",
      key: "ended_at",
      render: (text: string) => formatTime(text),
    },
    {
      title: "Duration",
      key: "duration",
      render: (record: Trip) => {
        if (!record.started_at || !record.ended_at) return "N/A";
        const start = new Date(record.started_at);
        const end = new Date(record.ended_at);
        const duration = Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60)
        );
        return `${duration} min`;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => getStatusTag(status),
    },
  ];

  const waitingTrips = activeTrips.filter(
    (trip) => trip.status === "waiting"
  ).length;
  const ongoingTrips = activeTrips.filter(
    (trip) => trip.status === "ongoing"
  ).length;
  const completedTrips = tripHistory.filter(
    (trip) => trip.status === "completed"
  ).length;
  const cancelledTrips = tripHistory.filter(
    (trip) => trip.status === "cancelled"
  ).length;

  // Only show loading screen during initial authentication or first data load
  if ((loading && !user) || (loadingData && !dataLoaded)) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="admin-layout admin-layout--minimal">
      <div className="admin-header">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(17, 153, 142, 0.35)",
            }}
          >
            <ClockCircleOutlined style={{ fontSize: "20px", color: "white" }} />
          </div>
          <div
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
          >
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b" }}>
              Trip Management
            </div>
            <div
              style={{
                fontSize: "11px",
                color: "#64748b",
                fontWeight: 600,
                letterSpacing: "0.4px",
                textTransform: "uppercase",
              }}
            >
              Live operations and trip history
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Alert
            type="success"
            showIcon
            message="Live"
            style={{ borderRadius: "24px", padding: "4px 12px" }}
          />
          <Button
            onClick={loadData}
            icon={<ReloadOutlined spin={loadingData} />}
            style={{
              borderRadius: "12px",
              fontWeight: 600,
              height: "40px",
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="admin-content">
        {/* Statistics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <ClockCircleOutlined style={{ fontSize: "24px", color: "#1d4ed8" }} />
                <Statistic title="Waiting Trips" value={waitingTrips} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <CarOutlined style={{ fontSize: "24px", color: "#059669" }} />
                <Statistic title="Ongoing Trips" value={ongoingTrips} valueStyle={{ color: "#059669" }} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <CheckCircleOutlined style={{ fontSize: "24px", color: "#0891b2" }} />
                <Statistic title="Completed Trips" value={completedTrips} valueStyle={{ color: "#0891b2" }} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <CloseCircleOutlined style={{ fontSize: "24px", color: "#dc2626" }} />
                <Statistic title="Cancelled Trips" value={cancelledTrips} valueStyle={{ color: "#dc2626" }} />
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Trips Table Card */}
        <Card
          style={{
            borderRadius: "20px",
            border: "none",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
          }}
        >
          <Tabs
            defaultActiveKey="active"
            items={[
              {
                key: "active",
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "#10b981",
                        animation: "pulse 2s infinite",
                      }}
                    />
                    Active Trips ({activeTrips.length})
                  </span>
                ),
                children: (
                  <Table
                    columns={activeColumns}
                    dataSource={activeTrips}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} trips`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              },
              {
                key: "history",
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ClockCircleOutlined style={{ color: "#64748b" }} />
                    History ({tripHistory.length})
                  </span>
                ),
                children: (
                  <Table
                    columns={historyColumns}
                    dataSource={tripHistory}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} trips`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              },
            ]}
          />
        </Card>

        <Modal
          title="Cancel Trip"
          open={cancelModalVisible}
          onCancel={() => {
            setCancelModalVisible(false);
            setSelectedTrip(null);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleCancelTrip}>
            <Form.Item
              label="Trip Details"
              name="trip"
              initialValue={
                selectedTrip
                  ? `${selectedTrip.buses.plate_number} - ${selectedTrip.buses.routes.name}`
                  : ""
              }
            >
              <Input disabled />
            </Form.Item>

            <Form.Item
              label="Cancellation Reason"
              name="reason"
              rules={[
                {
                  required: true,
                  message: "Please provide a reason for cancellation!",
                },
              ]}
            >
              <Input.TextArea
                rows={4}
                placeholder="Enter the reason for cancelling this trip..."
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" danger>
                  Cancel Trip
                </Button>
                <Button
                  onClick={() => {
                    setCancelModalVisible(false);
                    setSelectedTrip(null);
                    form.resetFields();
                  }}
                >
                  Keep Trip
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
