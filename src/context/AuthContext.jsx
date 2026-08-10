import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "../Services/supabaseClient";
import { initContentStore, resetContentStore } from "../Services/contentStore";
import { AuthContext } from "./useAuth";

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .eq("id", userId)
      .single();

    if (error) {
      console.warn("Could not load profile:", error.message);
      setProfile(null);
      return null;
    }
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    // onAuthStateChange fires INITIAL_SESSION on startup (with a null session if
    // signed out), so it covers the initial read too — no separate getSession call.
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        resetContentStore();
        setLoading(false);
        return;
      }

      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") {
        // TOKEN_REFRESHED / USER_UPDATED: session changed, profile did not.
        return;
      }

      // `loading` must stay true until the profile (and its role) is resolved,
      // otherwise AdminRoute sees a null role on reload and bounces an admin away.
      loadProfile(nextSession.user.id).finally(() => {
        if (active) setLoading(false);
      });
      initContentStore(nextSession.user.id);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    resetContentStore();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return null;
    return loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAdmin: profile?.role === "admin",
    signOut,
    refreshProfile
  }), [session, profile, loading, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
