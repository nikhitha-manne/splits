import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY || '');

// Get app base URL from environment (default to local dev)
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

/**
 * Send invite email when a new invite document is created
 * Only sends emails for 'email' type invites (not 'link' type)
 */
export const onInviteCreated = functions.firestore
  .document('invites/{inviteId}')
  .onCreate(async (snap, context) => {
    const inviteData = snap.data();
    const inviteId = context.params.inviteId;

    // Only send emails for 'email' type invites (skip 'link' type)
    if (inviteData.type !== 'email') {
      console.log(`Skipping email for invite ${inviteId}: type is '${inviteData.type}', not 'email'`);
      return null;
    }

    // Skip if email was already sent (status is SENT or FAILED)
    if (inviteData.status === 'SENT' || inviteData.status === 'FAILED') {
      console.log(`Skipping email for invite ${inviteId}: status is already '${inviteData.status}'`);
      return null;
    }

    // Check if email field exists
    if (!inviteData.email) {
      console.error(`Invite ${inviteId} is type 'email' but has no email field`);
      await snap.ref.update({
        status: 'FAILED',
        errorMessage: 'Email field missing',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return null;
    }

    const inviteeEmail = inviteData.email;
    const token = inviteData.token;
    const groupId = inviteData.groupId;
    const createdBy = inviteData.createdBy;

    // Build invite link
    const inviteLink = `${APP_BASE_URL}/invite/${token}`;

    // Fetch group name
    let groupName: string | null = null;
    try {
      const groupDoc = await admin.firestore().doc(`groups/${groupId}`).get();
      if (groupDoc.exists) {
        groupName = groupDoc.data()?.name || null;
      }
    } catch (error) {
      console.error(`Error fetching group ${groupId}:`, error);
    }

    // Fetch inviter name from publicUsers
    let inviterName = 'Someone';
    try {
      const inviterDoc = await admin.firestore().doc(`publicUsers/${createdBy}`).get();
      if (inviterDoc.exists) {
        inviterName = inviterDoc.data()?.name || 'Someone';
      }
    } catch (error) {
      console.error(`Error fetching inviter ${createdBy}:`, error);
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
              ${inviterName} has invited you to join${groupName ? ` <strong>${groupName}</strong>` : ''} on Splitzy.
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

${inviterName} has invited you to join${groupName ? ` ${groupName}` : ''} on Splitzy.

Splitzy helps you split expenses with friends and groups easily.

Accept your invite by clicking this link:
${inviteLink}

If you didn't expect this invite, you can safely ignore this email.
    `.trim();

    // Send email via Resend
    try {
      const result = await resend.emails.send({
        from: 'Splitzy <onboarding@resend.dev>',
        to: [inviteeEmail],
        subject,
        html: htmlBody,
        text: textBody,
      });

      console.log(`Email sent successfully for invite ${inviteId}:`, result);

      // Update invite status to SENT
      await snap.ref.update({
        status: 'SENT',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    } catch (error: any) {
      console.error(`Error sending email for invite ${inviteId}:`, error);

      // Update invite status to FAILED
      await snap.ref.update({
        status: 'FAILED',
        errorMessage: error.message || 'Failed to send email',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    }
  });
