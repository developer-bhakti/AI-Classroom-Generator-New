// Pages a child can use without a subscription. AI Classroom stays free until a parent chooses to subscribe, so
// nothing on these pages may ask for payment: no locked route (see App.jsx) and no subscription popup
// (see SubscriptionNag). Plans are only shown when a parent opens the Subscription page, for example by
// choosing "AI Classes" after a quiz. To make another page free, add it here and drop `requireSubscription`
// from its route in App.jsx.
export const FREE_PATHS = ["/quiz"];

export const isFreePath = (pathname) => FREE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
