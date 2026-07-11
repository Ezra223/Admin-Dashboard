import { useCallback } from "react";
import { message } from "antd";
import type { LngLat, GeocodedLocation, RouteInfo } from "../types";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export function useMapServices() {
    // Reverse Geocoding: Convert Coordinates to Address
    const reverseGeocode = useCallback(
        async (lat: number, lng: number): Promise<string | null> => {
            try {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}`
                );
                const data = await response.json();

                if (data.features && data.features.length > 0) {
                    return data.features[0].place_name;
                } else {
                    console.error(
                        "Reverse geocoding error:",
                        data.message || "No results found"
                    );
                    return null;
                }
            } catch (error) {
                console.error("Reverse geocoding API call failed:", error);
                return null;
            }
        },
        []
    );

    // Geocoding: Convert Address to Coordinates
    const geocodeAddress = useCallback(
        async (address: string): Promise<GeocodedLocation | null> => {
            try {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                        address
                    )}.json?access_token=${MAPBOX_TOKEN}&limit=1`
                );
                const data = await response.json();

                if (data.features && data.features.length > 0) {
                    const [lng, lat] = data.features[0].center;
                    return {
                        latitude: lat,
                        longitude: lng,
                        name: data.features[0].place_name,
                    };
                } else {
                    console.error(
                        "Geocoding error:",
                        data.message || "No results found"
                    );
                    message.error(
                        `Could not find coordinates for: ${address}. Please be more specific.`
                    );
                    return null;
                }
            } catch (error) {
                console.error("Geocoding API call failed:", error);
                message.error("Failed to connect to geocoding service.");
                return null;
            }
        },
        []
    );

    // Fetch Directions between two coordinates
    const fetchDirections = useCallback(
        async (
            origin: LngLat,
            destination: LngLat
        ): Promise<RouteInfo[] | null> => {
            try {
                const response = await fetch(
                    `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`
                );
                const data = await response.json();

                if (data.code === "Ok" && data.routes && data.routes.length > 0) {
                    const allRoutes: RouteInfo[] = data.routes.map((route: any) => {
                        const path: LngLat[] = route.geometry.coordinates.map(
                            ([lng, lat]: [number, number]) => ({ lat, lng })
                        );

                        const distanceKm = (route.distance / 1000).toFixed(1);
                        const distanceText = `${distanceKm} km`;

                        const durationMinutes = Math.round(route.duration / 60);
                        const durationText =
                            durationMinutes >= 60
                                ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60
                                } min`
                                : `${durationMinutes} min`;

                        return {
                            path,
                            summary: route.legs[0]?.summary || "Route",
                            distance: distanceText,
                            duration: durationText,
                        };
                    });
                    return allRoutes;
                } else {
                    console.error("Directions API error:", data.code, data.message);
                    message.error(
                        "Could not find a route between the specified locations."
                    );
                    return null;
                }
            } catch (error) {
                console.error("Directions API call failed:", error);
                message.error("Failed to connect to directions service.");
                return null;
            }
        },
        []
    );

    return {
        mapboxToken: MAPBOX_TOKEN,
        reverseGeocode,
        geocodeAddress,
        fetchDirections,
    };
}
