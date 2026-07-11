import { DashboardMetrics, supabase } from "./supabase";

// Re-export types for use in components
export type { DashboardMetrics };

// ─── Income helpers ──────────────────────────────────────────────────────────

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const lastMonthStart = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const lastMonthEnd = () => monthStart(); // last month ends when this month starts

// Dashboard Metrics Queries
export const getDashboardMetrics = async (): Promise<DashboardMetrics> => {
  const [
    { count: activeBuses },
    { count: ongoingTrips },
    { count: totalRoutes },
    { count: totalUsers },
    { count: todayTrips },
    { count: completedTrips },
    { count: cancelledTrips },
  ] = await Promise.all([
    supabase
      .from("buses")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .eq("status", "ongoing"),
    supabase.from("routes").select("*", { count: "exact", head: true }),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .gte("started_at", new Date().toISOString().split("T")[0]),
    supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("trips")
      .select("*", { count: "exact", head: true })
      .eq("status", "cancelled"),
  ]);

  // Get total passengers from trip_passengers
  const { data: passengersData } = await supabase
    .from("trip_passengers")
    .select("*", { count: "exact", head: true })
    .eq("status", "boarded");

  // Daily income: sum of fare_total on trips updated today
  const { data: dailyFareRows } = await supabase
    .from("trips")
    .select("fare_total")
    .not("fare_total", "is", null)
    .gte("fare_updated_at", todayStart());

  // Monthly income: sum of fare_total on trips updated this month
  const { data: monthlyFareRows } = await supabase
    .from("trips")
    .select("fare_total")
    .not("fare_total", "is", null)
    .gte("fare_updated_at", monthStart());

  // Last month's income
  const { data: lastMonthFareRows } = await supabase
    .from("trips")
    .select("fare_total")
    .not("fare_total", "is", null)
    .gte("fare_updated_at", lastMonthStart())
    .lt("fare_updated_at", lastMonthEnd());

  const dailyIncome = (dailyFareRows || []).reduce(
    (sum: number, t: any) => sum + (Number(t.fare_total) || 0),
    0
  );
  const monthlyIncome = (monthlyFareRows || []).reduce(
    (sum: number, t: any) => sum + (Number(t.fare_total) || 0),
    0
  );
  const lastMonthIncome = (lastMonthFareRows || []).reduce(
    (sum: number, t: any) => sum + (Number(t.fare_total) || 0),
    0
  );

  return {
    activeBuses: activeBuses || 0,
    ongoingTrips: ongoingTrips || 0,
    totalRoutes: totalRoutes || 0,
    totalPassengers: passengersData?.length || 0,
    todayTrips: todayTrips || 0,
    totalUsers: totalUsers || 0,
    completedTrips: completedTrips || 0,
    cancelledTrips: cancelledTrips || 0,
    dailyIncome,
    monthlyIncome,
    lastMonthIncome,
  };
};


// ─── Fare / Income Queries ────────────────────────────────────────────────────

/** Last N days of daily income — returns [{date, income}] sorted oldest→newest */
export const getDailyIncomeBreakdown = async (days = 30) => {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("trips")
    .select("fare_total, fare_updated_at, fare_currency")
    .not("fare_total", "is", null)
    .gt("fare_total", 0)
    .gte("fare_updated_at", since)
    .order("fare_updated_at", { ascending: true });

  if (error || !data) return { data: [], error };

  // Group by date
  const byDate: Record<string, number> = {};
  for (const row of data) {
    const date = new Date(row.fare_updated_at).toISOString().split("T")[0];
    byDate[date] = (byDate[date] || 0) + Number(row.fare_total);
  }

  const result = Object.entries(byDate).map(([date, income]) => ({
    date,
    income: Math.round(income * 100) / 100,
  }));

  return { data: result, error: null };
};

