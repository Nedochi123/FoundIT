// The thank-you reward amounts, in naira, as shown in the "How rewards work" guide. The server owns
// the real list (REWARD_AMOUNTS in backend/src/utils/rewards.js) and the chat reads it from there;
// keep this in step with it if the amounts ever change.
export const REWARD_AMOUNTS = [3000, 5000, 7000, 10000, 15000, 20000];

export const formatNaira = (n) => `₦${Number(n).toLocaleString()}`;
