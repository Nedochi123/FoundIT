// The voluntary thank-you reward an owner can give a finder (in naira). Fixed amounts only, so
// nobody can be pressured into a particular figure. FoundIT never handles the money: the owner
// pays the finder directly. To change the choices, edit this list; the app reads it from here.
const REWARD_AMOUNTS = [3000, 5000, 7000, 10000, 15000, 20000];

const naira = (n) => "₦" + Number(n).toLocaleString("en-US");

module.exports = { REWARD_AMOUNTS, naira };
