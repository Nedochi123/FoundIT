// FoundIT owner view: a private page, separate from the app. It signs in with the owner's FoundIT account and reads
// what routes/monitor.routes.js allows (read only). Nothing here writes anything.
//
// Safety rules for this file: text from students is only ever put on the page as plain text (never parsed as HTML),
// the page makes no requests except to this same server, and it keeps its sign-in only for this browser tab.
// test/owner-page.test.js fails if code that parses HTML or evaluates strings is ever added here.
"use strict";

const root = document.getElementById("root");
const TOKEN_KEY = "owner_tokens";

// ---------------------------------------------------------------- small helpers
/** Builds an element. attrs: className, text, plus any other attribute or on* handler. Children are nodes or strings. */
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === "className") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}
const clear = (node) => node.replaceChildren();
/** Adds children to a node, skipping empty ones (a bare append() would print "null" for them). */
const add = (node, ...kids) => node.append(...kids.filter((k) => k != null && k !== false));

// SQLite times look like "2026-10-09 14:30:00" (UTC)
const toDate = (iso) => new Date(String(iso).replace(" ", "T") + "Z");
const when = (iso) => toDate(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
function ago(iso) {
  const mins = Math.floor((Date.now() - toDate(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
}
function debounce(fn, ms = 350) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------- talking to the server
function loadTokens() {
  try {
    return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
  } catch {
    return null;
  }
}
function saveTokens(tokens) {
  try {
    if (tokens) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: you just sign in again after a reload
  }
}
let session = loadTokens(); // { accessToken, refreshToken, email } while signed in

// credentials: "omit" keeps this page apart from the app: it never sends or stores the app's cookies.
async function send(path, { method = "GET", body, token } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "omit",
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

async function refreshSession() {
  if (!session?.refreshToken) return false;
  const r = await send("/api/auth/refresh", { method: "POST", body: { refreshToken: session.refreshToken } });
  if (!r.ok || !r.data?.accessToken) return false;
  session = { ...session, accessToken: r.data.accessToken, refreshToken: r.data.refreshToken };
  saveTokens(session);
  return true;
}

class SignedOut extends Error {}

async function api(path) {
  if (!session) throw new SignedOut();
  let r = await send(path, { token: session.accessToken });
  if (r.status === 401 && (await refreshSession())) r = await send(path, { token: session.accessToken });
  if (r.status === 401) throw new SignedOut();
  if (r.status === 404) throw new Error(path.includes("/chats/") ? "That chat could not be found." : "This account is not the owner account.");
  if (!r.ok) throw new Error(r.data?.error || `The server answered ${r.status}.`);
  return r.data;
}

/** A write (the owner's reply to a student): same sign-in handling as api(). */
async function sendJson(path, body) {
  if (!session) throw new SignedOut();
  let r = await send(path, { method: "POST", body, token: session.accessToken });
  if (r.status === 401 && (await refreshSession())) r = await send(path, { method: "POST", body, token: session.accessToken });
  if (r.status === 401) throw new SignedOut();
  if (!r.ok) throw new Error(r.data?.error || `The server answered ${r.status}.`);
  return r.data;
}

async function signOut(message) {
  const refreshToken = session?.refreshToken;
  session = null;
  saveTokens(null);
  if (refreshToken) await send("/api/auth/logout", { method: "POST", body: { refreshToken } }).catch(() => {});
  showLogin(message);
}

// ---------------------------------------------------------------- sign in
function showLogin(message) {
  clear(root);
  const email = el("input", { id: "email", type: "email", autocomplete: "username", required: true });
  const password = el("input", { id: "password", type: "password", autocomplete: "current-password", required: true });
  const error = el("p", { className: "error", role: "alert", text: message || "" });
  const button = el("button", { className: "primary", type: "submit", text: "Sign in" });

  const form = el(
    "form",
    {
      className: "card login",
      onsubmit: async (e) => {
        e.preventDefault();
        error.textContent = "";
        button.disabled = true;
        button.textContent = "Signing in...";
        try {
          const r = await send("/api/auth/login", { method: "POST", body: { email: email.value, password: password.value } });
          if (!r.ok) {
            error.textContent = r.data?.error || "Couldn't sign in.";
            return;
          }
          if (!r.data.user?.isMonitor) {
            // a real account, but not the owner's: sign it straight back out so it isn't left signed in
            await send("/api/auth/logout", { method: "POST", body: { refreshToken: r.data.refreshToken } }).catch(() => {});
            error.textContent = `${r.data.user?.email || "That account"} is not the owner account. Sign in with the owner's email.`;
            return;
          }
          session = { accessToken: r.data.accessToken, refreshToken: r.data.refreshToken, email: r.data.user.email };
          saveTokens(session);
          password.value = "";
          showMain();
        } catch {
          error.textContent = "Couldn't reach the server. Check your connection and try again.";
        } finally {
          button.disabled = false;
          button.textContent = "Sign in";
        }
      },
    },
    el("h1", { text: "FoundIT owner view" }),
    el("p", { className: "muted", text: "Private. Sign in with the owner account." }),
    el("label", { for: "email", text: "Email" }),
    email,
    el("label", { for: "password", text: "Password" }),
    password,
    error,
    button,
    el("p", { className: "muted", text: "Forgot the password? Open the FoundIT app, tap Forgot password and use the same email." })
  );
  root.append(form);
  email.focus();
}

// ---------------------------------------------------------------- the main page
function showMain() {
  clear(root);
  const content = el("div", { id: "content" });
  const tabBar = el("div", { className: "tabs", role: "tablist", "aria-label": "Views" });
  const views = { messages: messagesView, activity: activityView, chats: chatsView, people: peopleView };
  let current = "messages";
  let personFilter = null; // { id, name }
  let timers = []; // refresh timers of the view on screen; stopped when another view opens

  function every(ms, fn) {
    timers.push(setInterval(fn, ms));
  }
  function open(name) {
    current = name;
    for (const t of timers) clearInterval(t);
    timers = [];
    for (const b of tabBar.children) b.setAttribute("aria-selected", String(b.dataset.view === name));
    clear(content);
    views[name](content);
  }

  // the number of unread messages from students, shown on the Messages tab and in the browser tab's title
  const messagesTab = el("button", { type: "button", role: "tab", "data-view": "messages", text: "Messages", onclick: () => open("messages") });
  async function refreshUnread() {
    try {
      const { unreadTotal } = await api("/api/monitor/support");
      messagesTab.textContent = unreadTotal > 0 ? `Messages (${unreadTotal})` : "Messages";
      document.title = unreadTotal > 0 ? `(${unreadTotal}) FoundIT owner view` : "FoundIT owner view";
    } catch (err) {
      if (err instanceof SignedOut) signOut("Your session ended. Please sign in again.");
    }
  }
  function showPerson(id, name) {
    personFilter = { id, name };
    open("activity");
  }
  tabBar.append(messagesTab);
  for (const [name, label] of [["activity", "Activity"], ["chats", "Chats"], ["people", "People"]]) {
    tabBar.append(el("button", { type: "button", role: "tab", "data-view": name, text: label, onclick: () => open(name) }));
  }

  root.append(
    el(
      "div",
      { className: "top" },
      el("h1", { text: "FoundIT owner view" }),
      el(
        "div",
        { className: "who" },
        `Signed in as ${session.email} `,
        el("button", { type: "button", text: "Sign out", onclick: () => signOut() })
      )
    ),
    el("p", {
      className: "notice",
      text: "Private to your account. Messages is where students write to you and where you reply; everything else here is read only and never marks a chat as read. Every chat you open is recorded. Records are deleted after 90 days. Long numbers in chats are hidden down to their last 4 digits.",
    }),
    tabBar,
    content
  );

  // ---- shared pieces
  function errorLine(parent) {
    const line = el("p", { className: "error", role: "alert" });
    parent.append(line);
    return (err) => {
      if (err instanceof SignedOut) signOut("Your session ended. Please sign in again.");
      else line.textContent = err.message || "Something went wrong.";
    };
  }
  function place(location) {
    if (!location) return el("span", { className: "chip warn", text: "No location sent" });
    const link = el("a", {
      className: "chip good",
      href: `https://www.google.com/maps?q=${encodeURIComponent(location.lat)},${encodeURIComponent(location.lng)}`,
      target: "_blank",
      rel: "noopener noreferrer",
      text: `Map${location.accuracy ? ` (within ${location.accuracy} m)` : ""}`,
    });
    return link;
  }
  function searchBar(parent, placeholder, onChange, extra) {
    const input = el("input", { type: "search", placeholder, "aria-label": placeholder });
    input.addEventListener("input", debounce(() => onChange(input.value.trim())));
    parent.append(el("div", { className: "toolbar" }, input, extra));
    return input;
  }

  // ---- activity
  function activityView(host) {
    let query = "";
    let items = [];
    let next = null;
    const fail = errorLine(host);
    const list = el("ul", { className: "list" });
    const more = el("button", { type: "button", text: "Load more", hidden: true });
    const empty = el("p", { className: "empty", text: "Nothing recorded yet." });
    const refresh = el("button", { type: "button", text: "Refresh", onclick: () => load() });
    const filterBar = el("div", { className: "bar", hidden: true });
    searchBar(host, "Search by name or action", (q) => {
      query = q;
      load();
    }, refresh);
    host.append(filterBar, list, empty, more);
    more.addEventListener("click", () => load(next));

    function drawFilter() {
      clear(filterBar);
      filterBar.hidden = !personFilter;
      if (personFilter) {
        filterBar.append(`Showing only ${personFilter.name}`, el("button", { type: "button", text: "Show everyone", onclick: () => { personFilter = null; drawFilter(); load(); } }));
      }
    }
    function draw() {
      clear(list);
      empty.hidden = items.length > 0;
      for (const row of items) {
        list.append(
          el(
            "li",
            { className: "row" },
            el("div", { className: "head" }, el("span", { className: "title", text: row.action }), el("time", { className: "when", datetime: row.at, text: when(row.at) })),
            row.detail ? el("div", { className: "detail", text: `"${row.detail}"` }) : null,
            el(
              "div",
              { className: "meta" },
              row.userId
                ? el("button", { type: "button", className: "linkbtn", text: row.userName, onclick: () => showPerson(row.userId, row.userName) })
                : el("span", { className: "muted", text: row.userName }),
              row.userEmail ? el("span", { className: "muted", text: row.userEmail }) : null,
              place(row.location)
            )
          )
        );
      }
      more.hidden = !next;
    }
    async function load(before) {
      try {
        const p = new URLSearchParams({ limit: "50" });
        if (personFilter) p.set("user", personFilter.id);
        if (query) p.set("q", query);
        if (before) p.set("before", before);
        const data = await api(`/api/monitor/activity?${p}`);
        items = before ? items.concat(data.items) : data.items;
        next = data.next;
        draw();
      } catch (err) {
        fail(err);
      }
    }
    drawFilter();
    load();
  }

  // ---- people
  function peopleView(host) {
    const fail = errorLine(host);
    const list = el("ul", { className: "list" });
    const empty = el("p", { className: "empty", text: "Nobody matches.", hidden: true });
    searchBar(host, "Search by name, email or ID number", (q) => load(q));
    host.append(list, empty);

    async function load(q) {
      try {
        const data = await api(`/api/monitor/people${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        clear(list);
        empty.hidden = data.people.length > 0;
        for (const p of data.people) {
          list.append(
            el(
              "li",
              { className: "row" },
              el("div", { className: "head" }, el("span", { className: "title", text: p.name + (p.suspended ? " (suspended)" : "") }), el("span", { className: "when", text: p.lastActive ? `active ${ago(p.lastActive)}` : "no activity yet" })),
              el("div", { className: "muted", text: `${p.email}${p.idNumber ? ` · ID ${p.idNumber}` : ""}` }),
              el(
                "div",
                { className: "meta" },
                el("span", { text: `${p.actions} actions` }),
                p.actionsWithoutLocation > 0 ? el("span", { className: "chip warn", text: `${p.actionsWithoutLocation} with no location` }) : null,
                p.lastLocation ? [place(p.lastLocation), el("span", { className: "muted", text: `last seen ${ago(p.lastLocation.at)}` })] : place(null),
                el("button", { type: "button", className: "linkbtn", text: "See what they did", onclick: () => showPerson(p.id, p.name) })
              )
            )
          );
        }
      } catch (err) {
        fail(err);
      }
    }
    load();
  }

  // ---- chats
  function chatsView(host) {
    const fail = errorLine(host);
    const list = el("ul", { className: "list" });
    const empty = el("p", { className: "empty", text: "No chats.", hidden: true });
    searchBar(host, "Search names, items or message text", (q) => load(q));
    host.append(list, empty);

    async function load(q) {
      try {
        const data = await api(`/api/monitor/chats${q ? `?q=${encodeURIComponent(q)}` : ""}`);
        clear(list);
        empty.hidden = data.chats.length > 0;
        for (const c of data.chats) {
          list.append(
            el(
              "li",
              { className: "row" },
              el("div", { className: "head" }, el("button", { type: "button", className: "linkbtn", text: c.title, onclick: () => openChat(c) }), el("span", { className: "when", text: ago(c.lastAt) })),
              el("div", { className: "muted", text: `${c.kind === "tag" ? "QR tag chat" : "Item chat"} · ${c.people}` }),
              el("div", { text: c.lastMessage || "No messages yet" }),
              el("div", { className: "muted", text: `${c.messageCount} messages` })
            )
          );
        }
      } catch (err) {
        fail(err);
      }
    }
    load();

    async function openChat(chat) {
      clear(host);
      const back = el("button", { type: "button", text: "All chats", onclick: () => open("chats") });
      const fail2 = errorLine(host);
      host.append(back);
      try {
        const data = await api(`/api/monitor/chats/${chat.kind}/${encodeURIComponent(chat.id)}`);
        const head = el("div", { className: "card spaced" });
        if (data.kind === "item") {
          add(
            head,
            el("h2", { text: data.item.description || "Found item" }),
            data.item.location ? el("div", { className: "muted", text: `Found at: ${data.item.location}` }) : null,
            el("div", { text: `Finder: ${data.finder.name} (${data.finder.email})` }),
            el("div", { text: `Looking for it: ${data.seeker.name} (${data.seeker.email})` }),
            data.item.returnConfirmedAt ? el("div", { className: "chip good", text: `Return confirmed ${when(data.item.returnConfirmedAt)}` }) : null,
            data.reward ? el("div", { text: `Reward: ₦${Number(data.reward.amount).toLocaleString()} (${data.reward.status})` }) : null
          );
        } else {
          add(
            head,
            el("h2", { text: `QR tag ${data.tag.code}${data.tag.label ? ` (${data.tag.label})` : ""}` }),
            el("div", { text: `Owner: ${data.owner ? `${data.owner.name} (${data.owner.email})` : "released tag"}` }),
            el("div", { className: "muted", text: "The other person scanned the tag and has no account." })
          );
        }
        const msgs = el("div", { className: "msgs" });
        if (data.messages.length === 0) msgs.append(el("p", { className: "empty", text: "No messages." }));
        for (const m of data.messages) {
          const name = data.kind === "item" ? m.senderName : m.sender === "owner" ? data.owner?.name || "Owner" : "Finder (no account)";
          const right = data.kind === "item" ? m.senderId === data.seeker.id : m.sender === "owner";
          msgs.append(
            el(
              "div",
              { className: `msg${right ? " right" : ""}` },
              el("div", { className: "name", text: name }),
              el("div", { className: "body", text: m.kind === "contact" ? `Shared contact: ${m.contactName || "(no name)"} ${m.contactPhone || ""}` : m.body }),
              el("div", { className: "at", text: when(m.at) })
            )
          );
        }
        host.append(head, msgs);
      } catch (err) {
        fail2(err);
      }
    }
  }

  // ---- messages (complaints and problems students send to the admin, answered here)
  function messagesView(host) {
    const fail = errorLine(host);
    const list = el("ul", { className: "list" });
    const empty = el("p", { className: "empty", text: "No messages yet. When a student writes to the admin it appears here.", hidden: true });
    host.append(list, empty);

    async function loadList() {
      try {
        const data = await api("/api/monitor/support");
        clear(list);
        empty.hidden = data.threads.length > 0;
        for (const t of data.threads) {
          list.append(
            el(
              "li",
              { className: "row" },
              el(
                "div",
                { className: "head" },
                el("button", { type: "button", className: "linkbtn", text: t.name, onclick: () => openThread(t.id) }),
                el("span", { className: "when", text: ago(t.lastAt) })
              ),
              el("div", { className: "muted", text: `${t.email}${t.idNumber ? ` · ID ${t.idNumber}` : ""}` }),
              el("div", { className: "snippet", text: `${t.lastFrom === "admin" ? "You: " : ""}${t.lastBody}` }),
              t.unread > 0 ? el("span", { className: "chip warn", text: t.unread === 1 ? "1 new message" : `${t.unread} new messages` }) : null
            )
          );
        }
        refreshUnread();
      } catch (err) {
        fail(err);
      }
    }
    loadList();
    every(20000, loadList);

    async function openThread(id) {
      for (const t of timers) clearInterval(t);
      timers = [];
      clear(host);
      const failThread = errorLine(host);
      const back = el("button", { type: "button", text: "All messages", onclick: () => open("messages") });
      const head = el("div", { className: "card spaced" });
      const msgs = el("div", { className: "msgs" });
      const box = el("textarea", { id: "reply", rows: "3", maxlength: "1000", placeholder: "Write your reply...", "aria-label": "Your reply" });
      const sendButton = el("button", { type: "submit", className: "primary", text: "Send reply" });
      const form = el(
        "form",
        {
          className: "composer",
          onsubmit: async (e) => {
            e.preventDefault();
            const body = box.value.trim();
            if (!body) return;
            sendButton.disabled = true;
            try {
              await sendJson(`/api/monitor/support/${encodeURIComponent(id)}/reply`, { body });
              box.value = "";
              await load();
            } catch (err) {
              failThread(err);
            } finally {
              sendButton.disabled = false;
            }
          },
        },
        box,
        sendButton
      );
      host.append(back, head, msgs, form);

      let shown = -1;
      async function load() {
        try {
          const data = await api(`/api/monitor/support/${encodeURIComponent(id)}`);
          clear(head);
          add(head, el("h2", { text: data.student.name }), el("div", { className: "muted", text: `${data.student.email}${data.student.idNumber ? ` · ID ${data.student.idNumber}` : ""}` }));
          clear(msgs);
          for (const m of data.messages) {
            const mine = m.from === "admin";
            msgs.append(
              el(
                "div",
                { className: `msg${mine ? " right" : ""}` },
                el("div", { className: "name", text: mine ? "You (admin)" : data.student.name }),
                el("div", { className: "body", text: m.body }),
                el("div", { className: "at", text: when(m.at) })
              )
            );
          }
          if (data.messages.length !== shown) {
            shown = data.messages.length;
            if (msgs.lastElementChild) msgs.lastElementChild.scrollIntoView({ block: "end" });
          }
          refreshUnread();
        } catch (err) {
          failThread(err);
        }
      }
      load();
      every(10000, load);
    }
  }

  refreshUnread();
  open("messages");
}

// ---------------------------------------------------------------- start
(async function start() {
  if (!session) return showLogin();
  try {
    await api("/api/monitor/access-log"); // proves the saved sign-in is still the owner's
    showMain();
  } catch (err) {
    showLogin(err instanceof SignedOut ? "" : err.message);
  }
})();
