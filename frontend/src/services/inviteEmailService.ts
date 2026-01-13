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
 * Get the API base URL for serverless endpoints
 * Defaults to same origin (for Vercel deployments)
 */
function getApiBaseUrl(): string {
  // In production, API routes are typically at the same origin
  // For local dev with Vercel CLI, use localhost:3000
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  }
  return import.meta.env.VITE_API_BASE_URL || window.location.origin;
}

/**
 * Send an invite email via the serverless endpoint
 */
export async function sendInviteEmail(
  payload: SendInviteEmailPayload
): Promise<SendInviteEmailResponse> {
  const apiBaseUrl = getApiBaseUrl();
  const url = `${apiBaseUrl}/api/send-invite-email`;

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
