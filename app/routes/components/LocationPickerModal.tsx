"use client";

import { EnvironmentOutlined, SearchOutlined } from "@ant-design/icons";
import { Button as AntButton, Input, Modal, Space, Typography, message } from "antd";
import { useRef, useState } from "react";
import Map, { Marker, NavigationControl, MapRef } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { LngLat } from "../types";

const { Text } = Typography;

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface LocationPickerModalProps {
    open: boolean;
    type: "start" | "end";
    mapCenter: LngLat;
    initialPosition: LngLat | null;
    onConfirm: (position: LngLat, address: string) => void;
    onCancel: () => void;
}

export default function LocationPickerModal({
    open,
    type,
    mapCenter,
    initialPosition,
    onConfirm,
    onCancel,
}: LocationPickerModalProps) {
    const [tempPosition, setTempPosition] = useState<LngLat | null>(
        initialPosition
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [resolvedAddress, setResolvedAddress] = useState("");
    const pickerMapRef = useRef<MapRef | null>(null);

    // Reset temp position when modal opens with new initial position
    const handleAfterOpenChange = (visible: boolean) => {
        if (visible) {
            setTempPosition(initialPosition);
            setSearchQuery("");
            setResolvedAddress("");
        }
    };

    const reverseGeocode = async (position: LngLat) => {
        if (!MAPBOX_TOKEN) {
            return `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
        }

        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${position.lng},${position.lat}.json?access_token=${MAPBOX_TOKEN}`
            );
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                return data.features[0].place_name as string;
            }
        } catch (error) {
            console.error("Reverse geocoding failed:", error);
        }

        return `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            message.warning("Enter an address to search.");
            return;
        }

        if (!MAPBOX_TOKEN) {
            message.error("Mapbox token is not configured.");
            return;
        }

        setSearching(true);
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery.trim())}.json?limit=1&access_token=${MAPBOX_TOKEN}`
            );
            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                message.warning("No location found for that search.");
                return;
            }

            const [lng, lat] = data.features[0].center as [number, number];
            const position = { lat, lng };
            setTempPosition(position);
            setResolvedAddress(data.features[0].place_name || "");

            if (pickerMapRef.current) {
                pickerMapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 900 });
            }
        } catch (error) {
            console.error("Search geocoding failed:", error);
            message.error("Failed to search location.");
        } finally {
            setSearching(false);
        }
    };

    const handleConfirm = async () => {
        if (!tempPosition) return;

        const address = resolvedAddress || (await reverseGeocode(tempPosition));

        onConfirm(tempPosition, address);
        setTempPosition(null);
        setResolvedAddress("");
    };

    return (
        <Modal
            open={open}
            onCancel={() => {
                onCancel();
                setTempPosition(null);
                setResolvedAddress("");
            }}
            afterOpenChange={handleAfterOpenChange}
            title={null}
            footer={null}
            width={680}
            styles={{
                content: { padding: 0, borderRadius: "14px", overflow: "hidden" },
                body: { padding: 0 },
            }}
            closable={false}
        >
            {/* Header */}
            <div
                style={{
                    background: "#ffffff",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
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
                        <EnvironmentOutlined
                            style={{ fontSize: "16px", color: "white" }}
                        />
                    </div>
                    <div>
                        <div
                            style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}
                        >
                            {type === "start" ? "Set Start Point" : "Set End Point"}
                        </div>
                        <div
                            style={{ fontSize: "10px", color: "#64748b" }}
                        >
                            Search an address or click on the map to pin location
                        </div>
                    </div>
                </div>
                <AntButton
                    type="text"
                    onClick={() => {
                        onCancel();
                        setTempPosition(null);
                    }}
                    style={{
                        color: "#334155",
                        width: "32px",
                        height: "30px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                    }}
                >
                    X
                </AntButton>
            </div>

            {/* Search Bar */}
            <div
                style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: "1px solid #e2e8f0",
                    background: "#f8fafc",
                }}
            >
                <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onPressEnter={handleSearch}
                    placeholder={`Search ${type === "start" ? "start" : "end"} address`}
                    style={{ borderRadius: "10px", height: "34px", fontSize: "12px" }}
                />
                <AntButton
                    icon={<SearchOutlined />}
                    onClick={handleSearch}
                    loading={searching}
                    style={{
                        height: "34px",
                        borderRadius: "10px",
                        fontWeight: 600,
                        fontSize: "12px",
                    }}
                >
                    Search
                </AntButton>
            </div>

            {/* Map */}
            <div style={{ height: "320px", position: "relative" }}>
                {MAPBOX_TOKEN && (
                    <Map
                        ref={pickerMapRef}
                        mapboxAccessToken={MAPBOX_TOKEN}
                        initialViewState={{
                            longitude: (initialPosition || mapCenter).lng,
                            latitude: (initialPosition || mapCenter).lat,
                            zoom: 14,
                        }}
                        style={{ width: "100%", height: "100%" }}
                        mapStyle="mapbox://styles/mapbox/streets-v12"
                        onClick={(e: MapMouseEvent) => {
                            setTempPosition({
                                lat: e.lngLat.lat,
                                lng: e.lngLat.lng,
                            });
                            setResolvedAddress("");
                        }}
                    >
                        <NavigationControl position="top-right" />
                        {tempPosition && (
                            <Marker
                                longitude={tempPosition.lng}
                                latitude={tempPosition.lat}
                                anchor="center"
                            >
                                <div
                                    style={{
                                        width: "24px",
                                        height: "24px",
                                        borderRadius: "50%",
                                        background:
                                            type === "start" ? "#10b981" : "#ef4444",
                                        border: "3px solid white",
                                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                    }}
                                />
                            </Marker>
                        )}
                    </Map>
                )}
                {tempPosition && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: "12px",
                            left: "12px",
                            right: "12px",
                            padding: "8px 10px",
                            background: "white",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
                            fontSize: "11px",
                        }}
                    >
                        <div style={{ color: "#334155", fontWeight: 600, marginBottom: "2px", fontSize: "10px" }}>
                            Pinned Coordinates
                        </div>
                        <div style={{ color: "#64748b", fontSize: "11px" }}>
                            {tempPosition.lat.toFixed(6)}, {tempPosition.lng.toFixed(6)}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div
                style={{
                    padding: "12px 14px",
                    background: "#f8fafc",
                    borderTop: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <Text style={{ fontSize: "11px", color: "#64748b" }}>
                    {tempPosition
                        ? "Location pinned. Confirm to apply this point."
                        : "Click anywhere on the map to pin a location."}
                </Text>
                <Space>
                    <AntButton
                        onClick={() => {
                            onCancel();
                            setTempPosition(null);
                        }}
                        style={{ borderRadius: "8px", height: "32px", fontSize: "12px" }}
                    >
                        Cancel
                    </AntButton>
                    <AntButton
                        type="primary"
                        disabled={!tempPosition}
                        onClick={handleConfirm}
                        style={{
                            borderRadius: "8px",
                            height: "32px",
                            background: tempPosition ? "#0f172a" : "#e2e8f0",
                            border: "1px solid transparent",
                            color: tempPosition ? "white" : "#94a3b8",
                            fontWeight: 600,
                            fontSize: "12px",
                        }}
                    >
                        Confirm Point
                    </AntButton>
                </Space>
            </div>
        </Modal>
    );
}
