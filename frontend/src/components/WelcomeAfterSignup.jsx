import { useCallback, useEffect, useState } from "react";
import IntroAnimation from "./IntroAnimation";

// Set by AuthProvider's signup() the moment a new account is created (not on log-in), then used up here.
export const WELCOME_KEY = "foundit_welcome_pending";

function welcomePending() {
  try {
    return sessionStorage.getItem(WELCOME_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Plays the welcome animation once, right after a student creates their account, in the colors they just
 * picked (the page is already in their look from the sign-up form's live preview). Never on a normal log-in.
 * The flag is read without deleting it and cleared afterwards in an effect: React may render a component twice
 * in development, and a flag deleted during the first render would be gone for the second.
 */
export default function WelcomeAfterSignup() {
  const [show, setShow] = useState(welcomePending);
  const done = useCallback(() => setShow(false), []);
  useEffect(() => {
    try {
      sessionStorage.removeItem(WELCOME_KEY);
    } catch {
      // Private browsing: nothing to clear.
    }
  }, []);
  return show ? <IntroAnimation onDone={done} /> : null;
}
