import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Real-time subscription types
export interface RealtimeCallbacks {
  onTripUpdate?: (payload: any) => void;
  onBusUpdate?: (payload: any) => void;
  onUserUpdate?: (payload: any) => void;
}

// Real-time subscription manager
export class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();

  // Subscribe to trips table changes
  subscribeToTrips(callbacks: RealtimeCallbacks) {
    const channel = supabase
      .channel("trips-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
        },
        (payload) => {
          console.log("Trip change received:", payload);
          callbacks.onTripUpdate?.(payload);
        }
      )
      .subscribe();

    this.channels.set("trips", channel);
    return channel;
  }

  // Subscribe to buses table changes
  subscribeToBuses(callbacks: RealtimeCallbacks) {
    const channel = supabase
      .channel("buses-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "buses",
        },
        (payload) => {
          console.log("Bus change received:", payload);
          callbacks.onBusUpdate?.(payload);
        }
      )
      .subscribe();

    this.channels.set("buses", channel);
    return channel;
  }

  // Subscribe to users table changes
  subscribeToUsers(callbacks: RealtimeCallbacks) {
    const channel = supabase
      .channel("users-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
        },
        (payload) => {
          console.log("User change received:", payload);
          callbacks.onUserUpdate?.(payload);
        }
      )
      .subscribe();

    this.channels.set("users", channel);
    return channel;
  }

  // Subscribe to trip_passengers table changes
  subscribeToTripPassengers(callbacks: RealtimeCallbacks) {
    const channel = supabase
      .channel("trip-passengers-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_passengers",
        },
        (payload) => {
          console.log("Trip passenger change received:", payload);
          callbacks.onTripUpdate?.(payload); // Use trip update callback
        }
      )
      .subscribe();

    this.channels.set("trip_passengers", channel);
    return channel;
  }

  // Subscribe to all relevant tables
  subscribeToAll(callbacks: RealtimeCallbacks) {
    this.subscribeToTrips(callbacks);
    this.subscribeToBuses(callbacks);
    this.subscribeToUsers(callbacks);
    this.subscribeToTripPassengers(callbacks);
  }

  // Unsubscribe from a specific channel
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }

  // Get channel status
  getChannelStatus(channelName: string) {
    const channel = this.channels.get(channelName);
    return channel ? channel.state : "not_subscribed";
  }

  // Get all active channels
  getActiveChannels() {
    return Array.from(this.channels.keys());
  }
}

// Create a singleton instance
export const realtimeManager = new RealtimeManager();

// Utility functions for real-time data handling
export const handleTripUpdate = (
  payload: any,
  setTrips: (trips: any) => void,
  currentTrips: any[]
) => {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  switch (eventType) {
    case "INSERT":
      setTrips([newRecord, ...currentTrips]);
      break;
    case "UPDATE":
      setTrips(
        currentTrips.map((trip) =>
          trip.id === newRecord.id ? { ...trip, ...newRecord } : trip
        )
      );
      break;
    case "DELETE":
      setTrips(currentTrips.filter((trip) => trip.id !== oldRecord.id));
      break;
  }
};

export const handleBusUpdate = (
  payload: any,
  setBuses: (buses: any) => void,
  currentBuses: any[]
) => {
  const { eventType, new: newRecord, old: oldRecord } = payload;

  switch (eventType) {
    case "INSERT":
      setBuses([newRecord, ...currentBuses]);
      break;
    case "UPDATE":
      setBuses(
        currentBuses.map((bus) =>
          bus.id === newRecord.id ? { ...bus, ...newRecord } : bus
        )
      );
      break;
    case "DELETE":
      setBuses(currentBuses.filter((bus) => bus.id !== oldRecord.id));
      break;
  }
};

// Real-time metrics updater
export const createMetricsUpdater = (setMetrics: (metrics: any) => void) => {
  return (payload: any) => {
    // This would need to be implemented based on specific metric calculations
    // For now, we'll just trigger a refresh
    console.log("Metrics update triggered by:", payload);
    // You could implement specific metric updates here
  };
};
