import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured, arrivedViaRecoveryLink } from "../Services/supabaseClient";
import { initContentStore, resetContentStore } from "../Services/contentStore";
import { AuthContext } from "./useAuth";

// A reload drops the #access_token hash, so remember (for this tab only) that the session came from a reset
// link; otherwise the person would be asked for an old password they have forgotten.
const RECOVERY_KEY = "adiuvaret-password-recovery";

const readRecoveryFlag = () => {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === "1";
  } catch {
    return false;
  }
};

const writeRecoveryFlag = (on) => {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, "1");
    else sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // private mode: the flag then lasts only until the page is reloaded
  }
};

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // True while the person is signed in only because they opened a password-reset link.
  const [passwordRecovery, setPasswordRecoveryState] = useState(() => {
    if (!arrivedViaRecoveryLink) return readRecoveryFlag();
    writeRecoveryFlag(true);
    return true;
  });
  const setPasswordRecovery = useCallback((on) => {
    writeRecoveryFlag(on);
    setPasswordRecoveryState(on);
  }, []);

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
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);

      if (!nextSession?.user) {
        setPasswordRecovery(false);
        setProfile(null);
        resetContentStore();
        setLoading(false);
        return;
      }

      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN" && event !== "PASSWORD_RECOVERY") {
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
  }, [loadProfile, setPasswordRecovery]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setPasswordRecovery(false);
    setProfile(null);
    resetContentStore();
  }, [setPasswordRecovery]);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) return null;
    return loadProfile(session.user.id);
  }, [session, loadProfile]);

  const endPasswordRecovery = useCallback(() => setPasswordRecovery(false), [setPasswordRecovery]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isAdmin: profile?.role === "admin",
    passwordRecovery,
    endPasswordRecovery,
    signOut,
    refreshProfile
  }), [session, profile, loading, passwordRecovery, endPasswordRecovery, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
