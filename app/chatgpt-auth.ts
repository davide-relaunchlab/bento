// Adapted from the Sites auth add-on. These headers are trusted ONLY behind
// the Sites dispatcher; the dev plugin strips spoofed inbound identity headers.
export type ChatGPTUser = { userId: string; email: string; displayName: string };
export function getChatGPTUser(request: Request): ChatGPTUser | null {
  const h = request.headers, userId = h.get('oai-authenticated-user-id'), email = h.get('oai-authenticated-user-email');
  if (!userId || !email) return null;
  let fullName: string | null = null;
  if (h.get('oai-authenticated-user-full-name-encoding') === 'percent-encoded-utf-8') {
    try { fullName = decodeURIComponent(h.get('oai-authenticated-user-full-name') ?? ''); } catch { /* malformed name is cosmetic */ }
  }
  return { userId, email:email.trim().toLowerCase(), displayName:fullName || email };
}
export function chatGPTSignInPath(returnTo = '/'): string {
  let path = '/';
  try {
    const url = new URL(returnTo, 'https://app.local');
    if (returnTo.startsWith('/') && url.origin === 'https://app.local' && !['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(url.pathname)) path = url.pathname + url.search + url.hash;
  } catch { /* use root */ }
  return '/signin-with-chatgpt?return_to=' + encodeURIComponent(path);
}
