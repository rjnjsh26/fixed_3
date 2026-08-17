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
    fields: "id, name, mimeType",
  });

  const fileId = created.data.id!;

  // No public "anyone with the link" permission is granted here on purpose —
  // files stay private on Drive. Everyone in the app views/downloads them
  // through this app's own /api/files/[id] proxy instead, which is gated
  // by the normal login. Nothing about Google Drive is ever exposed to users.
  return {
    id: fileId,
    name: created.data.name || filename,
    mimeType: created.data.mimeType || mimeType,
  };
}

// Fetches just the metadata (name/type/size) for a file — used by the
// download proxy to set the right filename and Content-Type.
export async function getFileMeta(fileId: string) {
  const drive = getDrive();
  const res = await drive.files.get({ fileId, fields: "id, name, mimeType, size" });
  return res.data;
}

// Streams the actual file bytes — used by the download proxy so the file
// content flows straight from Drive to the browser without ever exposing a
// drive.google.com URL to the user.
export async function getFileStream(fileId: string) {
  const drive = getDrive();
  const res = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });
  return res.data;
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
