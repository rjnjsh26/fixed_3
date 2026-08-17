import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// Used by /api/gdrive/authorize to build the "sign in with Google" link.
export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces Google to issue a refresh_token every time, not just the first time
    scope: SCOPES,
  });
}

// Used by /api/gdrive/callback to trade the one-time code for a refresh token.
export async function exchangeCodeForTokens(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // tokens.refresh_token is the value that goes into GOOGLE_REFRESH_TOKEN
}

function getDrive() {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: client });
}

export async function uploadToDrive(buffer: Buffer, mimeType: string, filename: string) {
  const drive = getDrive();
  const folderId = process.env.GDRIVE_FOLDER_ID;

  const created = await drive.files.create({
    requestBody: { name: filename, parents: folderId ? [folderId] : undefined },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
  });

  const fileId = created.data.id!;

  // Make it viewable by anyone with the link, so it can render inline in
  // chat bubbles without every viewer needing their own Drive permission.
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });

  return {
    id: fileId,
    viewUrl: created.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    imageUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
  };
}

export async function deleteFromDrive(fileId: string) {
  try {
    const drive = getDrive();
    await drive.files.delete({ fileId });
  } catch {
    // best-effort — if this fails, the message still disappears from the
    // chat, it just leaves an orphaned file in the Drive folder.
  }
}