/** Last N months of monthly income totals */
export const getMonthlyIncomeBreakdown = async (months = 6) => {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setDate(1);
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("trips")
    .select("fare_total, fare_updated_at")
    .not("fare_total", "is", null)
    .gt("fare_total", 0)
    .gte("fare_updated_at", since.toISOString())
    .order("fare_updated_at", { ascending: true });

  if (error || !data) return { data: [], error };

  const byMonth: Record<string, number> = {};
  for (const row of data) {
    const d = new Date(row.fare_updated_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + Number(row.fare_total);
  }

  const result = Object.entries(byMonth).map(([month, income]) => ({
    month,
    income: Math.round(income * 100) / 100,
  }));

  return { data: result, error: null };
};

/** Top-earning trips with passenger fare breakdown */
export const getTopFareTrips = async (limit = 10) => {
  const { data, error } = await supabase
    .from("trips")
    .select(`
      id,
      fare_total,
      fare_currency,
      fare_updated_at,
      started_at,
      ended_at,
      status,
      buses (
        plate_number,
        body_number,
        routes ( name )
      )
    `)
    .not("fare_total", "is", null)
    .gt("fare_total", 0)
    .order("fare_total", { ascending: false })
    .limit(limit);

  return { data, error };
};

// Fleet Management Queries
export const getFleetStatus = async () => {
  const { data, error } = await supabase
    .from("buses")
    .select(
      `
      id,
      plate_number,
      body_number,
      capacity,
      passengers,
      status,
      route_id,
      driver_id,
      routes (
        id,
        name,
        start_address,
        end_address
      ),
      driver:users!fk_driver (
        id,
        fullName,
        contact_number
      ),
      trips!inner (
        id,
        status,
        current_location
      )
    `
    )
    .eq("trips.status", "ongoing")
    .order("plate_number");

  return { data, error };
};

export const getAllBuses = async () => {
  const { data, error } = await supabase
    .from("buses")
    .select(
      `
      id,
      plate_number,
      body_number,
      capacity,
      passengers,
      status,
      route_id,
      driver_id,
      conductor_id,
      routes (
        id,
        name,
        start_address,
        end_address
      ),
      driver:users!fk_driver (
        id,
        fullName,
        contact_number,
        license_number,
        license_expiry
      ),
      conductor:users!buses_conductor_id_fkey (
        id,
        fullName,
        contact_number
      )
    `
    )
    .order("plate_number");

  return { data, error };
};

export const getDrivers = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("id, fullName, contact_number, license_number, license_expiry")
    .in("role", ["driver", "Driver"])
    .order("fullName");

  return { data, error };
};

export const getConductors = async () => {
  const { data, error } = await supabase
    .from("users")
    .select("id, fullName, contact_number")
    .in("role", ["conductor", "Conductor"])
    .order("fullName");

  return { data, error };
};

// Trip Management Queries
export const getActiveTrips = async () => {
  const { data, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      status,
      current_location,
      started_at,
      buses (
        id,
        plate_number,
        body_number,
        capacity,
        routes (
          id,
          name,
          start_address,
          end_address
        )
      ),
      driver:users!trips_driver_id_fkey (
        id,
        fullName,
        contact_number
      ),
      trip_passengers (
        id,
        status,
        boarded_at,
        commuter:users (
          id,
          fullName
        )
      )
    `
    )
    .in("status", ["waiting", "ongoing"])
    .order("started_at", { ascending: false });

  return { data, error };
};

export const getTripHistory = async (limit = 50) => {
  const { data, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      status,
      started_at,
      ended_at,
      cancelled_at,
      cancellation_reason,
      buses (
        id,
        plate_number,
        body_number,
        routes (
          id,
          name
        )
      ),
      driver:users!trips_driver_id_fkey (
        id,
        fullName
      ),
      trip_passengers (
        id,
        status
      )
    `
    )
    .in("status", ["completed", "cancelled"])
    .order("started_at", { ascending: false })
    .limit(limit);

  return { data, error };
};

// User Management
export const getAllUsers = async () => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, fullName, role, contact_number, emergency_contact, license_number, license_expiry, push_token, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("getAllUsers error:", error.message);
      return { data: [], error: null };
    }

    return { data, error };
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    return { data: [], error: null };
  }
};

