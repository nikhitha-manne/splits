/**
 * Service for sending invite emails via external serverless endpoint
 */

export interface SendInviteEmailPayload {
  toEmail: string;
  inviteLink: string;
  inviterName: string;
  groupName: string | null;
  type: 'group' | 'direct' | 'generic';
}

export interface SendInviteEmailResponse {
  ok: boolean;
  message?: string;
}

/**
 * Send an invite email via the serverless endpoint
 */
export async function sendInviteEmail(
  payload: SendInviteEmailPayload
): Promise<SendInviteEmailResponse> {
  // Use relative URL so this works both locally (with Vercel dev) and in production
  const url = '/api/send-invite-email';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        ok: false,
        message: data.message || `HTTP ${response.status}: Failed to send email`,
      };
    }

    return data;
  } catch (error: any) {
    console.error('Error calling send-invite-email endpoint:', error);
    return {
      ok: false,
      message: error.message || 'Network error: Could not reach email service',
    };
  }
}
