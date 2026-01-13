import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || '');

interface SendInviteEmailRequest {
  toEmail: string;
  inviteLink: string;
  inviterName: string;
  groupName: string | null;
  type: 'group' | 'direct' | 'generic';
}

export default async function handler(req: any, res: any) {
  console.log('[send-invite-email] Incoming request', {
    method: req.method,
    url: req.url,
  });

  if (req.method !== 'POST') {
    console.warn('[send-invite-email] Method not allowed', req.method);
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const body: SendInviteEmailRequest = req.body as SendInviteEmailRequest;
  const { toEmail, inviteLink, inviterName, groupName, type } = body || ({} as SendInviteEmailRequest);

  console.log('[send-invite-email] Parsed body', {
    hasToEmail: !!toEmail,
    hasInviteLink: !!inviteLink,
    inviterName,
    groupName,
    type,
  });

  if (!toEmail || !inviteLink) {
    console.warn('[send-invite-email] Missing required fields', { toEmail, inviteLink });
    return res.status(400).json({ ok: false, message: 'Missing required fields: toEmail, inviteLink' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('[send-invite-email] RESEND_API_KEY is not set');
    return res.status(500).json({ ok: false, message: 'Email service not configured' });
  }

  const subject = groupName
    ? `You're invited to join ${groupName} on Splitzy`
    : "You're invited to Splitzy";

  const htmlBody = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #ffffff; border-radius: 8px; padding: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 16px;">You're Invited!</h1>
          <p style="color: #374151; font-size: 16px; margin-bottom: 16px;">
            ${inviterName || 'Someone'} has invited you to join${groupName ? ` <strong>${groupName}</strong>` : ''} on Splitzy.
          </p>
          <p style="color: #374151; font-size: 16px; margin-bottom: 24px;">
            Splitzy helps you split expenses with friends and groups easily.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${inviteLink}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; font-size: 16px;">
              Accept Invite
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">
            Or copy and paste this link into your browser:<br>
            <a href="${inviteLink}" style="color: #2563eb; word-break: break-all;">${inviteLink}</a>
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
            If you didn't expect this invite, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
  `;

  const textBody = `
You're Invited!

${inviterName || 'Someone'} has invited you to join${groupName ? ` ${groupName}` : ''} on Splitzy.

Splitzy helps you split expenses with friends and groups easily.

Accept your invite by clicking this link:
${inviteLink}

If you didn't expect this invite, you can safely ignore this email.
  `.trim();

  try {
    const result = await resend.emails.send({
      from: 'Splitzy <onboarding@resend.dev>',
      to: [toEmail],
      subject,
      html: htmlBody,
      text: textBody,
    });

    console.log('[send-invite-email] Email sent successfully', result);

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('[send-invite-email] Error sending email', {
      message: error?.message,
      stack: error?.stack,
    });
    return res.status(500).json({
      ok: false,
      message: error?.message || 'Failed to send email',
    });
  }
}
