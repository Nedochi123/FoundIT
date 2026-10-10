// sendEmail must tell the truth: the email library returns { error } (it does not throw) when the service refuses a
// message, and that must be reported instead of looking like a success.
const test = require("node:test");
const assert = require("node:assert/strict");

let next = { data: { id: "abc" } };
const sent = [];
const resendPath = require.resolve("resend");
require.cache[resendPath] = {
  id: resendPath,
  filename: resendPath,
  loaded: true,
  exports: {
    Resend: class {
      constructor() {
        this.emails = {
          send: async (message) => {
            sent.push(message);
            if (next instanceof Error) throw next;
            return next;
          },
        };
      }
    },
  },
};
process.env.RESEND_API_KEY = "test-key";
process.env.EMAIL_FROM = "FoundIT <foundit@example.com>";
const { sendEmail } = require("../src/utils/email");

const quiet = async (fn) => {
  const real = console.error;
  const lines = [];
  console.error = (...a) => lines.push(a.join(" "));
  try {
    return { result: await fn(), lines };
  } finally {
    console.error = real;
  }
};

test("an accepted email is reported as sent, from the configured sender", async () => {
  next = { data: { id: "abc" } };
  const { result } = await quiet(() => sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" }));
  assert.deepEqual(result, { sent: true });
  assert.equal(sent.at(-1).from, "FoundIT <foundit@example.com>");
  assert.equal(sent.at(-1).to, "a@example.com");
});

test("an email the service refuses is NOT reported as sent, and the reason is logged", async () => {
  next = { data: null, error: { name: "validation_error", message: "The mail.example.com domain is not verified." } };
  const { result, lines } = await quiet(() => sendEmail({ to: "a@example.com", subject: "Reset your password", html: "<p>x</p>" }));
  assert.deepEqual(result, { sent: false, reason: "rejected" });
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Resend rejected the email "Reset your password": validation_error: The mail\.example\.com domain is not verified/);
});

test("a network failure is reported as not sent", async () => {
  next = new Error("socket hang up");
  const { result, lines } = await quiet(() => sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" }));
  assert.deepEqual(result, { sent: false, reason: "send_failed" });
  assert.match(lines[0], /socket hang up/);
});

test("with no email key configured nothing is sent and it says so", async () => {
  const key = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const before = sent.length;
  const realLog = console.log;
  console.log = () => {};
  try {
    assert.deepEqual(await sendEmail({ to: "a@example.com", subject: "Hi", html: "<p>x</p>" }), { sent: false, reason: "not_configured" });
  } finally {
    console.log = realLog;
    process.env.RESEND_API_KEY = key;
  }
  assert.equal(sent.length, before);
});
