const { naira } = require("./rewards");

// "Urgently need" posts: a lost post whose owner promises a money reward (one of REWARD_AMOUNTS) to whoever finds
// it and returns it. The amount is shown to everyone. FoundIT never touches the money: the owner pays the finder
// directly, using the same private chat and steps as the thank-you reward (see conversations.routes.js).
//
// Posting one sends an alert to every device with notifications on, whatever their lost/found alert settings,
// and shows a warning alert inside the app to every student. So that one account can't flood the campus, a
// student can have one urgent post open at a time and a few per week.
const URGENT_ACTIVE_DAYS = 7; // how long a post keeps raising alerts (it stays on the Lost board after that)
const MAX_URGENT_OPEN_PER_USER = 1;
const MAX_URGENT_PER_WEEK = 3;

// SQL: this lost post is open and still inside its alert window
const ACTIVE_URGENT_SQL = `(lost_items.urgent_reward IS NOT NULL AND lost_items.status = 'open'
  AND lost_items.urgent_at > datetime('now', '-${URGENT_ACTIVE_DAYS} days'))`;

/** The push alert text for a new urgent post. */
function alertText(posterName, description, reward) {
  return {
    title: "⚠️ URGENT: help find this",
    body: `${posterName} urgently needs: ${String(description).slice(0, 90)} — ${naira(reward)} reward for whoever finds it.`,
  };
}

module.exports = { URGENT_ACTIVE_DAYS, MAX_URGENT_OPEN_PER_USER, MAX_URGENT_PER_WEEK, ACTIVE_URGENT_SQL, alertText };
