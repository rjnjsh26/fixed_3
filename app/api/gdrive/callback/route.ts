import { exchangeCodeForTokens } from "../../../../lib/gdrive";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const html = (body: string) => new Response(
    `<!doctype html><html><body style="font-family:system-ui;background:#0C1116;color:#ECF2F5;padding:40px;line-height:1.6">${body}</body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );

  if (error) {
    return html(`<h2>Google declined the request</h2><p>${error}</p>`);
  }
  if (!code) {
    return html(`<h2>Missing authorization code</h2><p>Try the connect link again.</p>`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return html(`
        <h2>No refresh token was returned</h2>
        <p>This usually means you've already authorized this app before. In Google's
        Account settings, go to Security → Third-party access, remove access for this
        app, then try the connect link again from the start.</p>
      `);
    }
    return html(`
      <h2>Connected — copy this value now</h2>
      <p>This is shown once. Copy it into your Vercel project's Environment Variables
      as <b>GOOGLE_REFRESH_TOKEN</b>, save, and redeploy.</p>
      <textarea readonly style="width:100%;max-width:600px;height:80px;background:#141B22;color:#2DD4BF;border:1px solid #232D38;border-radius:8px;padding:12px;font-size:14px">${tokens.refresh_token}</textarea>
      <p style="color:#7C8A99;font-size:13px">After you've saved it in Vercel, you can close this tab.</p>
    `);
  } catch (err) {
    return html(`<h2>Something went wrong exchanging the code</h2><p>${(err as Error).message}</p>`);
  }
}
