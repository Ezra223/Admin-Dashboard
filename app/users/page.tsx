"use client";

import {
  CarOutlined,
  EyeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Popover,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAllUsers, getUsersByRole } from "../../lib/queries";
import { realtimeManager } from "../../lib/realtime";
import { useAuth } from "../providers/AuthProvider";

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

interface User {
  id: string;
  fullName: string; // This will map to "fullName" in the database
  avatar_url?: string;
  role: "driver" | "conductor" | "commuter" | "admin";
  contact_number?: string;
  emergency_contact?: string;
  home_location?: string;
  work_location?: string;
  push_token?: string;
  license_number?: string;
  license_expiry?: string;
  updated_at: string;
}

export default function UsersPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [conductors, setConductors] = useState<User[]>([]);
  const [commuters, setCommuters] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data already loaded
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

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
      console.log("Loading users data for the first time");
      loadData();
      setupRealtime();
      setDataLoaded(true);
    }

    return () => {
      isSubscribed = false;
      realtimeManager.unsubscribe("users");
    };
  }, [user, isAdmin, dataLoaded]);

  const loadData = async () => {
    try {
      setLoadingData(true);

      // Load users with individual error handling
      const allResult = await getAllUsers();
      setAllUsers(allResult.data || []);

      const driversResult = await getUsersByRole("driver");
      setDrivers(driversResult.data || []);

      const conductorsResult = await getUsersByRole("conductor");
      setConductors(conductorsResult.data || []);

      const commutersResult = await getUsersByRole("commuter");
      setCommuters(commutersResult.data || []);

      // Show info message if no users found
      const totalUsers = (allResult.data || []).length;
      if (totalUsers === 0) {
        message.info(
          "No users found in the database. Users will appear here once they register through the mobile app."
        );
      }
    } catch (error) {
      console.error("Error loading users data:", error);
      message.error("Failed to load users data");
    } finally {
      setLoadingData(false);
    }
  };

  const setupRealtime = () => {
    realtimeManager.subscribeToUsers({
      onUserUpdate: (payload) => {
        // Silently refresh data in background (no loading screen)
        loadData();
      },
    });
  };

  const getRoleTag = (role: string) => {
    const roleConfig = {
      admin: { color: "red", text: "Admin" },
      driver: { color: "blue", text: "Driver" },
      conductor: { color: "green", text: "Conductor" },
      commuter: { color: "default", text: "Commuter" },
    };
    const config = roleConfig[role as keyof typeof roleConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleString();
  };

  const isLicenseExpired = (expiryDate?: string) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const getFilteredUsers = (users: User[]) => {
    let filtered = users;

    if (searchText) {
      filtered = filtered.filter(
        (user) =>
          user.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
          user.contact_number?.includes(searchText) ||
          user.license_number?.includes(searchText)
      );
    }

    if (roleFilter !== "all") {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    return filtered;
  };

  const columns = [
    {
      title: "Name",
      key: "name",
      render: (record: User) => (
        <div>
          <Text strong>{record.fullName || "N/A"}</Text>
          {record.contact_number && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: "12px" }}>
                {record.contact_number}
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (role: string) => getRoleTag(role),
    },
    {
      title: "Contact",
      key: "contact",
      render: (record: User) => (
        <div>
          <Text>{record.contact_number || "N/A"}</Text>
          {record.emergency_contact && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: "12px" }}>
                Emergency: {record.emergency_contact}
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: "License Info",
      key: "license",
      render: (record: User) =>
        record.role === "driver" ? (
          <div>
            <Text style={{ fontSize: "12px" }}>
              {record.license_number || "N/A"}
            </Text>
            {record.license_expiry && (
              <>
                <br />
                <Text
                  type="secondary"
                  style={{
                    fontSize: "12px",
                    color: isLicenseExpired(record.license_expiry)
                      ? "#ff4d4f"
                      : undefined,
                  }}
                >
                  Expires:{" "}
                  {new Date(record.license_expiry).toLocaleDateString()}
                  {isLicenseExpired(record.license_expiry) && " (Expired)"}
                </Text>
              </>
            )}
          </div>
        ) : (
          <Text type="secondary">N/A</Text>
        ),
    },
    {
      title: "Push Token",
      dataIndex: "push_token",
      key: "push_token",
      render: (token: string) =>
        token ? (
          <Tag color="green">Active</Tag>
        ) : (
          <Tag color="red">Inactive</Tag>
        ),
    },
    {
      title: "Last Updated",
      dataIndex: "updated_at",
      key: "updated_at",
      render: (text: string) => formatTime(text),
    },
    {
      title: "Actions",
      key: "actions",
      render: (record: User) => {
        const content = (
          <div style={{ minWidth: 200 }}>
            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Role</Text>
              <div><Tag color={record.role === "admin" ? "red" : record.role === "driver" ? "blue" : record.role === "conductor" ? "green" : "default"}>{record.role}</Tag></div>
            </div>
            {record.contact_number && (
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Phone</Text>
                <div><Text>{record.contact_number}</Text></div>
              </div>
            )}
            {record.emergency_contact && (
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Emergency</Text>
                <div><Text>{record.emergency_contact}</Text></div>
              </div>
            )}
            {record.license_number && (
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>License</Text>
                <div><Text>{record.license_number}</Text></div>
                {record.license_expiry && (
                  <Text type="secondary" style={{ fontSize: 12, color: isLicenseExpired(record.license_expiry) ? "#ef4444" : undefined }}>
                    Expires {new Date(record.license_expiry).toLocaleDateString()}
                    {isLicenseExpired(record.license_expiry) && " ⚠️"}
                  </Text>
                )}
              </div>
            )}
            <div>
              <Text type="secondary" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Push Notifications</Text>
              <div><Tag color={record.push_token ? "green" : "red"}>{record.push_token ? "Active" : "Inactive"}</Tag></div>
            </div>
          </div>
        );

        return (
          <Space>
            <Popover content={content} title={record.fullName || "User Details"} trigger="click" placement="left">
              <Button type="link" icon={<EyeOutlined />}>
                View Details
              </Button>
            </Popover>
          </Space>
        );
      },
    },
  ];

  const driverCount = drivers.length;
  const conductorCount = conductors.length;
  const commuterCount = commuters.length;
  const adminCount = allUsers.filter((user) => user.role === "admin").length;
  const expiredLicenses = drivers.filter((driver) =>
    isLicenseExpired(driver.license_expiry)
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
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(245, 158, 11, 0.35)",
            }}
          >
            <TeamOutlined style={{ fontSize: "20px", color: "white" }} />
          </div>
          <div style={{ cursor: "default" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b" }}>
              User Management
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
              Roles, credentials, and account health
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                <CarOutlined style={{ fontSize: "24px", color: "#1d4ed8" }} />
                <Statistic title="Drivers" value={driverCount} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <SafetyCertificateOutlined style={{ fontSize: "24px", color: "#059669" }} />
                <Statistic title="Conductors" value={conductorCount} valueStyle={{ color: "#059669" }} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <UserOutlined style={{ fontSize: "24px", color: "#7c3aed" }} />
                <Statistic title="Commuters" value={commuterCount} valueStyle={{ color: "#7c3aed" }} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <TeamOutlined style={{ fontSize: "24px", color: "#d97706" }} />
                <Statistic title="Admins" value={adminCount} valueStyle={{ color: "#d97706" }} />
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Expired Licenses Alert */}
        {expiredLicenses > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col span={24}>
              <Alert
                type="error"
                showIcon
                message={`${expiredLicenses} driver license(s) have expired and need attention`}
                style={{ borderRadius: "12px" }}
              />
            </Col>
          </Row>
        )}

        {/* Users Table Card */}
        <Card
          style={{
            borderRadius: "20px",
            border: "none",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
          }}
        >
          <div
            style={{
              marginBottom: "24px",
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Search
              placeholder="Search by name, phone, or license..."
              style={{ width: 320, borderRadius: "12px" }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              size="large"
            />
            <Select
              placeholder="Filter by role"
              style={{ width: 160 }}
              value={roleFilter}
              onChange={setRoleFilter}
              size="large"
            >
              <Option value="all">All Roles</Option>
              <Option value="admin">Admin</Option>
              <Option value="driver">Driver</Option>
              <Option value="conductor">Conductor</Option>
              <Option value="commuter">Commuter</Option>
            </Select>
          </div>

          <Tabs
            defaultActiveKey="all"
            items={[
              {
                key: "all",
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <TeamOutlined />
                    All Users ({allUsers.length})
                  </span>
                ),
                children: (
                  <Table
                    columns={columns}
                    dataSource={getFilteredUsers(allUsers)}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} users`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              },
              {
                key: "drivers",
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <CarOutlined />
                    Drivers ({driverCount})
                  </span>
                ),
                children: (
                  <Table
                    columns={columns}
                    dataSource={getFilteredUsers(drivers)}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} drivers`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              },
              {
                key: "conductors",
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <SafetyCertificateOutlined />
                    Conductors ({conductorCount})
                  </span>
                ),
                children: (
                  <Table
                    columns={columns}
                    dataSource={getFilteredUsers(conductors)}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} conductors`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              },
              {
                key: "commuters",
                label: (
                  <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <UserOutlined />
                    Commuters ({commuterCount})
                  </span>
                ),
                children: (
                  <Table
                    columns={columns}
                    dataSource={getFilteredUsers(commuters)}
                    rowKey="id"
                    pagination={{
                      pageSize: 10,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} commuters`,
                    }}
                    scroll={{ x: 1000 }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
