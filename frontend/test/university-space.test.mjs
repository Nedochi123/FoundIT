// Every signed-in screen shows whose private university space it is, and says honestly what "private" means. The server
// decides the university (user.school); the app follows it. The privacy wording must never promise more than the app
// does: no "completely private", no "nobody can see", and it must mention the administrators' access and that accounts
// are made with the university's email address (which is not proof of enrolment).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const space = read("src/components/school/UniversitySpace.jsx");

test("the university comes from the server's answer, not from this device", () => {
  assert.match(space, /const fromServer = user\?\.school;/);
  assert.match(space, /getSchool\(fromServer\.id\)/, "its logo and colors are looked up from the server's school id");
  const gate = read("src/components/auth/AuthGate.jsx");
  assert.match(gate, /user\.school\?\.id/, "the device follows the account's university");
  assert.match(gate, /accountSchoolId !== school\.id\)\) choose\(accountSchoolId\)/);
});

test("Home shows the university's name, logo and 'Private university workspace', with the privacy message", () => {
  const home = read("src/components/Home.jsx");
  assert.match(home, /<UniversityIdentityCard onShowPrivacy=\{\(\) => onNavigate\("legal"\)\} \/>/);
  assert.match(space, /<SchoolMark school=\{university\} size=\{44\} \/>/);
  assert.match(space, /\{university\.name\}/);
  assert.match(space, /Private university workspace/);
  assert.match(space, /Your university space is private/);
  assert.match(space, /How privacy works/, "and a way to read the details");
  // shown in full until the student says "Got it", then folded into one line that opens it again
  assert.match(space, /useState\(\(\) => !privacySeen\(\)\)/);
  assert.match(space, /Got it/);
  assert.match(space, /aria-expanded="false"/);
});

test("the privacy message is honest: other universities can't see it, but it never claims nobody can", () => {
  const card = space.slice(space.indexOf("export function UniversityIdentityCard"), space.indexOf("export function PrivateSpaceNote"));
  assert.match(card, /Students at other universities can&apos;t see\s+any of it/);
  assert.match(card, /administrators can review reports, activity and chats/, "the administrators' access is said plainly");
  assert.match(card, /Accounts here are made with/, "membership is by university email address");
  for (const promise of [/complete(ly)? private/i, /fully confidential/i, /no ?one (else )?can see/i, /nobody can see/i, /invisible/i, /100%/, /verified students/i, /only (real|enrolled) students/i]) {
    assert.doesNotMatch(card, promise);
  }
});

test("every screen shows the university in the top bar, and the private screens say who can see them", () => {
  assert.match(read("src/components/layout/Layout.jsx"), /<UniversityChip \/>/);
  assert.match(read("src/components/gallery/Gallery.jsx"), /<PrivateSpaceNote \/>/, "Items found and Lost");
  const messages = read("src/components/messages/ConversationList.jsx");
  assert.match(messages, /<PrivateSpaceNote>/);
  assert.match(messages, /administrators can review them/);
  const profile = read("src/components/profile/Profile.jsx");
  assert.match(profile, /useUniversity\(\)/);
  assert.match(profile, /private university workspace/i);
  assert.match(profile, /sign out and\s+choose it/, "switching university means signing in to that university");
});

test("Privacy & Terms explains the university space, and opens back to where it came from", () => {
  const legal = read("src/components/legal/LegalScreen.jsx");
  assert.match(legal, /Your university's private space/);
  assert.match(legal, /not proof that someone is enrolled/);
  assert.match(legal, /private from other universities and the public, not from everyone/);
  const app = read("src/App.jsx");
  assert.match(app, /onBack=\{\(\) => navigate\(legalFrom\)\}/);
});

test("photo links keep their signature: the app only puts the server's address in front", async () => {
  const api = read("src/lib/api.js");
  assert.match(api, /return url\.startsWith\("\/"\) \? `\$\{API_BASE_URL\}\$\{url\}` : url;/);
});

test("the Welcome page has a search box that finds a university by name or email ending", () => {
  const welcome = read("src/components/auth/Welcome.jsx");
  assert.match(welcome, /type="search"/);
  assert.match(welcome, /\[s\.name, s\.short, s\.emailDomain\]/);
  assert.match(welcome, /No university matches/, "an empty result says so instead of showing nothing");
});
