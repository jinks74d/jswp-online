/**
 * "Reset your password" email. Sent by requestResetAction instead of leaving
 * it to Supabase's built-in mailer, so the one message every teacher and
 * student eventually receives looks like the rest of the product rather than
 * a default template from a vendor they've never heard of.
 *
 * Carries a Supabase recovery action link, minted with admin.generateLink —
 * the same mechanism the district POC invite uses.
 *
 * Plain HTML with inline styles — no images, no CSS pseudoselectors, no media
 * queries (survives Outlook/Gmail/Apple Mail), matching the other templates
 * in this folder.
 */

export type PasswordResetProps = {
  /** The recipient's first name, or null when we don't have one on file. */
  firstName: string | null;
  /** District name for the sign-off, defaulting to the product name. */
  districtName: string;
  /** District primary colour as #rrggbb, already hex-validated upstream. */
  primaryColor: string;
  /** Supabase recovery action link. */
  resetUrl: string;
  /**
   * Who started this. "self" is the forgot-password form; "admin" is a
   * super/district/school admin sending a reset on the user's behalf.
   *
   * It changes two sentences, and the change matters: "we received a request"
   * is alarming and wrong when the recipient made no request, and the
   * "ignore this if you didn't ask" line actively invites a user to discard a
   * reset their own administrator just sent them.
   */
  initiatedBy?: "self" | "admin";
};

export function renderPasswordReset({
  firstName,
  districtName,
  primaryColor,
  resetUrl,
  initiatedBy = "self",
}: PasswordResetProps): { subject: string; html: string; text: string } {
  const byAdmin = initiatedBy === "admin";
  const subject = byAdmin
    ? `Set a new password for your ${districtName} account`
    : `Reset your ${districtName} password`;
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const leadIn = byAdmin
    ? `An administrator has sent you a link to set a new password for your ${districtName} account on JSWP Online.`
    : `We received a request to reset the password for your ${districtName} account on JSWP Online.`;
  const footnote = byAdmin
    ? `If you weren't expecting this, check with your administrator before using the link.`
    : `If you didn't ask for this, you can ignore this email — your password will stay as it is.`;

  const text = [
    greeting,
    ``,
    leadIn,
    `Use the link below to choose a new one:`,
    resetUrl,
    ``,
    `This link expires in one hour and can only be used once.`,
    ``,
    footnote,
    ``,
    `Thanks,`,
    `JSWP Online`,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:32px;">
            <tr>
              <td style="font-size:20px;font-weight:600;color:#111827;padding-bottom:16px;">
                Reset your password
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:16px;">
                ${escapeHtml(greeting)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:24px;">
                ${escapeHtml(leadIn)}
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background-color:${escapeHtml(primaryColor)};color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:6px;">
                  Choose a new password
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6b7280;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your
                browser:<br />
                <span style="word-break:break-all;color:${escapeHtml(primaryColor)};">${escapeHtml(resetUrl)}</span>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#9ca3af;line-height:1.6;padding-top:24px;">
                This link expires in one hour and can only be used once.
                ${escapeHtml(footnote)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html, text };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
