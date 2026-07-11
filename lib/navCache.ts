/**
 * Navigation Data Cache
 *
 * A simple module-level cache that pre-warms data for destination pages
 * when the user hovers over a Quick Action card on the dashboard.
 *
 * Pages read from this cache on mount and skip their own fetch if the
 * cache is fresh (< 30 seconds old), making navigation feel near-instant.
 */

import {
    getActiveTrips,
    getAllBuses,
    getAllRoutes,
    getAllUsers,
    getDashboardMetrics,
    getDailyIncomeBreakdown,
    getMonthlyIncomeBreakdown,
    getRoleRequests,
    getRouteUtilization,
    getStopsCountByRoute,
    getTopFareTrips,
    getTripAnalytics,
    getTripHistory,
    getUsersByRole,
} from "./queries";

type CacheEntry<T> = {
    data: T;
    fetchedAt: number; // ms timestamp
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache: Record<string, CacheEntry<any>> = {};

const CACHE_TTL_MS = 30_000; // 30 seconds

function isStale(key: string): boolean {
    const entry = cache[key];
    if (!entry) return true;
    return Date.now() - entry.fetchedAt > CACHE_TTL_MS;
}

function set<T>(key: string, data: T): void {
    cache[key] = { data, fetchedAt: Date.now() };
}

export function setCached<T>(key: string, data: T): void {
    set(key, data);
}

export function get<T>(key: string): T | null {
    if (isStale(key)) return null;
    return cache[key].data as T;
}

// ─── Pre-warmer functions (called on hover) ───────────────────────────────────

export async function prewarmFleet(): Promise<void> {
    if (!isStale("fleet:buses")) return;
    try {
        const [buses, drivers, conductors] = await Promise.all([
            getAllBuses(),
            getUsersByRole("driver"),
            getUsersByRole("conductor"),
        ]);
        if (!buses.error) set("fleet:buses", buses.data);
        if (!drivers.error) set("fleet:drivers", drivers.data);
        if (!conductors.error) set("fleet:conductors", conductors.data);
    } catch { /* silent — page will fetch on its own */ }
}

export async function prewarmUsers(): Promise<void> {
    if (!isStale("users:all")) return;
    try {
        const { data, error } = await getAllUsers();
        if (!error) set("users:all", data);
    } catch { /* silent */ }
}

export async function prewarmRoleRequests(): Promise<void> {
    if (!isStale("roleRequests:all")) return;
    try {
        const { data, error } = await getRoleRequests();
        if (!error) set("roleRequests:all", data);
    } catch { /* silent */ }
}

export async function prewarmDashboard(): Promise<void> {
    if (!isStale("dashboard:metrics")) return;
    try {
        const data = await getDashboardMetrics();
        set("dashboard:metrics", data);
    } catch { /* silent */ }
}

export async function prewarmRoutes(): Promise<void> {
    if (!isStale("routes:all") && !isStale("routes:stopsCount")) return;
    try {
        const [routes, stopsCount] = await Promise.all([
            getAllRoutes(),
            getStopsCountByRoute(),
        ]);
        if (!routes.error) set("routes:all", routes.data);
        if (!stopsCount.error) set("routes:stopsCount", stopsCount.data);
    } catch { /* silent */ }
}

export async function prewarmTrips(): Promise<void> {
    if (!isStale("trips:active") && !isStale("trips:history")) return;
    try {
        const [active, history] = await Promise.all([
            getActiveTrips(),
            getTripHistory(),
        ]);
        if (!active.error) set("trips:active", active.data);
        if (!history.error) set("trips:history", history.data);
    } catch { /* silent */ }
}

export async function prewarmAnalytics(): Promise<void> {
    if (!isStale("analytics:bundle")) return;
    try {
        const [tripResult, routeResult, dailyResult, monthlyResult, topFareResult] =
            await Promise.all([
                getTripAnalytics(30),
                getRouteUtilization(),
                getDailyIncomeBreakdown(30),
                getMonthlyIncomeBreakdown(6),
                getTopFareTrips(10),
            ]);

        if (!tripResult.error && !routeResult.error) {
            set("analytics:bundle", {
                tripAnalytics: tripResult.data || [],
                routeUtilization: routeResult.data || [],
                dailyIncome: dailyResult.data || [],
                monthlyIncome: monthlyResult.data || [],
                topFareTrips: topFareResult.data || [],
            });
        }
    } catch { /* silent */ }
}

// Path → prewarm function mapping (used by quick action cards)
export const prewarmers: Record<string, () => Promise<void>> = {
    "/fleet": prewarmFleet,
    "/users": prewarmUsers,
    "/role-requests": prewarmRoleRequests,
    "/routes": prewarmRoutes,
    "/trips": prewarmTrips,
    "/analytics": prewarmAnalytics,
    "/": prewarmDashboard,
};
