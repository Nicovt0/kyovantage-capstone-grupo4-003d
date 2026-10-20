import { createECDH } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const key = createECDH('prime256v1');
key.generateKeys();
const publicKey = key.getPublicKey().toString('base64url');
const privateKey = key.getPrivateKey().toString('base64url');
const path = new URL('../.env.push-keys.local', import.meta.url);
// Never overwrite an existing pair: rotating it invalidates existing subscriptions.
writeFileSync(path, `# Staging only. Private key belongs in Supabase secrets, never VITE_*.
VITE_VAPID_PUBLIC_KEY=${publicKey}
VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_SUBJECT=mailto:Soporte@kyovantage.cl
`, { flag: 'wx', mode: 0o600 });
console.log('Claves guardadas en .env.push-keys.local (ignorado por Git). No se muestran claves privadas.');
