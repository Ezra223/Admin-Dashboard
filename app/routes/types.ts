// Coordinate type for Mapbox (uses [lng, lat] format)
export interface LngLat {
    lng: number;
    lat: number;
}

export interface Route {
    id: string;
    name: string;
    start_address: string | null;
    end_address: string | null;
    path?: any; // geography/GeoJSON
    created_at: string;
    stops_count?: number;
}

// Types for geocoding and directions
export interface GeocodedLocation {
    latitude: number;
    longitude: number;
    name: string;
}

export interface RouteInfo {
    path: LngLat[];
    summary: string;
    distance: string;
    duration: string;
}

// Commuter drop-off stop
export interface RouteStop {
    id?: string;
    route_id?: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    stop_order: number;
    is_common_stop?: boolean;
}
