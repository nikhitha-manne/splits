# Firebase Cloud Functions for Splitzy

This directory contains Firebase Cloud Functions for sending invite emails via Resend.

## Setup

### 1. Install Dependencies

```bash
cd functions
npm install
```

### 2. Set Environment Variables

#### For Local Development (Emulator)

Create a `.env` file in the `functions` directory (not committed to git):

```bash
RESEND_API_KEY=your_resend_api_key_here
APP_BASE_URL=http://localhost:5173
```

**Note**: The `.env` file is already in `.gitignore` and won't be committed.

#### For Production Deployment

Use Firebase Functions secrets (recommended):

```bash
# Set secrets
echo "your_resend_api_key_here" | firebase functions:secrets:set RESEND_API_KEY
echo "https://your-app-domain.com" | firebase functions:secrets:set APP_BASE_URL
```

The function code will automatically use these secrets via `process.env` when deployed.

**Important**: Never commit API keys to version control. Always use secrets for production.

## Local Development

### Run Firebase Emulators

```bash
# From project root
firebase emulators:start
```

This will start:
- Functions emulator on port 5001
- Firestore emulator on port 8080
- Emulator UI on port 4000

**Note**: For the emulator to use environment variables, you may need to load them manually or use a tool like `dotenv-cli`.

### Build Functions

```bash
cd functions
npm run build
```

## Deployment

### Deploy Functions to Production

```bash
# From project root
firebase deploy --only functions
```

### Deploy Everything

```bash
firebase deploy
```

## Function Details

### `onInviteCreated`

- **Trigger**: Firestore `onCreate` for `invites/{inviteId}`
- **Purpose**: Sends email invitation when a new invite document is created
- **Behavior**:
  - Only sends emails for invites with `type: 'email'`
  - Skips invites with `type: 'link'`
  - Skips if status is already `SENT` or `FAILED`
  - Fetches group name and inviter name from Firestore
  - Sends email via Resend
  - Updates invite status to `SENT` on success or `FAILED` on error
  - Adds `sentAt` timestamp and optional `errorMessage`

## Email Template

The email includes:
- Inviter's name (from `publicUsers` collection)
- Group name (if available)
- Invite link: `${APP_BASE_URL}/invite/${token}`
- HTML and plain text versions

## Troubleshooting

1. **Email not sending**: 
   - Check that `RESEND_API_KEY` is set correctly
   - Verify the invite document has `type: 'email'` and an `email` field
   - Check function logs: `firebase functions:log`

2. **Invite status not updating**: 
   - Cloud Functions run with admin privileges and bypass Firestore rules
   - Check function logs for errors

3. **Function not triggering**: 
   - Ensure invite document is created in the `invites` collection
   - Verify the function is deployed: `firebase functions:list`

4. **Local emulator not working**:
   - Ensure Firestore emulator is running
   - Check that `.env` file exists with correct values
   - Verify emulator logs for errors

## Testing

To test locally:

1. Start emulators: `firebase emulators:start`
2. Create an invite document in Firestore emulator with:
   ```json
   {
     "groupId": "test-group-id",
     "createdBy": "test-user-id",
     "type": "email",
     "email": "test@example.com",
     "token": "test-token-123",
     "status": "pending",
     "createdAt": "2024-01-01T00:00:00Z"
   }
   ```
3. Check function logs for email sending status
4. Verify invite document status is updated to `SENT` or `FAILED`
