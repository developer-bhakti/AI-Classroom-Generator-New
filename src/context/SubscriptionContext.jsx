import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./useAuth";
import { getMySubscription, isSubscriptionActive } from "../Services/subscriptionService";
import { SubscriptionContext } from "./useSubscription";

export const SubscriptionProvider = ({ children }) => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return null;
    }
    const data = await getMySubscription(user.id);
    setSubscription(data);
    setLoading(false);
    return data;
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    refresh();
  }, [user, authLoading, refresh]);

  const value = useMemo(() => ({
    subscription,
    loading,
    // Admins always have full access — they should never be paywalled or nagged.
    isActive: isAdmin || isSubscriptionActive(subscription),
    refresh
  }), [subscription, loading, isAdmin, refresh]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};
