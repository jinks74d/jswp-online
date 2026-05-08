/**
 * "Your account is approved" email. Plain HTML with inline styles —
 * no images, no CSS pseudoselectors, no media queries (the basics that
 * survive Outlook/Gmail/Apple Mail without surprises).
 */

export type AccountApprovedProps = {
  firstName: string;
  districtName: string;
  loginUrl: string;
};

export function renderAccountApproved({
  firstName,
  districtName,
  loginUrl,
}: AccountApprovedProps): { subject: string; html: string; text: string } {
  const subject = `Your JSWP Online account at ${districtName} is approved`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `Your account at ${districtName} has been approved. You can sign in here:`,
    loginUrl,
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
                You're approved
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:16px;">
                Hi ${escapeHtml(firstName)},
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:24px;">
                Your account at <strong>${escapeHtml(districtName)}</strong> has been approved. You can sign in below.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="${escapeHtml(loginUrl)}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 16px;border-radius:6px;">
                  Sign in
                </a>
              </td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#6b7280;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:16px;">
                If the button doesn't work, paste this link into your browser:<br />
                <a href="${escapeHtml(loginUrl)}" style="color:#2563eb;word-break:break-all;">${escapeHtml(loginUrl)}</a>
              </td>
            </tr>
          </table>
          <div style="font-size:12px;color:#9ca3af;padding-top:16px;">JSWP Online</div>
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
