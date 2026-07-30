/**
 * Resend wrapper. If RESEND_API_KEY is set we send via the SDK; if it's
 * unset (dev default) we print a visually distinct console block so an
 * admin running an approve/deny locally can see what would have gone out.
 *
 * sendEmail is best-effort — never throws. Callers (approve/deny actions)
 * commit the durable state change first, then send the email.
 */

import "server-only";

import { Resend } from "resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult =
  | { ok: true; mode: "resend" | "console" }
  | { ok: false; error: string };

const FROM = process.env.EMAIL_FROM ?? "JSWP Online <onboarding@resend.dev>";

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logDevFallback(input);
    return { ok: true, mode: "console" };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("[email] Resend send failed:", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, mode: "resend" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] Unexpected send error:", msg);
    return { ok: false, error: msg };
  }
}

function logDevFallback(input: SendEmailInput) {
  const bar = "=========================================";
  const truncated =
    input.text.length > 500 ? input.text.slice(0, 500) + "…" : input.text;
  console.log(
    [
      "",
      bar,
      "[EMAIL] (no RESEND_API_KEY — dev fallback)",
      bar,
      `To:      ${input.to}`,
      `Subject: ${input.subject}`,
      "---",
      truncated,
      bar,
      "",
    ].join("\n")
  );
}
