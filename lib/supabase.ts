import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
    "Please ensure your .env.local file is configured correctly."
  );
}

// createBrowserClient from @supabase/ssr automatically uses cookies for session
// storage, enabling server-side session validation in middleware.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
  realtime: {
    params: {
      eventsPerSecond: 2,
    },
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: function (tries: number, delay: number) {
      return delay * Math.pow(1.5, tries);
    },
  },
});

// Database Types
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: "driver" | "conductor" | "commuter" | "admin";
  contact_number?: string;
  emergency_contact?: string;
  license_number?: string;
  license_expiry?: string;
  push_token?: string;
  created_at: string;
  updated_at: string;
}

export interface Bus {
  id: string;
  plate_number: string;
  route_id: string;
  driver_id?: string;
  status: "active" | "inactive";
  capacity: number;
  passengers: number;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  name: string;
  start_address: string;
  end_address: string;
  path: any; // PostGIS geography data
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  bus_id: string;
  driver_id: string;
  status: "waiting" | "ongoing" | "completed" | "cancelled";
  current_location?: any; // PostGIS point data
  started_at?: string;
  ended_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface TripPassenger {
  id: string;
  trip_id: string;
  commuter_id: string;
  status: "boarded" | "completed" | "cancelled";
  boarded_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface TravelHistory {
  id: string;
  user_id: string;
  start_location_name: string;
  end_location_name: string;
  travel_date: string;
  route_name: string;
  status: "completed" | "cancelled";
  created_at: string;
}

export interface DashboardMetrics {
  activeBuses: number;
  ongoingTrips: number;
  totalRoutes: number;
  totalPassengers: number;
  todayTrips: number;
  totalUsers: number;
  completedTrips: number;
  cancelledTrips: number;
  dailyIncome: number;      // PHP — sum of trips.fare_total updated today
  monthlyIncome: number;    // PHP — sum of trips.fare_total updated this calendar month
  lastMonthIncome: number;  // PHP — sum of trips.fare_total from last calendar month
}
