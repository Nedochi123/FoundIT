import { api } from "./api";

// Web Push subscriptions require the VAPID public key as a Uint8Array,
// but the server hands it over as a base64url string — this is the
// standard conversion recipe.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// iOS Safari only supports Web Push once the PWA has been added to the
// Home Screen (16.4+) — this isn't something to work around, just a
// real platform constraint callers should surface to the user.
export function isIosNotStandalone() {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  return isIos && !isStandalone;
}

export async function enablePushNotifications() {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await api.getVapidPublicKey();
  if (!publicKey) return { ok: false, reason: "not_configured" };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.subscribePush(subscription.toJSON());
  return { ok: true };
}
