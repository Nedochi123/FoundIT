import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_SCHOOL_ID, forgetSchoolId, getSchool, readChosenSchoolId, readSchoolFromUrl, rememberSchoolId } from "../../lib/schools";
import { setApiSchool } from "../../lib/api";

// A link that names its school (from an email) wins over the school saved on this device, and is remembered.
function initialSchoolId() {
  const fromLink = readSchoolFromUrl();
  if (fromLink) rememberSchoolId(fromLink);
  const id = fromLink || readChosenSchoolId();
  setApiSchool(id || DEFAULT_SCHOOL_ID); // before any screen sends its first request
  return id;
}

// Which school this device is using. "chosen" is false until a student has picked one on the Welcome page, which
// is how the app knows whether to show that page. Outside the provider (a finder's QR-tag page, which has no
// account) useSchool() still answers with the default school, so no screen has to check.
const SchoolContext = createContext({
  school: getSchool(DEFAULT_SCHOOL_ID),
  chosen: false,
  choose() {},
  forget() {},
});

export function SchoolProvider({ children }) {
  const [id, setId] = useState(initialSchoolId);

  // every request names this school (each school has its own database on the server)
  useEffect(() => {
    setApiSchool(id || DEFAULT_SCHOOL_ID);
  }, [id]);

  const choose = useCallback((next) => {
    rememberSchoolId(next);
    setApiSchool(next); // straight away: the next screen may send a request before the effect above runs
    setId(next);
  }, []);

  const forget = useCallback(() => {
    forgetSchoolId();
    setId(null);
  }, []);

  const value = useMemo(() => ({ school: getSchool(id), chosen: Boolean(id), choose, forget }), [id, choose, forget]);
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

export function useSchool() {
  return useContext(SchoolContext);
}
