/**
 * "Your account application was not approved" email. Includes the
 * admin-supplied denial reason so the user knows what to do next.
 */

export type AccountDeniedProps = {
  firstName: string;
  districtName: string;
  denialReason: string;
};

export function renderAccountDenied({
  firstName,
  districtName,
  denialReason,
}: AccountDeniedProps): { subject: string; html: string; text: string } {
  const subject = `Update on your JSWP Online application`;

  const text = [
    `Hi ${firstName},`,
    ``,
    `We reviewed your JSWP Online application for ${districtName} but couldn't approve it at this time.`,
    ``,
    `Reason: ${denialReason}`,
    ``,
    `Reply to this email if you have questions.`,
    ``,
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
                Update on your application
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:16px;">
                Hi ${escapeHtml(firstName)},
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-bottom:16px;">
                We reviewed your JSWP Online application for <strong>${escapeHtml(districtName)}</strong> but couldn't approve it at this time.
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;background-color:#f9fafb;border-left:3px solid #d1d5db;padding:12px 16px;margin-bottom:16px;">
                <strong>Reason:</strong> ${escapeHtml(denialReason)}
              </td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#374151;line-height:1.6;padding-top:16px;">
                Reply to this email if you have questions.
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
