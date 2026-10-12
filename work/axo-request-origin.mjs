const localOrigins = new Set(['http://127.0.0.1:43187', 'http://localhost:43187']);
export function publicOrigin() {
  const origin = process.env.AXO_PUBLIC_ORIGIN || 'https://streams.axo.vision';
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw Error('AXO_PUBLIC_ORIGIN must be an HTTPS origin without a path.');
  return url.origin;
}
export function isAxoOrigin(req) {
  const origin = req.headers.origin;
  return origin === publicOrigin() || (localOrigins.has(origin) && origin === 'http://' + req.headers.host);
}
export function isAxoHost(host) {
  return ['127.0.0.1:43187', 'localhost:43187', new URL(publicOrigin()).host].includes(host);
}
export function isSecureAxoRequest(req) {
  return req.socket?.encrypted || req.headers.origin === publicOrigin() || req.headers.host === new URL(publicOrigin()).host || req.headers['x-forwarded-proto'] === 'https';
}
