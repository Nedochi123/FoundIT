import { useEffect, useRef } from "react";

// Polls `fn` every `intervalMs`, pausing while the tab is hidden — a
// backgrounded conversation list has no reason to keep hitting the
// backend every few seconds. Also runs `fn` once immediately and again
// whenever `deps` change, and again the moment the tab becomes visible.
export function usePolling(fn, intervalMs, deps = []) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let intervalId = null;

    function tick() {
      if (document.visibilityState === "visible") fnRef.current();
    }

    function start() {
      tick();
      intervalId = setInterval(tick, intervalMs);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") tick();
    }

    start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);
}
