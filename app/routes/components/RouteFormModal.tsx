"use client";

import {
    CompassOutlined,
    DeleteOutlined,
    EnvironmentOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
} from "@ant-design/icons";
import {
    Button as AntButton,
    Form,
    Input,
    message,
    Space,
    Typography,
} from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import Map, {
    Marker,
    Source,
    Layer,
    NavigationControl,
    MapRef,
} from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LngLat, Route, RouteInfo, RouteStop } from "../types";
import { useMapServices } from "../hooks/useMapServices";
import { getRoutePathGeoJSON } from "../../../lib/queries";
import LocationPickerModal from "./LocationPickerModal";

const { Text } = Typography;
const { TextArea } = Input;

interface RouteFormModalProps {
    open: boolean;
    editingRoute: Route | null;
    existingStops?: RouteStop[];
    onClose: () => void;
    onSave: (routeData: {
        name: string;
        start_address: string;
        end_address: string;
        path: string;
        stops: RouteStop[];
    }) => Promise<void>;
}

export default function RouteFormModal({
    open,
    editingRoute,
    existingStops = [],
    onClose,
    onSave,
}: RouteFormModalProps) {
    const { mapboxToken, reverseGeocode, geocodeAddress, fetchDirections } =
        useMapServices();
    const [form] = Form.useForm();
    const mapRef = useRef<MapRef | null>(null);

    // Map state
    const [startPosition, setStartPosition] = useState<LngLat | null>(null);
    const [endPosition, setEndPosition] = useState<LngLat | null>(null);
    const mapCenter: LngLat = { lat: 6.7496, lng: 125.3582 };

    // Route preview state
    const [routePolylines, setRoutePolylines] = useState<RouteInfo[]>([]);
    const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(
        null
    );
    const [previewLoading, setPreviewLoading] = useState(false);
    const [routeVersion, setRouteVersion] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    // Location picker state
    const [locationPickerOpen, setLocationPickerOpen] = useState(false);
    const [locationPickerType, setLocationPickerType] = useState<"start" | "end">("start");

    // Stops state
    const [stops, setStops] = useState<RouteStop[]>(existingStops);
    const [addingStops, setAddingStops] = useState(false);
    const [showHelp, setShowHelp] = useState(false);

    // Helper: extract coordinates from whatever format the path comes in
    const extractPathCoordinates = (pathRaw: any): LngLat[] | null => {
        try {
            // Parse string to object if needed
            let pathData = pathRaw;
            if (typeof pathData === "string") {
                pathData = JSON.parse(pathData);
            }

            // Direct GeoJSON LineString: { type: "LineString", coordinates: [[lng,lat], ...] }
            if (pathData?.type === "LineString" && Array.isArray(pathData.coordinates)) {
                return pathData.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
            }

            // GeoJSON Feature wrapper: { type: "Feature", geometry: { type: "LineString", coordinates: ... } }
            if (pathData?.type === "Feature" && pathData?.geometry?.type === "LineString") {
                return pathData.geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
            }

            // Plain coordinates array: [[lng, lat], ...]
            if (Array.isArray(pathData) && pathData.length > 0 && Array.isArray(pathData[0])) {
                return pathData.map(([lng, lat]: [number, number]) => ({ lat, lng }));
            }

            console.warn("Unknown path format:", pathData);
            return null;
        } catch (err) {
            console.warn("Failed to parse path data:", err, pathRaw);
            return null;
        }
    };

    // Apply parsed path coordinates to the map state
    const applyPathToMap = (pathPoints: LngLat[]) => {
        const originCoords = pathPoints[0];
        const destCoords = pathPoints[pathPoints.length - 1];
        setStartPosition(originCoords);
        setEndPosition(destCoords);

        setRoutePolylines([
            {
                path: pathPoints,
                summary: "Saved route",
                distance: "—",
                duration: "—",
            },
        ]);
        setSelectedRouteIndex(0);
        setRouteVersion((v) => v + 1);

        // Fit map to route bounds after map has mounted
        setTimeout(() => {
            if (mapRef.current) {
                const lngs = pathPoints.map((p) => p.lng);
                const lats = pathPoints.map((p) => p.lat);
                mapRef.current.fitBounds(
                    [
                        [Math.min(...lngs), Math.min(...lats)],
                        [Math.max(...lngs), Math.max(...lats)],
                    ],
                    { padding: 50, duration: 1000 }
                );
            }
        }, 500);
    };

    // Initialize form and restore route when modal opens
    useEffect(() => {
        if (open) {
            if (editingRoute) {
                // Populate form fields
                form.setFieldsValue({
                    name: editingRoute.name,
                    start_address: editingRoute.start_address || "",
                    end_address: editingRoute.end_address || "",
                });
                setStops(existingStops);

                // 1) Try to parse path directly from the route object first
                const directCoords = extractPathCoordinates(editingRoute.path);
                if (directCoords && directCoords.length > 0) {
                    applyPathToMap(directCoords);
                } else if (editingRoute.id) {
                    // 2) Fallback: fetch path as GeoJSON via dedicated query/RPC
                    const fetchPath = async () => {
                        const { data } = await getRoutePathGeoJSON(editingRoute.id);
                        if (data) {
                            const coords = extractPathCoordinates(data);
                            if (coords && coords.length > 0) {
                                applyPathToMap(coords);
                            }
                        }
                    };
                    fetchPath();
                }
            } else {
                form.resetFields();
                setStops([]);
                setStartPosition(null);
                setEndPosition(null);
                setRoutePolylines([]);
                setSelectedRouteIndex(null);
            }
            setAddingStops(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingRoute]);

    const handleClose = () => {
        form.resetFields();
        setStartPosition(null);
        setEndPosition(null);
        setRoutePolylines([]);
        setSelectedRouteIndex(null);
        setStops([]);
        setAddingStops(false);
        setShowHelp(false);
        onClose();
    };

    // Map click handler — either set start/end or add a stop
    const handleMapClick = useCallback(
        async (event: MapMouseEvent) => {
            const { lng, lat } = event.lngLat;
            const position: LngLat = { lat, lng };

            if (addingStops) {
                // Adding a stop
                const address = await reverseGeocode(lat, lng);
                const newStop: RouteStop = {
                    name: address
                        ? address.split(",")[0]
                        : `Stop ${stops.length + 1}`,
                    address: address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                    latitude: lat,
                    longitude: lng,
                    stop_order: stops.length + 1,
                };
                setStops((prev) => [...prev, newStop]);
                message.success(`Stop added: ${newStop.name}`);
                return;
            }
        },
        [addingStops, stops.length, reverseGeocode]
    );

    // Preview route
    const previewRoute = async () => {
        const values = form.getFieldsValue();
        if (!values.name?.trim()) {
            message.error("Please enter a route name.");
            return;
        }

        const hasStartPin = startPosition !== null;
        const hasEndPin = endPosition !== null;
        const hasStartAddress = values.start_address?.trim();
        const hasEndAddress = values.end_address?.trim();

        if ((!hasStartPin && !hasStartAddress) || (!hasEndPin && !hasEndAddress)) {
            message.error(
                "Please set both origin and destination (use 'Pick on Map' or enter addresses)."
            );
            return;
        }

        setPreviewLoading(true);
        setRoutePolylines([]);
        setSelectedRouteIndex(null);
        setRouteVersion((v) => v + 1);

        try {
            let originCoords = startPosition;
            let destCoords = endPosition;

            if (!originCoords && hasStartAddress) {
                const originLoc = await geocodeAddress(values.start_address);
                if (!originLoc) return;
                originCoords = { lat: originLoc.latitude, lng: originLoc.longitude };
                setStartPosition(originCoords);
            }

            if (!destCoords && hasEndAddress) {
                const destLoc = await geocodeAddress(values.end_address);
                if (!destLoc) return;
                destCoords = { lat: destLoc.latitude, lng: destLoc.longitude };
                setEndPosition(destCoords);
            }

            if (!originCoords || !destCoords) {
                message.error("Could not determine route coordinates.");
                return;
            }

            const routes = await fetchDirections(originCoords, destCoords);
            if (!routes || routes.length === 0) return;
            setRoutePolylines(routes);
            setSelectedRouteIndex(0);

            if (mapRef.current && routes[0].path.length > 0) {
                const allPoints = [...routes[0].path, originCoords, destCoords];
                const lngs = allPoints.map((p) => p.lng);
                const lats = allPoints.map((p) => p.lat);

                mapRef.current.fitBounds(
                    [
                        [Math.min(...lngs), Math.min(...lats)],
                        [Math.max(...lngs), Math.max(...lats)],
                    ],
                    { padding: 50, duration: 1000 }
                );
            }
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSubmit = async (values: any) => {
        setSubmitting(true);
        try {
            let coordinates: number[][] = [];

            if (selectedRouteIndex !== null && routePolylines[selectedRouteIndex]) {
                coordinates = routePolylines[selectedRouteIndex].path.map((coord) => [
                    coord.lng,
                    coord.lat,
                ]);
            } else if (editingRoute?.path) {
                const existingPath = extractPathCoordinates(editingRoute.path);
                if (existingPath && existingPath.length > 0) {
                    coordinates = existingPath.map((coord) => [coord.lng, coord.lat]);
                }
            }

            if (coordinates.length === 0) {
                message.error(
                    "Please preview and select a route path before saving."
                );
                return;
            }

            const pathGeoJSON = JSON.stringify({
                type: "LineString",
                coordinates,
            });

            await onSave({
                name: values.name,
                start_address: values.start_address,
                end_address: values.end_address,
                path: pathGeoJSON,
                stops,
            });
            handleClose();
        } catch (err) {
            console.error("Exception saving route:", err);
            message.error("Failed to save route (see console)");
        } finally {
            setSubmitting(false);
        }
    };

    // Location picker confirm
    const handleLocationConfirm = (position: LngLat, address: string) => {
        if (locationPickerType === "start") {
            setStartPosition(position);
            form.setFieldsValue({ start_address: address });
        } else {
            setEndPosition(position);
            form.setFieldsValue({ end_address: address });
        }
        setLocationPickerOpen(false);
    };

    const removeStop = (index: number) => {
        setStops((prev) =>
            prev
                .filter((_, i) => i !== index)
                .map((s, i) => ({ ...s, stop_order: i + 1 }))
        );
    };

    const moveStop = (index: number, direction: "up" | "down") => {
        setStops((prev) => {
            const newStops = [...prev];
            const swapIndex = direction === "up" ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= newStops.length) return prev;
            [newStops[index], newStops[swapIndex]] = [
                newStops[swapIndex],
                newStops[index],
            ];
            return newStops.map((s, i) => ({ ...s, stop_order: i + 1 }));
        });
    };

    const updateStopName = (index: number, name: string) => {
        setStops((prev) =>
            prev.map((s, i) => (i === index ? { ...s, name } : s))
        );
    };

    const canManageStops = selectedRouteIndex !== null || !!editingRoute;

    if (!open) return null;

    return (
        <>
            {/* Main Route Modal — rendered via portal by antd */}
            <div
                style={{
                    display: open ? "block" : "none",
                    position: "fixed",
                    inset: 0,
                    zIndex: 1000,
                }}
            >
                <div
                    className="route-modal-compact"
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.45)",
                    }}
                    onClick={handleClose}
                />
                <div
                    style={{
                        position: "fixed",
                        marginTop: "30px",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "min(800px, 86vw)",
                        maxHeight: "86vh",
                        background: "white",
                        borderRadius: "16px",
                        overflow: "hidden",
                        boxShadow: "0 20px 48px rgba(15, 23, 42, 0.2)",
                        zIndex: 1001,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Modal Header */}
                    <div
                        style={{
                            background: "#ffffff",
                            borderBottom: "1px solid #e2e8f0",
                            padding: "20px 24px",
                            position: "relative",
                            overflow: "hidden",
                            flexShrink: 0,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                position: "relative",
                                zIndex: 1,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "16px",
                                }}
                            >
                                <div
                                    style={{
                                        width: "48px",
                                        height: "48px",
                                        borderRadius: "12px",
                                        background: "#0f172a",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <CompassOutlined
                                        style={{ fontSize: "20px", color: "white" }}
                                    />
                                </div>
                                <div>
                                    <div
                                        style={{
                                            fontSize: "17px",
                                            fontWeight: 700,
                                            color: "#1e293b",
                                        }}
                                    >
                                        {editingRoute ? "Edit Route" : "Create New Route"}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "11px",
                                            color: "#64748b",
                                            marginTop: "2px",
                                        }}
                                    >
                                        Set route path and commuter stops
                                    </div>
                                </div>
                            </div>

                            {/* Progress Steps */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "8px",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px 16px",
                                        background: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "20px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "24px",
                                            height: "24px",
                                            borderRadius: "50%",
                                            background: "#0f172a",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            color: "white",
                                        }}
                                    >
                                        1
                                    </div>
                                    <span
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 600,
                                            color: "#334155",
                                        }}
                                    >
                                        Info
                                    </span>
                                </div>
                                <div
                                    style={{
                                        width: "20px",
                                        height: "2px",
                                        background: "#cbd5e1",
                                    }}
                                />
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px 16px",
                                        background:
                                            selectedRouteIndex !== null
                                                ? "#ecfeff"
                                                : "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "20px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "24px",
                                            height: "24px",
                                            borderRadius: "50%",
                                            background:
                                                selectedRouteIndex !== null
                                                    ? "#0f172a"
                                                    : "#cbd5e1",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            color:
                                                selectedRouteIndex !== null ? "white" : "#334155",
                                        }}
                                    >
                                        {selectedRouteIndex !== null ? "OK" : "2"}
                                    </div>
                                    <span
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 600,
                                            color: "#334155",
                                        }}
                                    >
                                        Select
                                    </span>
                                </div>
                            </div>

                            <Space size={8}>
                                <AntButton
                                    onClick={() => setShowHelp((prev) => !prev)}
                                    style={{
                                        height: "36px",
                                        borderRadius: "10px",
                                        border: "1px solid #e2e8f0",
                                        background: showHelp ? "#0f172a" : "#ffffff",
                                        color: showHelp ? "white" : "#334155",
                                        fontWeight: 600,
                                    }}
                                >
                                    {showHelp ? "Hide Help" : "Help"}
                                </AntButton>
                                <AntButton
                                    type="text"
                                    onClick={handleClose}
                                    style={{
                                        color: "#334155",
                                        width: "36px",
                                        height: "36px",
                                        borderRadius: "10px",
                                        border: "1px solid #e2e8f0",
                                        background: "#ffffff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "14px",
                                    }}
                                >
                                    X
                                </AntButton>
                            </Space>
                        </div>
                    </div>

                    {/* How-to Banner */}
                    {showHelp && (
                    <div
                        style={{
                            background: "#f8fafc",
                            borderRadius: "12px",
                            padding: "14px 18px",
                            margin: "16px 24px 0",
                            border: "1px solid #e2e8f0",
                            flexShrink: 0,
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                marginBottom: "12px",
                            }}
                        >
                            <div
                                style={{
                                    width: "24px",
                                    height: "24px",
                                    borderRadius: "8px",
                                    background: "#0f172a",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                    fontSize: "10px",
                                }}
                            >
                                i
                            </div>
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    color: "#1e293b",
                                }}
                            >
                                How to Add a Route
                            </div>
                        </div>
                        <div
                            style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}
                        >
                            {[
                                {
                                    num: 1,
                                    color: "#0f172a",
                                    title: "Enter Route Info",
                                    desc: 'Add a name and set start/end points using "Pick on Map" or type addresses',
                                },
                                {
                                    num: 2,
                                    color: "#1d4ed8",
                                    title: "Generate Routes",
                                    desc: 'Click "Generate Routes" to find available driving paths',
                                },
                                {
                                    num: 3,
                                    color: "#059669",
                                    title: "Add Stops & Save",
                                    desc: "Optionally add commuter drop-off stops, then save",
                                },
                            ].map((step) => (
                                <div
                                    key={step.num}
                                    style={{
                                        display: "flex",
                                        alignItems: "flex-start",
                                        gap: "10px",
                                        flex: "1 1 180px",
                                        minWidth: "180px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "24px",
                                            height: "24px",
                                            borderRadius: "50%",
                                            background: step.color,
                                            color: "white",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            fontSize: "11px",
                                            fontWeight: 700,
                                            flexShrink: 0,
                                        }}
                                    >
                                        {step.num}
                                    </div>
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                color: "#1e293b",
                                                marginBottom: "2px",
                                            }}
                                        >
                                            {step.title}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: "10px",
                                                color: "#64748b",
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            {step.desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Scrollable Body */}
                    <div
                        style={{
                            padding: "16px 24px 24px",
                            overflowY: "auto",
                            flex: 1,
                        }}
                    >
                        <Form form={form} layout="vertical" onFinish={handleSubmit}>
                            {/* Step 1: Route Details */}
                            <div
                                style={{
                                    background: "#ffffff",
                                    borderRadius: "14px",
                                    padding: "18px",
                                    marginBottom: "24px",
                                    border: "1px solid #e2e8f0",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "10px",
                                        marginBottom: "16px",
                                    }}
                                >
                                    <div
                                        style={{
                                            width: "28px",
                                            height: "28px",
                                            borderRadius: "8px",
                                            background: "#0f172a",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                        }}
                                    >
                                        <CompassOutlined
                                            style={{ fontSize: "14px", color: "white" }}
                                        />
                                    </div>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            fontSize: "13px",
                                            color: "#1e293b",
                                        }}
                                    >
                                        Route Information
                                    </div>
                                </div>

                                <Form.Item
                                    name="name"
                                    rules={[
                                        {
                                            required: true,
                                            message: "Please enter route name!",
                                        },
                                    ]}
                                    style={{ marginBottom: "16px" }}
                                >
                                    <Input
                                        className="route-form-input"
                                        placeholder="Enter route name (e.g., Downtown to Airport)"
                                        prefix={
                                            <CompassOutlined style={{ color: "#64748b" }} />
                                        }
                                        style={{
                                            height: "48px",
                                            borderRadius: "12px",
                                            fontSize: "13px",
                                            border: "1px solid #d1d5db",
                                        }}
                                    />
                                </Form.Item>

                                <div style={{ display: "flex", gap: "16px" }}>
                                    {/* Start Point */}
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                marginBottom: "4px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: "10px",
                                                        height: "10px",
                                                        borderRadius: "50%",
                                                        background: "#10b981",
                                                        boxShadow:
                                                            "0 0 0 3px rgba(16, 185, 129, 0.2)",
                                                    }}
                                                />
                                                <Text
                                                    style={{
                                                        fontSize: "10px",
                                                        color: "#10b981",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    Start Point
                                                </Text>
                                            </div>
                                            <div
                                                onClick={() => {
                                                    setLocationPickerType("start");
                                                    setLocationPickerOpen(true);
                                                }}
                                                style={{
                                                    padding: "4px 10px",
                                                    borderRadius: "6px",
                                                    background: "#f1f5f9",
                                                    color: "#334155",
                                                    fontSize: "10px",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                Pick on Map
                                            </div>
                                        </div>
                                        <Form.Item
                                            name="start_address"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: "Please enter start address!",
                                                },
                                            ]}
                                            style={{ marginBottom: 0 }}
                                        >
                                            <TextArea
                                                className="route-form-textarea"
                                                rows={2}
                                                placeholder="Start address or click 'Pick on Map'..."
                                                style={{
                                                    borderRadius: "12px",
                                                    border: "1px solid #d1d5db",
                                                    resize: "none",
                                                }}
                                            />
                                        </Form.Item>
                                        {startPosition && (
                                            <Text
                                                style={{
                                                    fontSize: "9px",
                                                    color: "#10b981",
                                                    marginTop: "4px",
                                                    display: "block",
                                                }}
                                            >
                                                {startPosition.lat.toFixed(5)},{" "}
                                                {startPosition.lng.toFixed(5)}
                                            </Text>
                                        )}
                                    </div>

                                    {/* End Point */}
                                    <div style={{ flex: 1 }}>
                                        <div
                                            style={{
                                                marginBottom: "4px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: "10px",
                                                        height: "10px",
                                                        borderRadius: "50%",
                                                        background: "#ef4444",
                                                        boxShadow:
                                                            "0 0 0 3px rgba(239, 68, 68, 0.2)",
                                                    }}
                                                />
                                                <Text
                                                    style={{
                                                        fontSize: "10px",
                                                        color: "#ef4444",
                                                        fontWeight: 600,
                                                        textTransform: "uppercase",
                                                    }}
                                                >
                                                    End Point
                                                </Text>
                                            </div>
                                            <div
                                                onClick={() => {
                                                    setLocationPickerType("end");
                                                    setLocationPickerOpen(true);
                                                }}
                                                style={{
                                                    padding: "4px 10px",
                                                    borderRadius: "6px",
                                                    background: "#f1f5f9",
                                                    color: "#334155",
                                                    fontSize: "10px",
                                                    fontWeight: 600,
                                                    cursor: "pointer",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "4px",
                                                }}
                                            >
                                                Pick on Map
                                            </div>
                                        </div>
                                        <Form.Item
                                            name="end_address"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: "Please enter end address!",
                                                },
                                            ]}
                                            style={{ marginBottom: 0 }}
                                        >
                                            <TextArea
                                                className="route-form-textarea"
                                                rows={2}
                                                placeholder="End address or click 'Pick on Map'..."
                                                style={{
                                                    borderRadius: "12px",
                                                    border: "1px solid #d1d5db",
                                                    resize: "none",
                                                }}
                                            />
                                        </Form.Item>
                                        {endPosition && (
                                            <Text
                                                style={{
                                                    fontSize: "9px",
                                                    color: "#ef4444",
                                                    marginTop: "4px",
                                                    display: "block",
                                                }}
                                            >
                                                {endPosition.lat.toFixed(5)},{" "}
                                                {endPosition.lng.toFixed(5)}
                                            </Text>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Step 2: Map & Route Selection */}
                            <div
                                style={{
                                    background: "#ffffff",
                                    borderRadius: "14px",
                                    padding: "20px",
                                    marginBottom: "20px",
                                    border: "1px solid #e2e8f0",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        marginBottom: "16px",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: "28px",
                                                height: "28px",
                                                borderRadius: "8px",
                                                background: "#0f172a",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                            }}
                                        >
                                            <EnvironmentOutlined
                                                style={{ fontSize: "14px", color: "white" }}
                                            />
                                        </div>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                fontSize: "14px",
                                                color: "#1e293b",
                                            }}
                                        >
                                            Map & Route Selection
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        {canManageStops && (
                                            <AntButton
                                                onClick={() => setAddingStops(!addingStops)}
                                                style={{
                                                    height: "40px",
                                                    borderRadius: "10px",
                                                    fontWeight: 600,
                                                    padding: "0 16px",
                                                    background: addingStops
                                                        ? "#92400e"
                                                        : "#ffffff",
                                                    border: addingStops
                                                        ? "1px solid #92400e"
                                                        : "1px solid #d1d5db",
                                                    color: addingStops ? "white" : "#334155",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                }}
                                            >
                                                {addingStops
                                                    ? "Done Adding Stops"
                                                    : "Add Stops"}
                                            </AntButton>
                                        )}
                                        <AntButton
                                            onClick={previewRoute}
                                            loading={previewLoading}
                                            style={{
                                                height: "40px",
                                                borderRadius: "10px",
                                                fontWeight: 600,
                                                padding: "0 20px",
                                                background:
                                                    routePolylines.length > 0
                                                        ? "#166534"
                                                        : "#0f172a",
                                                border: "1px solid transparent",
                                                color: "white",
                                                boxShadow: "none",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }}
                                        >
                                            {routePolylines.length > 0
                                                ? "Regenerate"
                                                : "Generate Routes"}
                                        </AntButton>
                                    </div>
                                </div>

                                {/* Adding Stops Hint */}
                                {addingStops && (
                                    <div
                                        style={{
                                            marginBottom: "12px",
                                            padding: "10px 16px",
                                            borderRadius: "10px",
                                            background: "#fff7ed",
                                            border: "1px solid #fdba74",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                color: "#b45309",
                                            }}
                                        >
                                            Click on the map to add commuter drop-off stops
                                            along the route
                                        </Text>
                                    </div>
                                )}

                                {/* Map Container */}
                                <div
                                    style={{
                                        height: "350px",
                                        borderRadius: "16px",
                                        overflow: "hidden",
                                        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
                                        border: addingStops
                                            ? "1px solid #f59e0b"
                                            : "1px solid #e2e8f0",
                                        transition: "border-color 0.3s ease",
                                    }}
                                >
                                    {!mapboxToken ? (
                                        <div
                                            style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                justifyContent: "center",
                                                alignItems: "center",
                                                height: "100%",
                                                padding: "32px",
                                                textAlign: "center",
                                                background: "#fff7ed",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "72px",
                                                    height: "72px",
                                                    borderRadius: "20px",
                                                    background: "#fee2e2",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    marginBottom: "20px",
                                                }}
                                            >
                                                <EnvironmentOutlined
                                                    style={{ fontSize: "36px", color: "#ef4444" }}
                                                />
                                            </div>
                                            <Text
                                                strong
                                                style={{
                                                    fontSize: "16px",
                                                    color: "#1e293b",
                                                    marginBottom: "8px",
                                                }}
                                            >
                                                Mapbox Failed to Load
                                            </Text>
                                            <Text
                                                style={{
                                                    color: "#64748b",
                                                    marginBottom: "16px",
                                                }}
                                            >
                                                Please check your Mapbox access token
                                                configuration.
                                            </Text>
                                            <div
                                                style={{
                                                    padding: "12px 20px",
                                                    borderRadius: "12px",
                                                    background: "#fffbeb",
                                                    border: "1px solid rgba(245, 158, 11, 0.3)",
                                                }}
                                            >
                                                <Text
                                                    style={{ fontSize: "12px", color: "#b45309" }}
                                                >
                                                    <strong>Tip:</strong> Set
                                                    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env.local
                                                    file.
                                                </Text>
                                            </div>
                                        </div>
                                    ) : (
                                        <Map
                                            ref={mapRef}
                                            mapboxAccessToken={mapboxToken}
                                            initialViewState={{
                                                longitude: mapCenter.lng,
                                                latitude: mapCenter.lat,
                                                zoom: 14,
                                            }}
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                cursor: addingStops ? "crosshair" : "grab",
                                            }}
                                            mapStyle="mapbox://styles/mapbox/streets-v12"
                                            onClick={handleMapClick}
                                        >
                                            <NavigationControl position="top-right" />

                                            {/* Start Marker */}
                                            {startPosition && (
                                                <Marker
                                                    longitude={startPosition.lng}
                                                    latitude={startPosition.lat}
                                                    anchor="bottom"
                                                >
                                                    <div
                                                        style={{
                                                            width: "32px",
                                                            height: "32px",
                                                            borderRadius: "50%",
                                                            background: "#10b981",
                                                            border: "3px solid white",
                                                            boxShadow:
                                                                "0 2px 8px rgba(0,0,0,0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            color: "white",
                                                            fontWeight: "bold",
                                                            fontSize: "14px",
                                                        }}
                                                    >
                                                        A
                                                    </div>
                                                </Marker>
                                            )}

                                            {/* End Marker */}
                                            {endPosition && (
                                                <Marker
                                                    longitude={endPosition.lng}
                                                    latitude={endPosition.lat}
                                                    anchor="bottom"
                                                >
                                                    <div
                                                        style={{
                                                            width: "32px",
                                                            height: "32px",
                                                            borderRadius: "50%",
                                                            background: "#ef4444",
                                                            border: "3px solid white",
                                                            boxShadow:
                                                                "0 2px 8px rgba(0,0,0,0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            color: "white",
                                                            fontWeight: "bold",
                                                            fontSize: "14px",
                                                        }}
                                                    >
                                                        B
                                                    </div>
                                                </Marker>
                                            )}

                                            {/* Stop Markers */}
                                            {stops.map((stop, index) => (
                                                <Marker
                                                    key={`stop-${index}`}
                                                    longitude={stop.longitude}
                                                    latitude={stop.latitude}
                                                    anchor="bottom"
                                                >
                                                    <div
                                                        style={{
                                                            width: "28px",
                                                            height: "28px",
                                                            borderRadius: "50%",
                                                            background: "#f59e0b",
                                                            border: "3px solid white",
                                                            boxShadow:
                                                                "0 2px 8px rgba(0,0,0,0.3)",
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            color: "white",
                                                            fontWeight: "bold",
                                                            fontSize: "11px",
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </div>
                                                </Marker>
                                            ))}

                                            {/* Route Polylines */}
                                            {routePolylines.map((route, index) => (
                                                <Source
                                                    key={`route-source-${routeVersion}-${index}`}
                                                    id={`route-${index}`}
                                                    type="geojson"
                                                    data={{
                                                        type: "Feature",
                                                        properties: {},
                                                        geometry: {
                                                            type: "LineString",
                                                            coordinates: route.path.map((p) => [
                                                                p.lng,
                                                                p.lat,
                                                            ]),
                                                        },
                                                    }}
                                                >
                                                    <Layer
                                                        id={`route-layer-${index}`}
                                                        type="line"
                                                        paint={{
                                                            "line-color":
                                                                selectedRouteIndex === index
                                                                    ? "#6366f1"
                                                                    : "#94a3b8",
                                                            "line-width":
                                                                selectedRouteIndex === index ? 6 : 3,
                                                            "line-opacity":
                                                                selectedRouteIndex === index
                                                                    ? 1
                                                                    : 0.5,
                                                        }}
                                                    />
                                                </Source>
                                            ))}
                                        </Map>
                                    )}
                                </div>

                                {/* Route Selection Cards */}
                                {routePolylines.length > 0 && (
                                    <div style={{ marginTop: "16px" }}>
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                marginBottom: "10px",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: "12px",
                                                    color: "#64748b",
                                                    fontWeight: 600,
                                                    textTransform: "uppercase",
                                                }}
                                            >
                                                Select a Route ({routePolylines.length} found)
                                            </Text>
                                            {selectedRouteIndex !== null && (
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: "6px",
                                                        padding: "4px 10px",
                                                        background: "#ecfeff",
                                                        border: "1px solid #a5f3fc",
                                                        borderRadius: "12px",
                                                    }}
                                                >
                                                    <span style={{ fontSize: "12px" }}>OK</span>
                                                    <Text
                                                        style={{
                                                            fontSize: "11px",
                                                            color: "#0e7490",
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        Route {selectedRouteIndex + 1} Selected
                                                    </Text>
                                                </div>
                                            )}
                                        </div>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "12px",
                                                overflowX: "auto",
                                                paddingBottom: "8px",
                                            }}
                                        >
                                            {routePolylines.map((route, index) => (
                                                <div
                                                    key={index}
                                                    onClick={() => setSelectedRouteIndex(index)}
                                                    style={{
                                                        minWidth: "160px",
                                                        padding: "14px 16px",
                                                        borderRadius: "12px",
                                                        border:
                                                            selectedRouteIndex === index
                                                                ? "1px solid #1d4ed8"
                                                                : "1px solid #e2e8f0",
                                                        background:
                                                            selectedRouteIndex === index
                                                                ? "#eff6ff"
                                                                : "white",
                                                        cursor: "pointer",
                                                        transition: "all 0.2s ease",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            gap: "8px",
                                                            marginBottom: "8px",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: "24px",
                                                                height: "24px",
                                                                borderRadius: "6px",
                                                                background:
                                                                    selectedRouteIndex === index
                                                                        ? "#1d4ed8"
                                                                        : "#e2e8f0",
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                fontSize: "12px",
                                                                fontWeight: 700,
                                                                color:
                                                                    selectedRouteIndex === index
                                                                        ? "white"
                                                                        : "#64748b",
                                                            }}
                                                        >
                                                            {selectedRouteIndex === index
                                                                ? "OK"
                                                                : index + 1}
                                                        </div>
                                                        <Text
                                                            style={{
                                                                fontSize: "13px",
                                                                fontWeight: 600,
                                                                color: "#1e293b",
                                                            }}
                                                        >
                                                            Route {index + 1}
                                                        </Text>
                                                    </div>
                                                    <div
                                                        style={{
                                                            fontSize: "11px",
                                                            color: "#64748b",
                                                            marginBottom: "8px",
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        Via {route.summary}
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            gap: "12px",
                                                        }}
                                                    >
                                                        <div>
                                                            <div
                                                                style={{
                                                                    fontSize: "14px",
                                                                    fontWeight: 700,
                                                                    color: "#1d4ed8",
                                                                }}
                                                            >
                                                                {route.duration}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: "9px",
                                                                    color: "#94a3b8",
                                                                    textTransform: "uppercase",
                                                                }}
                                                            >
                                                                Time
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div
                                                                style={{
                                                                    fontSize: "14px",
                                                                    fontWeight: 700,
                                                                    color: "#10b981",
                                                                }}
                                                            >
                                                                {route.distance}
                                                            </div>
                                                            <div
                                                                style={{
                                                                    fontSize: "9px",
                                                                    color: "#94a3b8",
                                                                    textTransform: "uppercase",
                                                                }}
                                                            >
                                                                Dist
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Empty State */}
                                {routePolylines.length === 0 && (
                                    <div
                                        style={{
                                            marginTop: "16px",
                                            padding: "16px",
                                            borderRadius: "10px",
                                            background: "#f8fafc",
                                            border: "1px solid #e2e8f0",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "10px",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: "12px",
                                                fontWeight: 600,
                                                color: "#475569",
                                            }}
                                        >
                                            Enter addresses above and click &quot;Generate
                                            Routes&quot;
                                        </Text>
                                    </div>
                                )}

                                {/* No Mapbox Token Fallback */}
                                {!mapboxToken && (
                                    <div
                                        style={{
                                            marginTop: "16px",
                                            padding: "12px",
                                            background: "#fef2f2",
                                            borderRadius: "10px",
                                            border: "1px solid #fecaca",
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontSize: "11px",
                                                color: "#dc2626",
                                                fontWeight: 500,
                                            }}
                                        >
                                            Map unavailable - Enter coordinates manually in
                                            form fields above
                                        </Text>
                                    </div>
                                )}
                            </div>

                            {/* Step 3: Stops Management */}
                            {canManageStops && stops.length > 0 && (
                                <div
                                    style={{
                                        background: "#ffffff",
                                        borderRadius: "14px",
                                        padding: "20px",
                                        marginBottom: "20px",
                                        border: "1px solid #e2e8f0",
                                    }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            marginBottom: "16px",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "10px",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    width: "28px",
                                                    height: "28px",
                                                    borderRadius: "8px",
                                                    background: "#0f172a",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                <EnvironmentOutlined
                                                    style={{ fontSize: "14px", color: "white" }}
                                                />
                                            </div>
                                            <div>
                                                <div
                                                    style={{
                                                        fontWeight: 600,
                                                        fontSize: "14px",
                                                        color: "#1e293b",
                                                    }}
                                                >
                                                    Commuter Drop-off Stops
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: "11px",
                                                        color: "#64748b",
                                                    }}
                                                >
                                                    {stops.length} stop
                                                    {stops.length !== 1 ? "s" : ""} configured
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "8px",
                                        }}
                                    >
                                        {stops.map((stop, index) => (
                                            <div
                                                key={index}
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "12px",
                                                    padding: "12px 16px",
                                                    background: "white",
                                                    borderRadius: "12px",
                                                    border: "1px solid #e2e8f0",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: "28px",
                                                        height: "28px",
                                                        borderRadius: "50%",
                                                        background: "#f59e0b",
                                                        color: "white",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        fontSize: "12px",
                                                        fontWeight: 700,
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {index + 1}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <Input
                                                        className="route-form-stop-input"
                                                        value={stop.name}
                                                        onChange={(e) =>
                                                            updateStopName(index, e.target.value)
                                                        }
                                                        style={{
                                                            fontWeight: 600,
                                                            fontSize: "13px",
                                                            border: "none",
                                                            padding: "0",
                                                            boxShadow: "none",
                                                        }}
                                                    />
                                                    <div
                                                        style={{
                                                            fontSize: "11px",
                                                            color: "#94a3b8",
                                                            whiteSpace: "nowrap",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {stop.address}
                                                    </div>
                                                </div>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "4px",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    <AntButton
                                                        type="text"
                                                        size="small"
                                                        icon={<ArrowUpOutlined />}
                                                        disabled={index === 0}
                                                        onClick={() => moveStop(index, "up")}
                                                        style={{
                                                            color: "#64748b",
                                                            width: "28px",
                                                            height: "28px",
                                                        }}
                                                    />
                                                    <AntButton
                                                        type="text"
                                                        size="small"
                                                        icon={<ArrowDownOutlined />}
                                                        disabled={
                                                            index === stops.length - 1
                                                        }
                                                        onClick={() => moveStop(index, "down")}
                                                        style={{
                                                            color: "#64748b",
                                                            width: "28px",
                                                            height: "28px",
                                                        }}
                                                    />
                                                    <AntButton
                                                        type="text"
                                                        size="small"
                                                        danger
                                                        icon={<DeleteOutlined />}
                                                        onClick={() => removeStop(index)}
                                                        style={{
                                                            width: "28px",
                                                            height: "28px",
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "20px 24px",
                                    background: "#f8fafc",
                                    borderRadius: "16px",
                                    border: "1px solid #e2e8f0",
                                }}
                            >
                                <div>
                                    {!canManageStops && (
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: "13px",
                                                    color: "#b45309",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                Please preview and select a route before saving
                                            </Text>
                                        </div>
                                    )}
                                    {canManageStops && (
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "8px",
                                            }}
                                        >
                                            <Text
                                                style={{
                                                    fontSize: "13px",
                                                    color: "#059669",
                                                    fontWeight: 500,
                                                }}
                                            >
                                                {selectedRouteIndex !== null
                                                    ? "Route selected"
                                                    : "Using existing route path"}
                                                {stops.length > 0
                                                    ? ` with ${stops.length} stop${stops.length !== 1 ? "s" : ""
                                                    }`
                                                    : ""}{" "}
                                                — ready to save
                                            </Text>
                                        </div>
                                    )}
                                </div>
                                <Space size="middle">
                                    <AntButton
                                        onClick={handleClose}
                                        style={{
                                            height: "44px",
                                            borderRadius: "12px",
                                            fontWeight: 600,
                                            padding: "0 24px",
                                            background: "white",
                                            border: "2px solid #e2e8f0",
                                            color: "#64748b",
                                        }}
                                    >
                                        Cancel
                                    </AntButton>
                                    <AntButton
                                        type="primary"
                                        htmlType="submit"
                                        disabled={submitting || !canManageStops}
                                        loading={submitting}
                                        style={{
                                            height: "48px",
                                            borderRadius: "12px",
                                            fontWeight: 700,
                                            padding: "0 32px",
                                            fontSize: "15px",
                                            background:
                                                canManageStops
                                                    ? "#0f172a"
                                                    : "#e2e8f0",
                                            border: "none",
                                            color:
                                                canManageStops
                                                    ? "white"
                                                    : "#94a3b8",
                                            boxShadow: "none",
                                        }}
                                    >
                                        {editingRoute
                                            ? "Update Route"
                                            : "Create Route"}
                                    </AntButton>
                                </Space>
                            </div>
                        </Form>
                    </div>
                </div>
            </div>

            {/* Location Picker Sub-modal */}
            <LocationPickerModal
                open={locationPickerOpen}
                type={locationPickerType}
                mapCenter={mapCenter}
                initialPosition={
                    locationPickerType === "start" ? startPosition : endPosition
                }
                onConfirm={handleLocationConfirm}
                onCancel={() => setLocationPickerOpen(false)}
            />

            <style jsx global>{`
                .route-modal-compact {
                    font-size: 13px;
                }

                .route-form-input.ant-input-affix-wrapper,
                .route-form-input.ant-input-affix-wrapper:hover,
                .route-form-input.ant-input-affix-wrapper:focus,
                .route-form-input.ant-input-affix-wrapper-focused {
                    box-shadow: none !important;
                }

                .route-form-input .ant-input,
                .route-form-input .ant-input:focus,
                .route-form-stop-input.ant-input,
                .route-form-stop-input.ant-input:focus {
                    border: none !important;
                    box-shadow: none !important;
                    outline: none !important;
                    background: transparent !important;
                }

                .route-form-textarea.ant-input,
                .route-form-textarea.ant-input:focus {
                    box-shadow: none !important;
                    outline: none !important;
                }
            `}</style>
        </>
    );
}
