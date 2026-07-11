"use client";

import {
  CarOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Modal,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import {
  assignDriverToBus,
  getAllBuses,
  getDrivers,
  getConductors,
  updateBusStatus,
  updateBusAssignment,
} from "../../lib/queries";
import { get as getCached } from "../../lib/navCache";
import { realtimeManager } from "../../lib/realtime";
import { useAuth } from "../providers/AuthProvider";

const { Title, Text } = Typography;
const { Option } = Select;

interface Bus {
  id: string;
  plate_number: string;
  body_number?: string;
  capacity: number;
  passengers: number;
  status: "active" | "inactive";
  route_id: string;
  driver_id?: string;
  conductor_id?: string;
  routes?: {
    id: string;
    name: string;
    start_address: string;
    end_address: string;
  };
  driver?: {
    id: string;
    fullName: string;
    contact_number?: string;
    license_number?: string;
    license_expiry?: string;
  };
  conductor?: {
    id: string;
    fullName: string;
    contact_number?: string;
  };
}

interface Driver {
  id: string;
  fullName: string;
  contact_number?: string;
  license_number?: string;
  license_expiry?: string;
}

interface Conductor {
  id: string;
  fullName: string;
  contact_number?: string;
}

export default function FleetPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [conductors, setConductors] = useState<Conductor[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if data already loaded
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedBus, setSelectedBus] = useState<Bus | null>(null);
  const [form] = Form.useForm();

  // Ref to track if initialization has started to prevent double-execution in StrictMode
  const isInitializingRef = useRef(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && !isAdmin) {
      message.error("Access denied. Admin privileges required.");
      router.push("/");
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (loading || !user || !isAdmin) return;

    // Initial data load — use cache if available (pre-warmed from dashboard hover)
    if (!dataLoaded && !isInitializingRef.current) {
      isInitializingRef.current = true;
      loadData(true).then(() => {
        setDataLoaded(true);
      });
    }

    // Setup realtime subscription
    const handleBusUpdate = () => {
      loadData();
    };

    realtimeManager.subscribeToBuses({
      onBusUpdate: handleBusUpdate,
    });

    return () => {
      realtimeManager.unsubscribe("buses");
      // Reset initialization ref on unmount is optional depending on desired behavior, 
      // but usually for strict mode we want to keep it true if we don't want re-fetch.
      // However, if we unmount "for real", we want to reset. 
      // In this specific case, leaking the ref value (if it were global) would be bad, but it's local to instance.
      // React StrictMode destroys and recreates the component instance? No, it unmounts and remounts. 
      // Refs are reset on remount. Wait, double-invoke preserves ref? 
      // No, strict mode double-invokes EFFECTS, and for components it unmounts/remounts but keeps state? 
      // Actually Strict Mode in dev does: Mount -> Unmount -> Mount.
      // So ref starts fresh on second mount. 
      // So preventing double fetch across strict mode "Mount-Unmount-Mount" requires a global cache or identifying request persistence.
      // BUT `dataLoaded` state update might be the key?
      // Since we can't easily prevent StrictMode double-fetch without a global cache, we should just handle the AbortError or race gracefully.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, loading]);

  const loadData = async (useCache = false) => {
    try {
      // Check the nav cache first — data may have been pre-warmed on hover
      if (useCache) {
        const cachedBuses = getCached<any[]>("fleet:buses");
        const cachedDrivers = getCached<any[]>("fleet:drivers");
        const cachedConductors = getCached<any[]>("fleet:conductors");

        if (cachedBuses && cachedDrivers && cachedConductors) {
          const transformedBuses = cachedBuses.map((bus: any) => ({
            ...bus,
            routes: Array.isArray(bus.routes) ? bus.routes[0] : bus.routes,
            driver: Array.isArray(bus.driver) ? bus.driver[0] : bus.driver,
            conductor: Array.isArray(bus.conductor) ? bus.conductor[0] : bus.conductor,
          }));
          setBuses(transformedBuses);
          setDrivers(cachedDrivers);
          setConductors(cachedConductors);
          setLoadingData(false);
          // Still refresh in background so data stays current
          loadData(false);
          return;
        }
      }

      setLoadingData(true);
      const [busesResult, driversResult, conductorsResult] = await Promise.all([
        getAllBuses(),
        getDrivers(),
        getConductors(),
      ]);

      if (busesResult.error) throw new Error(`Buses Error: ${busesResult.error.message}`);
      if (driversResult.error) throw new Error(`Drivers Error: ${driversResult.error.message}`);
      if (conductorsResult.error) throw new Error(`Conductors Error: ${conductorsResult.error.message}`);

      const transformedBuses = (busesResult.data || []).map((bus: any) => ({
        ...bus,
        routes: Array.isArray(bus.routes) ? bus.routes[0] : bus.routes,
        driver: Array.isArray(bus.driver) ? bus.driver[0] : bus.driver,
        conductor: Array.isArray(bus.conductor) ? bus.conductor[0] : bus.conductor,
      }));

      setBuses(transformedBuses);
      setDrivers(driversResult.data || []);
      setConductors(conductorsResult.data || []);
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("aborted")) return;
      console.error("Error loading fleet data:", error);
      message.error("Failed to load: " + (error.message || "Unknown error"));
    } finally {
      setLoadingData(false);
    }
  };

  const handleStatusChange = (
    busId: string,
    currentStatus: "active" | "inactive",
    plateNumber: string
  ) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    const action = newStatus === "inactive" ? "Deactivate" : "Activate";

    Modal.confirm({
      title: `${action} Bus`,
      icon: <ExclamationCircleOutlined />,
      content: (
        <span>
          Are you sure you want to <strong>{action.toLowerCase()}</strong> bus{" "}
          <strong>{plateNumber}</strong>?
        </span>
      ),
      okText: action,
      okButtonProps: {
        danger: newStatus === "inactive",
      },
      onOk: async () => {
        try {
          const { error } = await updateBusStatus(busId, newStatus);
          if (error) throw error;
          message.success(`Bus ${plateNumber} ${action.toLowerCase()}d successfully`);
          loadData();
        } catch (error) {
          console.error("Error updating bus status:", error);
          message.error("Failed to update bus status");
        }
      },
    });
  };

  const handleEditBus = async (values: {
    driverId?: string;
    conductorId?: string;
  }) => {
    if (!selectedBus) return;

    try {
      const { data, error } = await updateBusAssignment(selectedBus.id, {
        driverId: values.driverId,
        conductorId: values.conductorId,
      });

      if (error) throw error;

      message.success("Bus assignments updated successfully");
      setEditModalVisible(false);
      setSelectedBus(null);
      form.resetFields();
      loadData();
    } catch (error: any) {
      console.error("Error updating bus assignments:", error);
      if (error.code === "23505") {
        message.error("This driver is already assigned to another bus.");
      } else {
        message.error("Failed to update bus assignments: " + error.message);
      }
    }
  };

  const openEditModal = (bus: Bus) => {
    setSelectedBus(bus);
    setEditModalVisible(true);
    // Set form values after a short delay to ensure form is mounted
    setTimeout(() => {
      form.setFieldsValue({
        bus: bus.plate_number,
        driverId: bus.driver_id || undefined,
        conductorId: bus.conductor_id || undefined,
      });
    }, 100);
  };

  const getStatusTag = (status: string) => {
    const statusConfig = {
      active: { color: "green", text: "Active" },
      inactive: { color: "red", text: "Inactive" },
    };
    const config = statusConfig[status as keyof typeof statusConfig];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: "Plate Number",
      dataIndex: "plate_number",
      key: "plate_number",
      render: (text: string) => (
        <Text strong style={{ color: "#1890ff" }}>
          {text}
        </Text>
      ),
    },
    {
      title: "Body Number",
      dataIndex: "body_number",
      key: "body_number",
      render: (text: string) => (
        <Text strong>
          {text || "-"}
        </Text>
      ),
    },
    {
      title: "Route",
      key: "route",
      render: (record: Bus) => (
        <div>
          <Text strong>{record.routes?.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.routes?.start_address} → {record.routes?.end_address}
          </Text>
        </div>
      ),
    },
    {
      title: "Driver",
      key: "driver",
      render: (record: Bus) =>
        record.driver ? (
          <div>
            <Text>{record.driver.fullName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.driver.contact_number}
            </Text>
          </div>
        ) : (
          <Text type="secondary">No driver assigned</Text>
        ),
    },
    {
      title: "Conductor",
      key: "conductor",
      render: (record: Bus) =>
        record.conductor ? (
          <div>
            <Text>{record.conductor.fullName}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: "12px" }}>
              {record.conductor.contact_number}
            </Text>
          </div>
        ) : (
          <Text type="secondary">No conductor assigned</Text>
        ),
    },
    {
      title: "Capacity",
      key: "capacity",
      render: (record: Bus) => (
        <div>
          <Text>
            {record.passengers}/{record.capacity}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {Math.round((record.passengers / record.capacity) * 100)}% full
          </Text>
        </div>
      ),
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
      render: (record: Bus) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            Edit
          </Button>
          <Button
            type="link"
            danger={record.status === "active"}
            onClick={() =>
              handleStatusChange(
                record.id,
                record.status,
                record.plate_number
              )
            }
          >
            {record.status === "active" ? "Deactivate" : "Activate"}
          </Button>
        </Space>
      ),
    },
  ];
  const activeBuses = buses.filter((bus) => bus.status === "active").length;
  const totalCapacity = buses.reduce((sum, bus) => sum + bus.capacity, 0);
  const totalPassengers = buses.reduce((sum, bus) => sum + bus.passengers, 0);
  const busesWithDrivers = buses.filter((bus) => bus.driver_id).length;

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
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(102, 126, 234, 0.35)",
            }}
          >
            <CarOutlined style={{ fontSize: "20px", color: "white" }} />
          </div>
          <div style={{ cursor: "default" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b" }}>
              Mini Bus Fleet Management
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
              Bus assignment and utilization
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Button
            onClick={() => loadData()}
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
                <CarOutlined style={{ fontSize: "24px", color: "#059669" }} />
                <Statistic title="Active Buses" value={activeBuses} valueStyle={{ color: "#059669" }} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <UserOutlined style={{ fontSize: "24px", color: "#1d4ed8" }} />
                <Statistic title="Total Capacity" value={totalCapacity} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <TeamOutlined style={{ fontSize: "24px", color: "#7c3aed" }} />
                <Statistic title="Current Passengers" value={totalPassengers} valueStyle={{ color: "#7c3aed" }} />
              </Space>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card bordered={false} style={{ height: "100%" }}>
              <Space direction="vertical" size={10}>
                <CheckCircleOutlined style={{ fontSize: "24px", color: "#0891b2" }} />
                <Statistic title="Buses with Drivers" value={busesWithDrivers} valueStyle={{ color: "#0891b2" }} />
              </Space>
            </Card>
          </Col>
        </Row>

        {/* Fleet Table Card */}
        <Card
          title={
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CarOutlined style={{ color: "white", fontSize: "18px" }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "16px", color: "#1e293b" }}>
                  Bus Fleet
                </div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {buses.length} buses registered
                </div>
              </div>
            </div>
          }
          extra={
            <Button
              icon={<ReloadOutlined spin={loadingData} />}
              onClick={() => loadData()}
              style={{
                borderRadius: "10px",
                fontWeight: 600,
              }}
            >
              Refresh
            </Button>
          }
          style={{
            borderRadius: "20px",
            border: "none",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.08)",
          }}
        >
          <Table
            columns={columns}
            dataSource={buses}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} buses`,
            }}
            scroll={{ x: 800 }}
          />
        </Card>

        <Modal
          title="Edit Bus Assignment"
          open={editModalVisible}
          onCancel={() => {
            setEditModalVisible(false);
            setSelectedBus(null);
            form.resetFields();
          }}
          footer={null}
          forceRender
        >
          <Form form={form} layout="vertical" onFinish={handleEditBus}>
            <Form.Item
              label="Bus"
              name="bus"
            >
              <Input disabled />
            </Form.Item>

            <Form.Item
              label="Driver"
              name="driverId"
              help="Drivers assigned to other buses are disabled"
            >
              <Select
                placeholder="Select a driver (Optional)"
                allowClear
                showSearch
                loading={loadingData}
                optionFilterProp="label"
                optionLabelProp="label"
                filterOption={(input, option) =>
                  (option?.label as string ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {drivers.map((driver) => {
                  const isAssigned = buses.some(
                    (b) =>
                      b.driver_id === driver.id && b.id !== selectedBus?.id
                  );
                  return (
                    <Select.Option
                      key={driver.id}
                      value={driver.id}
                      label={driver.fullName}
                      disabled={isAssigned}
                    >
                      <div style={{ opacity: isAssigned ? 0.5 : 1 }}>
                        <Text strong>
                          {driver.fullName}{" "}
                          {isAssigned && <Tag color="error">Assigned</Tag>}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          {driver.contact_number}
                          {driver.license_number
                            ? ` • License: ${driver.license_number}`
                            : ""}
                        </Text>
                      </div>
                    </Select.Option>
                  );
                })}
              </Select>
            </Form.Item>

            <Form.Item label="Conductor" name="conductorId">
              <Select
                placeholder="Select a conductor (Optional)"
                allowClear
                showSearch
                loading={loadingData}
                optionFilterProp="label"
                optionLabelProp="label"
                filterOption={(input, option) =>
                  (option?.label as string ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
                }
              >
                {conductors.map((conductor) => {
                  // Check if conductor is assigned to another bus (if unique constraint exists for conductors too)
                  // The schema provided only shows unique_driver_per_bus, but assuming we might want to check for conductors too or just show them all.
                  // The schema shows: constraint buses_conductor_id_fkey foreign KEY (conductor_id) references users (id)
                  // It does NOT show a unique constraint for conductor_id in the provided schema snippet.
                  // However, logical consistency usually implies one conductor per bus at a time, but they might be able to conduct multiple buses? Unlikely physically.
                  // Let's assume we don't strictly enforce unique conductor in DB but conceptually they can't be in two places.
                  // But since there is no DB constraint, I won't disable them, but I will show if they are assigned.
                  const isAssigned = buses.some(
                    (b) =>
                      b.conductor_id === conductor.id && b.id !== selectedBus?.id
                  );

                  return (
                    <Select.Option
                      key={conductor.id}
                      value={conductor.id}
                      label={conductor.fullName}
                    // Not disabling conductors as there is no specific unique constraint in the provided schema
                    // But maybe good UX to show they are busy?
                    // I will NOT disable, but hint.
                    >
                      <div style={{ opacity: isAssigned ? 0.8 : 1 }}>
                        <Text strong>
                          {conductor.fullName}{" "}
                          {isAssigned && (
                            <Tag color="orange">On Another Bus</Tag>
                          )}
                        </Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: "12px" }}>
                          {conductor.contact_number}
                        </Text>
                      </div>
                    </Select.Option>
                  );
                })}
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Save Changes
                </Button>
                <Button
                  onClick={() => {
                    setEditModalVisible(false);
                    setSelectedBus(null);
                    form.resetFields();
                  }}
                >
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
