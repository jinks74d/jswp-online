/**
 * "You've been set up as a district contact" invite email. Sent when a
 * super-admin clicks Invite for a district POC. The CTA carries a Supabase
 * recovery link (?code → /reset-password) so the recipient sets their own
 * password and signs in. Plain HTML with inline styles — no images, no CSS
 * pseudoselectors, no media queries (survives Outlook/Gmail/Apple Mail).
 */

export type DistrictPocInviteProps = {
  firstName: string;
  districtName: string;
  /** Supabase recovery action link (sets password, then signs in). */
  inviteUrl: string;
};

export function renderDistrictPocInvite({
  firstName,
  districtName,
  inviteUrl,
}: DistrictPocInviteProps): { subject: string; html: string; text: string } {
  const subject = `Set up your JSWP Online account for ${districtName}`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `You've been added as a point of contact for ${districtName} on JSWP Online.`,
    `Use the link below to choose a password and sign in:`,
    inviteUrl,
    ``,
    `This link expires for security — if it stops working, ask your administrator to re-send the invite.`,
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
                You're set up on JSWP Online
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:16px;">
                Hi ${escapeHtml(firstName)},
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:24px;">
                You've been added as a point of contact for
                <strong>${escapeHtml(districtName)}</strong>. Choose a password
                below to finish setting up your account and sign in.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:6px;">
                  Set password &amp; sign in
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6b7280;line-height:1.6;">
                If the button doesn't work, copy and paste this link into your
                browser:<br />
                <span style="word-break:break-all;color:#2563eb;">${escapeHtml(inviteUrl)}</span>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#9ca3af;line-height:1.6;padding-top:24px;">
                This link expires for security. If it stops working, ask your
                administrator to re-send the invite.
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
