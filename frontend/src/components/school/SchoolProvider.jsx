import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_SCHOOL_ID, forgetSchoolId, getSchool, readChosenSchoolId, rememberSchoolId } from "../../lib/schools";

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
  const [id, setId] = useState(readChosenSchoolId);

  const choose = useCallback((next) => {
    rememberSchoolId(next);
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