export const getUsersByRole = async (role: string) => {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("id, fullName, role, contact_number, emergency_contact, license_number, license_expiry, push_token, updated_at")
      .eq("role", role)
      .order("fullName");

    if (error) {
      console.error("getUsersByRole error for role:", role, error.message);
      return { data: [], error: null };
    }

    return { data, error };
  } catch (error) {
    console.error("Error in getUsersByRole:", error);
    return { data: [], error: null };
  }
};

// Route Management Queries
export const getAllRoutes = async () => {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .order("created_at", { ascending: false });

  return { data, error };
};

// Fetch the route path as GeoJSON (geography columns may return as WKB hex via REST)
export const getRoutePathGeoJSON = async (routeId: string) => {
  try {
    // Try using an RPC function first (most reliable for PostGIS)
    const { data, error } = await supabase.rpc("get_route_path_geojson", {
      p_route_id: routeId,
    });

    if (!error && data) {
      return { data, error: null };
    }

    // Fallback: try querying directly and parsing whatever format we get
    const { data: routeData, error: routeError } = await supabase
      .from("routes")
      .select("path")
      .eq("id", routeId)
      .single();

    if (routeError || !routeData?.path) {
      return { data: null, error: routeError };
    }

    return { data: routeData.path, error: null };
  } catch (err) {
    console.error("getRoutePathGeoJSON error:", err);
    return { data: null, error: { message: String(err) } as any };
  }
};

