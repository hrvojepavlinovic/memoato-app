// @vitest-environment node
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const require = createRequire(import.meta.url);

it("keeps auth-email message composition compatible with Nodemailer 10", async () => {
  const nodemailer = require("nodemailer");
  // JSON transport never connects to SMTP or delivers an email.
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const result = await transport.sendMail({
    from: { name: "Memoato", address: "hello@example.test" },
    to: "reader@example.test",
    subject: "Confirm your email",
    text: "Confirm: https://example.test/verify?token=demo",
    html: '<a href="https://example.test/verify?token=demo">Confirm email</a>',
  });
  const message = JSON.parse(result.message.toString());
  expect(message.from).toEqual({ name: "Memoato", address: "hello@example.test" });
  expect(message.to[0].address).toBe("reader@example.test");
  expect(message.subject).toBe("Confirm your email");
  expect(message.text).toContain("token=demo");
  expect(message.html).toContain("Confirm email");
});
