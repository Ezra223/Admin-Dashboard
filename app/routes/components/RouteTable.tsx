"use client";

import {
    CompassOutlined,
    DeleteOutlined,
    EditOutlined,
    EnvironmentOutlined,
    SearchOutlined,
} from "@ant-design/icons";
import {
    Button as AntButton,
    Card,
    Input,
    Modal,
    Space,
    Table,
    Tag,
    Typography,
} from "antd";
import { useMemo, useState } from "react";
import type { Route } from "../types";

const { Text } = Typography;

interface RouteTableProps {
    routes: Route[];
    loading: boolean;
    onEdit: (route: Route) => void;
    onDelete: (routeId: string) => void;
}

export default function RouteTable({
    routes,
    loading,
    onEdit,
    onDelete,
}: RouteTableProps) {
    const [searchText, setSearchText] = useState("");

    const filteredRoutes = useMemo(() => {
        if (!searchText.trim()) return routes;
        const q = searchText.toLowerCase();
        return routes.filter(
            (r) =>
                r.name?.toLowerCase().includes(q) ||
                r.start_address?.toLowerCase().includes(q) ||
                r.end_address?.toLowerCase().includes(q)
        );
    }, [routes, searchText]);

    const formatTime = (timeString: string) => {
        return new Date(timeString).toLocaleString();
    };

    const columns = [
        {
            title: "Route Name",
            dataIndex: "name",
            key: "name",
            render: (text: string, record: Route) => (
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <CompassOutlined style={{ color: "#4f46e5", fontSize: "18px" }} />
                        <div>
                            <Text strong style={{ color: "#1e293b", fontSize: "14px" }}>
                                {text}
                            </Text>
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Start Address",
            dataIndex: "start_address",
            key: "start_address",
            render: (text: string) => (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <EnvironmentOutlined style={{ color: "#059669" }} />
                    <Text style={{ color: "#64748b", fontSize: "13px" }}>
                        {text
                            ? text.length > 40
                                ? text.substring(0, 40) + "..."
                                : text
                            : "N/A"}
                    </Text>
                </div>
            ),
        },
        {
            title: "End Address",
            dataIndex: "end_address",
            key: "end_address",
            render: (text: string) => (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <EnvironmentOutlined style={{ color: "#dc2626" }} />
                    <Text style={{ color: "#64748b", fontSize: "13px" }}>
                        {text
                            ? text.length > 40
                                ? text.substring(0, 40) + "..."
                                : text
                            : "N/A"}
                    </Text>
                </div>
            ),
        },
        {
            title: "Stops",
            dataIndex: "stops_count",
            key: "stops_count",
            width: 100,
            render: (count: number | undefined) => (
                <Tag
                    color={count && count > 0 ? "geekblue" : "default"}
                    style={{
                        borderRadius: "12px",
                        fontWeight: 600,
                        fontSize: "12px",
                        padding: "2px 10px",
                    }}
                >
                    {count && count > 0 ? `${count} stops` : "—"}
                </Tag>
            ),
        },
        {
            title: "Created",
            dataIndex: "created_at",
            key: "created_at",
            render: (text: string) => (
                <Text style={{ color: "#94a3b8", fontSize: "12px" }}>
                    {formatTime(text)}
                </Text>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            render: (record: Route) => (
                <Space size="small">
                    <AntButton
                        type="text"
                        icon={<EditOutlined />}
                        onClick={() => onEdit(record)}
                        style={{
                            color: "#6366f1",
                            borderRadius: "8px",
                        }}
                    >
                        Edit
                    </AntButton>
                    <AntButton
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                            Modal.confirm({
                                title: "Delete Route",
                                content: `Are you sure you want to delete the route "${record.name}"?`,
                                okText: "Delete",
                                okButtonProps: { danger: true },
                                onOk: () => onDelete(record.id),
                            });
                        }}
                        style={{ borderRadius: "8px" }}
                    >
                        Delete
                    </AntButton>
                </Space>
            ),
        },
    ];

    return (
        <Card
            title={
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <CompassOutlined style={{ color: "#db2777", fontSize: "20px" }} />
                    <div>
                        <div
                            style={{
                                fontWeight: 700,
                                fontSize: "16px",
                                color: "#1e293b",
                            }}
                        >
                            Transportation Routes
                        </div>
                        <div style={{ fontSize: "12px", color: "#64748b" }}>
                            {filteredRoutes.length === routes.length
                                ? `${routes.length} routes configured`
                                : `${filteredRoutes.length} of ${routes.length} routes`}
                        </div>
                    </div>
                </div>
            }
            extra={
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <Input
                        className="route-search-input"
                        bordered={false}
                        placeholder="Search routes..."
                        prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        allowClear
                        style={{
                            width: "220px",
                            borderRadius: "10px",
                            boxShadow: "none",
                        }}
                    />
                </div>
            }
            style={{
                borderRadius: "16px",
            }}
        >
            <style jsx global>{`
                .route-search-input.ant-input-affix-wrapper,
                .route-search-input.ant-input-affix-wrapper:hover,
                .route-search-input.ant-input-affix-wrapper:focus,
                .route-search-input.ant-input-affix-wrapper-focused {
                    border: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                    background: #ffffff !important;
                }

                .route-search-input .ant-input,
                .route-search-input .ant-input:focus {
                    border: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                    background: transparent !important;
                }
            `}</style>
            <Table
                columns={columns}
                dataSource={filteredRoutes}
                rowKey="id"
                loading={loading}
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} routes`,
                }}
                scroll={{ x: 800 }}
            />
        </Card>
    );
}
