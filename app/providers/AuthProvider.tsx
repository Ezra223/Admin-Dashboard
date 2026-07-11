"use client";

import { User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";


interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  refreshSession: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    let isInitialized = false;

    const initializeAuth = async () => {
      if (isInitialized) return; // Prevent multiple initializations

      try {
        // Get initial session without clearing existing session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error || !session?.user) {
          console.log("No valid session found, user needs to sign in");
          if (mounted) {
            setUser(null);
            setIsAdmin(false);
            setLoading(false);
            setInitialized(true);
            isInitialized = true;
          }
          return;
        }

        if (session?.user && mounted) {
          setUser(session.user);
          await checkAdminStatus(session.user.id);
          setLoading(false);
          setInitialized(true);
          isInitialized = true;
        }
      } catch (error: any) {
        // Ignore abort errors
        if (error.name === "AbortError" || error.message?.includes("aborted")) {
          // Keep loading state if aborted, as a valid request follows?
          // Actually, if aborted, usually we just exit.
          return;
        }

        console.error("Error initializing auth:", error);
        if (mounted) {
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          setInitialized(true);
          isInitialized = true;
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);

      if (mounted) {
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      }
    });

    // Note: Removed handleBeforeUnload to persist session across tab closes
    // Session will persist until explicit signOut() is called

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const checkAdminStatus = async (userId: string): Promise<boolean> => {
    try {
      // First try to get from custom users table
      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", userId)
        .single();

      if (error) {
        // If the users table is unavailable, deny admin access (fail secure)
        console.error("Unable to verify admin status — access denied:", error.message);
        setIsAdmin(false);
        return false;
      }

      const admin = data?.role === "admin";
      setIsAdmin(admin);
      return admin;
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        return false;
      }
      console.error("Error checking admin status — access denied:", error);
      // Fail secure: deny admin on any unexpected error
      setIsAdmin(false);
      return false;
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error("Error refreshing session:", error);
        throw error;
      }
      return data;
    } catch (error) {
      console.error("Error refreshing session:", error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        throw error;
      }

      // Check admin status after successful sign in
      if (data.user) {
        const admin = await checkAdminStatus(data.user.id);
        if (!admin) {
          await supabase.auth.signOut({ scope: "global" });
          throw new Error("Access denied. Admin privileges required.");
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError" || error.message?.includes("aborted")) {
        // Ignore
        return;
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);

      // Sign out from Supabase — this clears the session cookie automatically
      // when using @supabase/ssr's createBrowserClient
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) {
        console.error("Sign out error:", error);
      }

      // Clear local state
      setUser(null);
      setIsAdmin(false);
      setInitialized(false);

      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading: loading || !initialized,
    signIn,
    signOut,
    isAdmin,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
