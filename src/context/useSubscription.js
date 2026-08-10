import { createContext, useContext } from "react";

export const SubscriptionContext = createContext(null);

export const useSubscription = () => {
  const value = useContext(SubscriptionContext);
  if (!value) throw new Error("useSubscription must be used inside a SubscriptionProvider");
  return value;
};
