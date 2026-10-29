import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Signs a tracker's resumption token before it goes to the browser.
 *
 * The resumption token identifies one AI answer (its run, config, and variation).
 * LaunchDarkly's SDK docs say to keep it on the server; this demo has no session
 * store, so it sends the token out with a signature instead. The browser can hand
 * it back with a thumbs up or down, but cannot forge one for an answer it never got.
 */
export function createTokenSigner(secret: string) {
  const mac = (value: string) => createHmac('sha256', secret).update(value).digest('base64url');
  return {
    sign(token: string): string {
      return `${token}.${mac(token)}`;
    },
    verify(signed: string): string | null {
      const dot = signed.lastIndexOf('.');
      if (dot <= 0) return null;
      const token = signed.slice(0, dot);
      const expected = Buffer.from(mac(token));
      const given = Buffer.from(signed.slice(dot + 1));
      return expected.length === given.length && timingSafeEqual(expected, given) ? token : null;
    },
  };
}