export const createRoute = async (routeData: {
  name: string;
  start_address: string;
  end_address: string;
  path?: any;
}) => {
  try {
    // For PostGIS geography columns, we need to use ST_GeogFromGeoJSON
    // But supabase-js doesn't support this directly, so we'll use RPC
    const { data, error } = await supabase.rpc("insert_route", {
      p_name: routeData.name,
      p_start_address: routeData.start_address,
      p_end_address: routeData.end_address,
      p_path_geojson: routeData.path,
    });

    if (error) {
      console.error("createRoute error:", error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error("createRoute exception:", err);
    return { data: null, error: { message: String(err) } as any };
  }
};

export const updateRoute = async (
  routeId: string,
  routeData: {
    name?: string;
    start_address?: string;
    end_address?: string;
    path?: any;
  }
) => {
  try {
    // Use RPC function for PostGIS geography handling
    const { data, error } = await supabase.rpc("update_route", {
      p_route_id: routeId,
      p_name: routeData.name || null,
      p_start_address: routeData.start_address || null,
      p_end_address: routeData.end_address || null,
      p_path_geojson: routeData.path || null,
    });

    if (error) {
      console.error("updateRoute error:", error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error("updateRoute exception:", err);
    return { data: null, error: { message: String(err) } as any };
  }
};

export const deleteRoute = async (routeId: string) => {
  try {
    const { data, error } = await supabase
      .from("routes")
      .delete()
      .eq("id", routeId)
      .select();

    if (error) {
      console.error("deleteRoute error:", error);
      return { data: null, error };
    }

    // When RLS policies block deletion, Supabase returns empty data without an error
    if (!data || data.length === 0) {
      return {
        data: null,
        error: {
          message: "Delete failed: No rows were affected. Please check database permissions (RLS) or ensure the route exists.",
          code: "NO_ROWS_AFFECTED"
        } as any
      };
    }

    return { data, error: null };
  } catch (err) {
    console.error("deleteRoute exception:", err);
    return { data: null, error: { message: String(err) } as any };
  }
};

// Route Stops Management
export const getRouteStops = async (routeId: string) => {
  try {
    const { data, error } = await supabase
      .from("route_stops")
      .select("*")
      .eq("route_id", routeId)
      .order("stop_order", { ascending: true });

    if (error) {
      console.error("getRouteStops error:", error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error("Error in getRouteStops:", error);
    return { data: [], error: null };
  }
};

export const getStopsCountByRoute = async () => {
  try {
    const { data, error } = await supabase
      .from("route_stops")
      .select("route_id");

    if (error) {
      // Table might not exist yet — return empty counts gracefully
      console.log("route_stops query failed (table may not exist):", error.message);
      return { data: {}, error: null };
    }

    // Count stops per route_id
    const counts: Record<string, number> = {};
    (data || []).forEach((row: any) => {
      counts[row.route_id] = (counts[row.route_id] || 0) + 1;
    });

    return { data: counts, error: null };
  } catch (error) {
    console.error("Error in getStopsCountByRoute:", error);
    return { data: {}, error: null };
  }
};

export const saveRouteStops = async (
  routeId: string,
  stops: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    stop_order: number;
    is_common_stop?: boolean;
  }[]
) => {
  try {
    // Delete existing stops for this route first
    await supabase.from("route_stops").delete().eq("route_id", routeId);

    if (stops.length === 0) {
      return { data: [], error: null };
    }

    // Insert new stops
    const stopsToInsert = stops.map((stop) => ({
      route_id: routeId,
      name: stop.name,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      stop_order: stop.stop_order,
      is_common_stop: stop.is_common_stop || false,
    }));

    const { data, error } = await supabase
      .from("route_stops")
      .insert(stopsToInsert)
      .select();

    if (error) {
      console.error("saveRouteStops error:", error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error) {
    console.error("Error in saveRouteStops:", error);
    return { data: null, error: { message: String(error) } as any };
  }
};

export const deleteRouteStops = async (routeId: string) => {
  try {
    const { error } = await supabase
      .from("route_stops")
      .delete()
      .eq("route_id", routeId);

    if (error) {
      console.error("deleteRouteStops error:", error);
      return { error };
    }

    return { error: null };
  } catch (error) {
    console.error("Error in deleteRouteStops:", error);
    return { error: { message: String(error) } as any };
  }
};

// Analytics Queries
export const getTripAnalytics = async (days = 30) => {
  const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("trips")
    .select(
      `
      id,
      status,
      started_at,
      ended_at,
      cancelled_at,
      updated_at,
      buses (
        routes (
          name
        )
      )
    `
    )
    .or(`started_at.gte.${dateThreshold},updated_at.gte.${dateThreshold}`)
    .order("updated_at", { ascending: false });

  if (error) console.error("getTripAnalytics error:", error);
  return { data, error };
};

export const getRouteUtilization = async () => {
  const { data, error } = await supabase.from("routes").select(`
      id,
      name,
      start_address,
      end_address,
      buses (
        id,
        plate_number,
        status,
        trips (
          id,
          status,
          started_at
        )
      )
    `);

  return { data, error };
};

export const getTravelHistory = async (limit = 100) => {
  // Try to get from travel_history_commuter table with proper join
  const { data: commuterData, error: commuterError } = await supabase
    .from("travel_history_commuter")
    .select(
      `
      id,
      start_location_name,
      end_location_name,
      travel_date,
      route_name,
      status,
      user:users (
        id,
        fullName
      )
    `
    )
    .order("travel_date", { ascending: false })
    .limit(limit);

  // If successful, return the data
  if (commuterData && !commuterError) {
    return { data: commuterData, error: null };
  }

  // If travel_history_commuter table doesn't exist, fall back to trips table
  if (commuterError && commuterError.code === "PGRST200") {
    const { data: tripsData, error: tripsError } = await supabase
      .from("trips")
      .select(
        `
        id,
        status,
        started_at,
        ended_at,
        buses (
          routes (
            name,
            start_address,
            end_address
          )
        ),
        driver:users!trips_driver_id_fkey (
          id,
          fullName
        )
      `
      )
      .in("status", ["completed", "cancelled"])
      .order("started_at", { ascending: false })
      .limit(limit);

    if (tripsError) {
      return { data: null, error: tripsError };
    }

    // Transform trips data to match expected format
    const transformedData =
      tripsData?.map((trip) => ({
        id: trip.id,
        start_location_name:
          (trip.buses as any)?.routes?.start_address || "Unknown",
        end_location_name:
          (trip.buses as any)?.routes?.end_address || "Unknown",
        travel_date:
          trip.started_at?.split("T")[0] ||
          new Date().toISOString().split("T")[0],
        route_name: (trip.buses as any)?.routes?.name || "Unknown Route",
        status: trip.status,
        created_at: trip.started_at,
        user: trip.driver,
      })) || [];

    return { data: transformedData, error: null };
  }

  return { data: commuterData, error: commuterError };
};

// Update Operations
export const updateBusStatus = async (
  busId: string,
  status: "active" | "inactive"
) => {
  const { data, error } = await supabase
    .from("buses")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", busId)
    .select();

  return { data, error };
};

export const assignDriverToBus = async (busId: string, driverId: string) => {
  const { data, error } = await supabase
    .from("buses")
    .update({ driver_id: driverId, updated_at: new Date().toISOString() })
    .eq("id", busId)
    .select();

  return { data, error };
};

export const updateBusAssignment = async (
  busId: string,
  updates: { driverId?: string | null; conductorId?: string | null }
) => {
  const { driverId, conductorId } = updates;

  const updatePayload: any = {
    updated_at: new Date().toISOString(),
    driver_id: driverId || null,
    conductor_id: conductorId || null,
  };

  const { data, error } = await supabase
    .from("buses")
    .update(updatePayload)
    .eq("id", busId)
    .select();

  if (error) {
    console.error("updateBusAssignment error:", error);
    return { data: null, error };
  }

  if (!data || data.length === 0) {
    return {
      data: null,
      error: {
        message: "Update failed: No rows were affected. Please check database permissions (RLS).",
        code: "NO_ROWS_AFFECTED"
      }
    };
  }

  return { data, error };
};

export const updateTripStatus = async (
  tripId: string,
  status: string,
  currentLocation?: any
) => {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (currentLocation) {
    updateData.current_location = currentLocation;
  }

  if (status === "completed") {
    updateData.ended_at = new Date().toISOString();
  } else if (status === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("trips")
    .update(updateData)
    .eq("id", tripId)
    .select();

  return { data, error };
};

// Role Request Management
export interface RoleRequest {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  requested_role: "driver" | "conductor";
  resume_path: string | null;
  license_number: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
}

export const getRoleRequests = async () => {
  try {
    const { data, error } = await supabase
      .from("role_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getRoleRequests error:", error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error("Error in getRoleRequests:", error);
    return { data: [], error: null };
  }
};

export const getRoleRequestsByStatus = async (
  status: "pending" | "approved" | "rejected"
) => {
  try {
    const { data, error } = await supabase
      .from("role_requests")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getRoleRequestsByStatus error:", error);
      return { data: [], error };
    }

    return { data: data || [], error: null };
  } catch (error) {
    console.error("Error in getRoleRequestsByStatus:", error);
    return { data: [], error: null };
  }
};

export const approveRoleRequest = async (
  requestId: string,
  reviewerId: string,
  notes?: string
) => {
  try {
    const { data, error } = await supabase
      .from("role_requests")
      .update({
        status: "approved",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select();

    if (error) {
      console.error("approveRoleRequest error:", error);
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return {
        data: null,
        error: {
          message: "Update failed: No rows were affected. Please check database permissions.",
          code: "NO_ROWS_AFFECTED",
        } as any,
      };
    }

    return { data: data[0], error: null };
  } catch (error) {
    console.error("Error in approveRoleRequest:", error);
    return { data: null, error: { message: String(error) } as any };
  }
};

export const rejectRoleRequest = async (
  requestId: string,
  reviewerId: string,
  reason: string
) => {
  try {
    const { data, error } = await supabase
      .from("role_requests")
      .update({
        status: "rejected",
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId)
      .select();

    if (error) {
      console.error("rejectRoleRequest error:", error);
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return {
        data: null,
        error: {
          message: "Update failed: No rows were affected. Please check database permissions.",
          code: "NO_ROWS_AFFECTED",
        } as any,
      };
    }

    return { data: data[0], error: null };
  } catch (error) {
    console.error("Error in rejectRoleRequest:", error);
    return { data: null, error: { message: String(error) } as any };
  }
};
