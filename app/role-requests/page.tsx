"use client";

import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    DownloadOutlined,
    EyeOutlined,
    FileTextOutlined,
    IdcardOutlined,
    ReloadOutlined,
    SafetyCertificateOutlined,
    SearchOutlined,
    UserOutlined,
} from "@ant-design/icons";
import {
    Alert,
    Button,
    Card,
    Col,
    Input,
    Modal,
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
import {
    RoleRequest,
    approveRoleRequest,
    getRoleRequests,
    rejectRoleRequest,
} from "../../lib/queries";
import { useAuth } from "../providers/AuthProvider";

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

export default function RoleRequestsPage() {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();
    const [allRequests, setAllRequests] = useState<RoleRequest[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [roleFilter, setRoleFilter] = useState<string>("all");
    const [selectedRequest, setSelectedRequest] = useState<RoleRequest | null>(null);
    const [detailsModalVisible, setDetailsModalVisible] = useState(false);
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

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
            loadData();
            setDataLoaded(true);
        }

        return () => {
            isSubscribed = false;
        };
    }, [user, isAdmin, dataLoaded]);

    const loadData = async () => {
        try {
            setLoadingData(true);
            const result = await getRoleRequests();
            setAllRequests(result.data || []);

            if ((result.data || []).length === 0) {
                message.info("No role requests found.");
            }
        } catch (error) {
            console.error("Error loading role requests:", error);
            message.error("Failed to load role requests");
        } finally {
            setLoadingData(false);
        }
    };

    const handleApprove = async (request: RoleRequest) => {
        if (!user) return;

        Modal.confirm({
            title: "Approve Role Request",
            content: (
                <div>
                    <p>Are you sure you want to approve this request?</p>
                    <p style={{ marginTop: "8px" }}>
                        <strong>{request.full_name}</strong> will be granted the role of{" "}
                        <Tag color={request.requested_role === "driver" ? "blue" : "green"}>
                            {request.requested_role}
                        </Tag>
                    </p>
                </div>
            ),
            okText: "Approve",
            okButtonProps: {
                style: {
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                },
            },
            onOk: async () => {
                setActionLoading(true);
                const { error } = await approveRoleRequest(request.id, user.id);
                setActionLoading(false);

                if (error) {
                    message.error("Failed to approve request: " + error.message);
                } else {
                    message.success("Request approved successfully!");
                    loadData();
                }
            },
        });
    };

    const handleReject = (request: RoleRequest) => {
        setSelectedRequest(request);
        setRejectReason("");
        setRejectModalVisible(true);
    };

    const confirmReject = async () => {
        if (!user || !selectedRequest) return;
        if (!rejectReason.trim()) {
            message.warning("Please provide a rejection reason");
            return;
        }

        setActionLoading(true);
        const { error } = await rejectRoleRequest(
            selectedRequest.id,
            user.id,
            rejectReason.trim()
        );
        setActionLoading(false);

        if (error) {
            message.error("Failed to reject request: " + error.message);
        } else {
            message.success("Request rejected");
            setRejectModalVisible(false);
            setSelectedRequest(null);
            setRejectReason("");
            loadData();
        }
    };

    const viewDetails = (request: RoleRequest) => {
        setSelectedRequest(request);
        setDetailsModalVisible(true);
    };

    const getStatusTag = (status: string) => {
        const statusConfig = {
            pending: { color: "orange", text: "Pending" },
            approved: { color: "green", text: "Approved" },
            rejected: { color: "red", text: "Rejected" },
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config?.color || "default"}>{config?.text || status}</Tag>;
    };

    const getRoleTag = (role: string) => {
        const roleConfig = {
            driver: { color: "blue", text: "Driver" },
            conductor: { color: "green", text: "Conductor" },
        };
        const config = roleConfig[role as keyof typeof roleConfig];
        return <Tag color={config?.color || "default"}>{config?.text || role}</Tag>;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getResumeUrl = (resumePath: string) => {
        // If already a full URL, return as-is
        if (resumePath.startsWith("http")) {
            return resumePath;
        }
        // Construct the full Supabase storage public URL from env variable
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) return "#"; // env var must be set
        return `${supabaseUrl}/storage/v1/object/public/role-requests/resumes/${resumePath}?download=true`;
    };

    const getFilteredRequests = (requests: RoleRequest[], statusFilter?: string) => {
        let filtered = requests;

        if (statusFilter && statusFilter !== "all") {
            filtered = filtered.filter((req) => req.status === statusFilter);
        }

        if (roleFilter !== "all") {
            filtered = filtered.filter((req) => req.requested_role === roleFilter);
        }

        if (searchText) {
            filtered = filtered.filter(
                (req) =>
                    req.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
                    req.email.toLowerCase().includes(searchText.toLowerCase()) ||
                    req.phone_number.includes(searchText)
            );
        }

        return filtered;
    };

    const pendingCount = allRequests.filter((r) => r.status === "pending").length;
    const approvedCount = allRequests.filter((r) => r.status === "approved").length;
    const rejectedCount = allRequests.filter((r) => r.status === "rejected").length;

    const columns = [
        {
            title: "Applicant",
            key: "applicant",
            render: (record: RoleRequest) => (
                <div>
                    <Text strong>{record.full_name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: "12px" }}>
                        {record.email}
                    </Text>
                </div>
            ),
        },
        {
            title: "Phone",
            dataIndex: "phone_number",
            key: "phone_number",
        },
        {
            title: "Role",
            dataIndex: "requested_role",
            key: "requested_role",
            render: (role: string) => getRoleTag(role),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (status: string) => getStatusTag(status),
        },
        {
            title: "License #",
            dataIndex: "license_number",
            key: "license_number",
            render: (license: string) => license || <Text type="secondary">N/A</Text>,
        },
        {
            title: "Submitted",
            dataIndex: "created_at",
            key: "created_at",
            render: (date: string) => formatDate(date),
        },
        {
            title: "Actions",
            key: "actions",
            render: (record: RoleRequest) => (
                <Space size="small">
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => viewDetails(record)}
                    >
                        View
                    </Button>
                    {record.status === "pending" && (
                        <>
                            <Button
                                type="link"
                                icon={<CheckCircleOutlined />}
                                style={{ color: "#10b981" }}
                                onClick={() => handleApprove(record)}
                            >
                                Approve
                            </Button>
                            <Button
                                type="link"
                                icon={<CloseCircleOutlined />}
                                danger
                                onClick={() => handleReject(record)}
                            >
                                Reject
                            </Button>
                        </>
                    )}
                </Space>
            ),
        },
    ];

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
            {/* Header */}
            <div className="admin-header">
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div
                        style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "12px",
                            background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 4px 12px rgba(236, 72, 153, 0.35)",
                        }}
                    >
                        <IdcardOutlined style={{ fontSize: "20px", color: "white" }} />
                    </div>
                    <div style={{ cursor: "default" }}>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b" }}>
                            Role Requests
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
                            Review and process applications
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
                                <FileTextOutlined style={{ fontSize: "24px", color: "#7c3aed" }} />
                                <Statistic title="Total Requests" value={allRequests.length} />
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card bordered={false} style={{ height: "100%" }}>
                            <Space direction="vertical" size={10}>
                                <UserOutlined style={{ fontSize: "24px", color: "#d97706" }} />
                                <Statistic title="Pending" value={pendingCount} valueStyle={{ color: "#d97706" }} />
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card bordered={false} style={{ height: "100%" }}>
                            <Space direction="vertical" size={10}>
                                <CheckCircleOutlined style={{ fontSize: "24px", color: "#059669" }} />
                                <Statistic title="Approved" value={approvedCount} valueStyle={{ color: "#059669" }} />
                            </Space>
                        </Card>
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                        <Card bordered={false} style={{ height: "100%" }}>
                            <Space direction="vertical" size={10}>
                                <CloseCircleOutlined style={{ fontSize: "24px", color: "#dc2626" }} />
                                <Statistic title="Rejected" value={rejectedCount} valueStyle={{ color: "#dc2626" }} />
                            </Space>
                        </Card>
                    </Col>
                </Row>

                {/* Pending Alert */}
                {pendingCount > 0 && (
                    <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
                        <Col span={24}>
                            <Alert
                                type="warning"
                                showIcon
                                message={`${pendingCount} role request(s) are pending review`}
                                style={{ borderRadius: "12px" }}
                            />
                        </Col>
                    </Row>
                )}

                {/* Table Card */}
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
                            placeholder="Search by name, email, or phone..."
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
                            <Option value="driver">Driver</Option>
                            <Option value="conductor">Conductor</Option>
                        </Select>
                    </div>

                    <Tabs
                        defaultActiveKey="all"
                        items={[
                            {
                                key: "all",
                                label: (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <FileTextOutlined />
                                        All Requests ({allRequests.length})
                                    </span>
                                ),
                                children: (
                                    <Table
                                        columns={columns}
                                        dataSource={getFilteredRequests(allRequests)}
                                        rowKey="id"
                                        pagination={{
                                            pageSize: 10,
                                            showSizeChanger: true,
                                            showQuickJumper: true,
                                            showTotal: (total, range) =>
                                                `${range[0]}-${range[1]} of ${total} requests`,
                                        }}
                                        scroll={{ x: 1000 }}
                                    />
                                ),
                            },
                            {
                                key: "pending",
                                label: (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <UserOutlined />
                                        Pending ({pendingCount})
                                    </span>
                                ),
                                children: (
                                    <Table
                                        columns={columns}
                                        dataSource={getFilteredRequests(allRequests, "pending")}
                                        rowKey="id"
                                        pagination={{
                                            pageSize: 10,
                                            showSizeChanger: true,
                                            showQuickJumper: true,
                                            showTotal: (total, range) =>
                                                `${range[0]}-${range[1]} of ${total} pending`,
                                        }}
                                        scroll={{ x: 1000 }}
                                    />
                                ),
                            },
                            {
                                key: "approved",
                                label: (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <CheckCircleOutlined />
                                        Approved ({approvedCount})
                                    </span>
                                ),
                                children: (
                                    <Table
                                        columns={columns}
                                        dataSource={getFilteredRequests(allRequests, "approved")}
                                        rowKey="id"
                                        pagination={{
                                            pageSize: 10,
                                            showSizeChanger: true,
                                            showQuickJumper: true,
                                            showTotal: (total, range) =>
                                                `${range[0]}-${range[1]} of ${total} approved`,
                                        }}
                                        scroll={{ x: 1000 }}
                                    />
                                ),
                            },
                            {
                                key: "rejected",
                                label: (
                                    <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <CloseCircleOutlined />
                                        Rejected ({rejectedCount})
                                    </span>
                                ),
                                children: (
                                    <Table
                                        columns={columns}
                                        dataSource={getFilteredRequests(allRequests, "rejected")}
                                        rowKey="id"
                                        pagination={{
                                            pageSize: 10,
                                            showSizeChanger: true,
                                            showQuickJumper: true,
                                            showTotal: (total, range) =>
                                                `${range[0]}-${range[1]} of ${total} rejected`,
                                        }}
                                        scroll={{ x: 1000 }}
                                    />
                                ),
                            },
                        ]}
                    />
                </Card>
            </div>

            {/* Details Modal */}
            <Modal
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <IdcardOutlined style={{ color: "white", fontSize: "18px" }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "18px" }}>
                            Application Details
                        </span>
                    </div>
                }
                open={detailsModalVisible}
                onCancel={() => {
                    setDetailsModalVisible(false);
                    setSelectedRequest(null);
                }}
                footer={
                    selectedRequest?.status === "pending" ? (
                        <Space>
                            <Button onClick={() => setDetailsModalVisible(false)}>Close</Button>
                            <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                style={{
                                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                    border: "none",
                                }}
                                onClick={() => {
                                    setDetailsModalVisible(false);
                                    handleApprove(selectedRequest);
                                }}
                            >
                                Approve
                            </Button>
                            <Button
                                danger
                                icon={<CloseCircleOutlined />}
                                onClick={() => {
                                    setDetailsModalVisible(false);
                                    handleReject(selectedRequest);
                                }}
                            >
                                Reject
                            </Button>
                        </Space>
                    ) : (
                        <Button onClick={() => setDetailsModalVisible(false)}>Close</Button>
                    )
                }
                width={600}
            >
                {selectedRequest && (
                    <div style={{ padding: "16px 0" }}>
                        <Row gutter={[16, 24]}>
                            <Col span={12}>
                                <Text type="secondary">Full Name</Text>
                                <div style={{ fontWeight: 600, fontSize: "15px", marginTop: "4px" }}>
                                    {selectedRequest.full_name}
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Status</Text>
                                <div style={{ marginTop: "4px" }}>
                                    {getStatusTag(selectedRequest.status)}
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Email</Text>
                                <div style={{ fontWeight: 600, fontSize: "15px", marginTop: "4px" }}>
                                    {selectedRequest.email}
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Phone</Text>
                                <div style={{ fontWeight: 600, fontSize: "15px", marginTop: "4px" }}>
                                    {selectedRequest.phone_number}
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">Requested Role</Text>
                                <div style={{ marginTop: "4px" }}>
                                    {getRoleTag(selectedRequest.requested_role)}
                                </div>
                            </Col>
                            <Col span={12}>
                                <Text type="secondary">License Number</Text>
                                <div style={{ fontWeight: 600, fontSize: "15px", marginTop: "4px" }}>
                                    {selectedRequest.license_number || "N/A"}
                                </div>
                            </Col>
                            <Col span={24}>
                                <Text type="secondary">Submitted</Text>
                                <div style={{ fontWeight: 600, fontSize: "15px", marginTop: "4px" }}>
                                    {formatDate(selectedRequest.created_at)}
                                </div>
                            </Col>
                            {selectedRequest.resume_path && (
                                <Col span={24}>
                                    <Text type="secondary">Resume</Text>
                                    <div style={{ marginTop: "8px" }}>
                                        <Button
                                            icon={<DownloadOutlined />}
                                            onClick={() =>
                                                window.open(getResumeUrl(selectedRequest.resume_path!), "_blank")
                                            }
                                        >
                                            Download Resume
                                        </Button>
                                    </div>
                                </Col>
                            )}
                            {selectedRequest.status === "rejected" &&
                                selectedRequest.rejection_reason && (
                                    <Col span={24}>
                                        <Text type="secondary">Rejection Reason</Text>
                                        <div
                                            style={{
                                                marginTop: "8px",
                                                padding: "12px",
                                                background: "rgba(239, 68, 68, 0.1)",
                                                borderRadius: "8px",
                                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                            }}
                                        >
                                            <Text style={{ color: "#dc2626" }}>
                                                {selectedRequest.rejection_reason}
                                            </Text>
                                        </div>
                                    </Col>
                                )}
                            {selectedRequest.notes && (
                                <Col span={24}>
                                    <Text type="secondary">Notes</Text>
                                    <div
                                        style={{
                                            marginTop: "8px",
                                            padding: "12px",
                                            background: "rgba(99, 102, 241, 0.1)",
                                            borderRadius: "8px",
                                            border: "1px solid rgba(99, 102, 241, 0.2)",
                                        }}
                                    >
                                        <Text>{selectedRequest.notes}</Text>
                                    </div>
                                </Col>
                            )}
                            {selectedRequest.reviewed_at && (
                                <Col span={24}>
                                    <Text type="secondary">Reviewed At</Text>
                                    <div style={{ fontWeight: 600, fontSize: "15px", marginTop: "4px" }}>
                                        {formatDate(selectedRequest.reviewed_at)}
                                    </div>
                                </Col>
                            )}
                        </Row>
                    </div>
                )}
            </Modal>

            {/* Reject Modal */}
            <Modal
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div
                            style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "10px",
                                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CloseCircleOutlined style={{ color: "white", fontSize: "18px" }} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "18px" }}>Reject Request</span>
                    </div>
                }
                open={rejectModalVisible}
                onCancel={() => {
                    setRejectModalVisible(false);
                    setSelectedRequest(null);
                    setRejectReason("");
                }}
                footer={
                    <Space>
                        <Button
                            onClick={() => {
                                setRejectModalVisible(false);
                                setSelectedRequest(null);
                                setRejectReason("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            danger
                            type="primary"
                            loading={actionLoading}
                            onClick={confirmReject}
                        >
                            Reject Request
                        </Button>
                    </Space>
                }
            >
                {selectedRequest && (
                    <div style={{ padding: "16px 0" }}>
                        <p style={{ marginBottom: "16px" }}>
                            Are you sure you want to reject the application from{" "}
                            <strong>{selectedRequest.full_name}</strong>?
                        </p>
                        <Text type="secondary">Rejection Reason (required)</Text>
                        <TextArea
                            rows={4}
                            placeholder="Please provide a reason for rejecting this request..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            style={{ marginTop: "8px" }}
                        />
                    </div>
                )}
            </Modal>
        </div>
    );
}
