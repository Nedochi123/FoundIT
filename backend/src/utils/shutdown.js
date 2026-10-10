// A clean exit when the host stops the server.
//
// Every deploy (and every settings change) on Railway ends with the platform sending the running server a SIGTERM
// ("please stop"). A Node process that ignores it is killed, and because the server is started through `npm start`,
// npm then reports "command failed, signal SIGTERM": Railway reads that as a crash and emails "crashed" even though
// nothing was wrong. Handling the signal means the server stops taking new requests, lets the ones in flight finish,
// closes the database, and exits with code 0, which is a normal shutdown.

/**
 * @param server  the HTTP server returned by app.listen()
 * @param options proc/exit are injectable for tests; onClose runs once the server has stopped (e.g. close the database);
 *                graceMs is how long to wait for slow connections before exiting anyway.
 * @returns the handler (so tests can call it directly)
 */
function installShutdown(server, { proc = process, exit = (code) => process.exit(code), onClose, graceMs = 8000 } = {}) {
  let closing = false;

  const handler = (signal) => {
    if (closing) return;
    closing = true;
    console.log(`${signal} received: finishing current requests and shutting down`);

    // never hang: if a connection won't finish, leave after the grace period
    const timer = setTimeout(() => exit(0), graceMs);
    if (timer.unref) timer.unref();

    if (server.closeIdleConnections) server.closeIdleConnections(); // keep-alive sockets would otherwise hold it open
    server.close(() => {
      try {
        if (onClose) onClose();
      } catch (err) {
        console.error("Error while closing:", err);
      }
      clearTimeout(timer);
      exit(0);
    });
  };

  for (const signal of ["SIGTERM", "SIGINT"]) proc.on(signal, () => handler(signal));
  return handler;
}

module.exports = { installShutdown };
