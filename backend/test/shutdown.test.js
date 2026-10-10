// Stopping the server (a deploy, a settings change) must end with a clean exit code 0, never a "crash".
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { installShutdown } = require("../src/utils/shutdown");

function fakes({ serverFinishes = true } = {}) {
  const calls = [];
  const proc = new EventEmitter();
  const server = {
    close(cb) {
      calls.push("server.close");
      if (serverFinishes) cb();
    },
    closeIdleConnections() {
      calls.push("closeIdle");
    },
  };
  const exit = (code) => calls.push(`exit(${code})`);
  return { calls, proc, server, exit };
}

test("SIGTERM stops the server, closes the database, and exits with code 0", () => {
  const { calls, proc, server, exit } = fakes();
  installShutdown(server, { proc, exit, onClose: () => calls.push("db.close") });
  proc.emit("SIGTERM");
  assert.deepEqual(calls, ["closeIdle", "server.close", "db.close", "exit(0)"]);
});

test("SIGINT (Ctrl+C) does the same, and a second signal changes nothing", () => {
  const { calls, proc, server, exit } = fakes();
  installShutdown(server, { proc, exit });
  proc.emit("SIGINT");
  proc.emit("SIGTERM");
  assert.deepEqual(calls, ["closeIdle", "server.close", "exit(0)"]);
});

test("a connection that never finishes can't keep the server from exiting", async () => {
  const { calls, proc, server, exit } = fakes({ serverFinishes: false });
  installShutdown(server, { proc, exit, graceMs: 20 });
  proc.emit("SIGTERM");
  assert.deepEqual(calls, ["closeIdle", "server.close"], "still waiting");
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, ["closeIdle", "server.close", "exit(0)"], "gave up waiting and exited cleanly");
});

test("an error while closing the database still ends in a clean exit", () => {
  const { calls, proc, server, exit } = fakes();
  const realError = console.error;
  console.error = () => {};
  try {
    installShutdown(server, {
      proc,
      exit,
      onClose: () => {
        throw new Error("already closed");
      },
    });
    proc.emit("SIGTERM");
  } finally {
    console.error = realError;
  }
  assert.deepEqual(calls, ["closeIdle", "server.close", "exit(0)"]);
});
