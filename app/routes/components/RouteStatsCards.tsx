"use client";

import {
    CompassOutlined,
    EnvironmentOutlined,
} from "@ant-design/icons";
import { Card, Col, Row, Space, Statistic } from "antd";
import type { Route } from "../types";

interface RouteStatsCardsProps {
    routes: Route[];
    totalStops: number;
}

export default function RouteStatsCards({
    routes,
    totalStops,
}: RouteStatsCardsProps) {
    const routesWithPaths = routes.filter((r) => r.path).length;

    return (
        <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
            <Col xs={24} sm={12} lg={8}>
                <Card bordered={false} style={{ height: "100%" }}>
                    <Space direction="vertical" size={10}>
                        <CompassOutlined style={{ fontSize: "24px", color: "#4f46e5" }} />
                        <Statistic title="Total Routes" value={routes.length} />
                    </Space>
                </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
                <Card bordered={false} style={{ height: "100%" }}>
                    <Space direction="vertical" size={10}>
                        <EnvironmentOutlined style={{ fontSize: "24px", color: "#059669" }} />
                        <Statistic title="Total Stops" value={totalStops} />
                    </Space>
                </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
                <Card bordered={false} style={{ height: "100%" }}>
                    <Space direction="vertical" size={10}>
                        <EnvironmentOutlined style={{ fontSize: "24px", color: "#db2777" }} />
                        <Statistic title="Routes with Paths" value={routesWithPaths} />
                    </Space>
                </Card>
            </Col>
        </Row>
    );
}
