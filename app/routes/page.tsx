"use client";

import {
  CompassOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Button, Space, Spin, message } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import {
  getAllRoutes,
  createRoute,
  updateRoute,
  deleteRoute,
  getStopsCountByRoute,
  getRouteStops,
  saveRouteStops,
} from "../../lib/queries";
import { get as getCached, setCached } from "../../lib/navCache";
import { useAuth } from "../providers/AuthProvider";
import type { Route, RouteStop } from "./types";
import RouteStatsCards from "./components/RouteStatsCards";
import RouteTable from "./components/RouteTable";
import RouteFormModal from "./components/RouteFormModal";

export default function RoutesPage() {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [editingStops, setEditingStops] = useState<RouteStop[]>([]);

  // Auth guards
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    } else if (!loading && user && !isAdmin) {
      message.error("Access denied. Admin privileges required.");
      router.push("/");
    }
  }, [user, loading, isAdmin, router]);

  // Load routes on mount
  useEffect(() => {
    let isSubscribed = true;
    if (user && isAdmin && !dataLoaded && isSubscribed) {
      loadRoutes(true);
      setDataLoaded(true);
    }
    return () => {
      isSubscribed = false;
    };
  }, [user, isAdmin, dataLoaded]);

  const loadRoutes = async (useCache = false) => {
    try {
      if (useCache) {
        const cachedRoutes = getCached<any[]>("routes:all");
        const cachedStopsCount = getCached<Record<string, number>>("routes:stopsCount");

        if (cachedRoutes && cachedStopsCount) {
          const routesWithStops = cachedRoutes.map((r: any) => ({
            ...r,
            stops_count: cachedStopsCount[r.id] || 0,
          }));
          setRoutes(routesWithStops);
          setLoadingData(false);
          loadRoutes(false);
          return;
        }
      }

      setLoadingData(true);
      const [routesResult, stopsResult] = await Promise.all([
        getAllRoutes(),
        getStopsCountByRoute(),
      ]);

      if (routesResult.error) {
        console.error("Error loading routes:", routesResult.error);
        message.error("Failed to load routes");
        setRoutes([]);
      } else {
        // Merge stops count into routes
        const stopsCounts = (stopsResult.data || {}) as Record<string, number>;
        const routesWithStops = (routesResult.data || []).map((r: any) => ({
          ...r,
          stops_count: stopsCounts[r.id] || 0,
        }));
        setRoutes(routesWithStops);
        setCached("routes:all", routesResult.data || []);
        setCached("routes:stopsCount", stopsCounts);
      }
    } catch (error) {
      console.error("Error loading routes:", error);
      message.error("Failed to load routes");
      setRoutes([]);
    } finally {
      setLoadingData(false);
    }
  };

  const openCreateModal = () => {
    setEditingRoute(null);
    setEditingStops([]);
    setModalVisible(true);
  };

  const handleEdit = async (route: Route) => {
    setEditingRoute(route);
    // Load existing stops for this route
    const { data: stops } = await getRouteStops(route.id);
    setEditingStops(
      (stops || []).map((s: any) => ({
        id: s.id,
        route_id: s.route_id,
        name: s.name,
        address: s.address,
        latitude: s.latitude,
        longitude: s.longitude,
        stop_order: s.stop_order,
        is_common_stop: s.is_common_stop,
      }))
    );
    setModalVisible(true);
  };

  const handleDelete = async (routeId: string) => {
    try {
      const result: any = await deleteRoute(routeId);
      if (result?.error) {
        message.error(
          `Failed to delete route: ${result.error.message || "Unknown error"}`,
          5
        );
        return;
      }
      message.success("Route deleted successfully");
      await loadRoutes();
    } catch (err) {
      console.error("Exception deleting route:", err);
      message.error(`Failed to delete route: ${String(err)}`, 5);
    }
  };

  const handleSave = async (routeData: {
    name: string;
    start_address: string;
    end_address: string;
    path: string;
    stops: RouteStop[];
  }) => {
    const { stops, ...routeFields } = routeData;

    let result: any;
    if (editingRoute) {
      result = await updateRoute(editingRoute.id, routeFields);
    } else {
      result = await createRoute(routeFields);
    }

    if (result?.error) {
      console.error("Route save error:", result.error);
      message.error(result.error.message || "Failed to save route", 5);
      throw new Error(result.error.message);
    }

    // Determine route ID for stops
    const routeId = editingRoute?.id || result.data;

    // Save stops if we have a route ID
    if (routeId && stops.length > 0) {
      const stopsResult = await saveRouteStops(routeId, stops);
      if (stopsResult.error) {
        console.warn("Failed to save stops:", stopsResult.error);
        message.warning(
          "Route saved but stops failed to save. The route_stops table may need to be created."
        );
      }
    }

    message.success(
      editingRoute ? "Route updated successfully" : "Route created successfully",
      3
    );
    setModalVisible(false);
    setEditingRoute(null);
    setEditingStops([]);
    await loadRoutes();
  };

  // Show loading spinner during initial auth/data load
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

  const totalStops = routes.reduce((sum, route) => sum + (route.stops_count || 0), 0);

  return (
    <div className="admin-layout admin-layout--minimal">
      <div className="admin-header">
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.22)",
            }}
          >
            <CompassOutlined style={{ fontSize: "20px", color: "white" }} />
          </div>
          <div style={{ cursor: "default" }}>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e293b" }}>
              Route Management
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
              Create, monitor, and maintain transport routes
            </div>
          </div>
        </div>

        <Space size={12}>
          <Button
            onClick={openCreateModal}
            type="primary"
            icon={<PlusOutlined />}
            style={{
              background: "#0f172a",
              border: "1px solid #0f172a",
              borderRadius: "12px",
              fontWeight: 600,
              height: "40px",
            }}
          >
            New Route
          </Button>
          <Button
            onClick={() => loadRoutes(false)}
            icon={<ReloadOutlined spin={loadingData} />}
            style={{
              borderRadius: "12px",
              fontWeight: 600,
              height: "40px",
            }}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <div className="admin-content">
        <RouteStatsCards
          routes={routes}
          totalStops={totalStops}
        />

        <RouteTable
          routes={routes}
          loading={loadingData}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />

        <RouteFormModal
          open={modalVisible}
          editingRoute={editingRoute}
          existingStops={editingStops}
          onClose={() => {
            setModalVisible(false);
            setEditingRoute(null);
            setEditingStops([]);
          }}
          onSave={handleSave}
        />
      </div>
      <Toaster />
    </div>
  );
}
