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
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  // Validate request body
  const { toEmail, inviteLink, inviterName, groupName, type }: SendInviteEmailRequest = req.body;

  if (!toEmail || !inviteLink) {
    return res.status(400).json({ ok: false, message: 'Missing required fields: toEmail, inviteLink' });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ ok: false, message: 'Email service not configured' });
  }

  // Build email subject
  const subject = groupName
    ? `You're invited to join ${groupName} on Splitzy`
    : "You're invited to Splitzy";

  // Build email HTML body
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

  // Build plain text fallback
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

    console.log('Email sent successfully:', result);

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({
      ok: false,
      message: error.message || 'Failed to send email',
    });
  }
}
