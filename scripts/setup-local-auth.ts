import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, chmod } from 'node:fs/promises';
import { hashPassword } from '../server/security';
const path = '.env';
let source = await readFile(path, 'utf8').catch(() => '');
await chmod(path, 0o600).catch(() => {});
if (/^AUTH_OPERATOR_PASSWORD_HASH=.+$/m.test(source)) {
  console.log('Local authentication already configured. Existing credentials preserved.');
  process.exit(0);
}
const operator = randomBytes(24).toString('base64url'),
  viewer = randomBytes(24).toString('base64url');
const values = {
  AUTH_MODE: 'local',
  AUTH_OPERATOR_PASSWORD_HASH: await hashPassword(operator),
  AUTH_VIEWER_PASSWORD_HASH: await hashPassword(viewer),
};
for (const [name, value] of Object.entries(values)) {
  source = source.replace(new RegExp(`^${name}=.*\\n?`, 'm'), '');
  source += `\n${name}=${value}\n`;
}
await writeFile(path, source, { mode: 0o600 });
await chmod(path, 0o600);
await mkdir('research', { recursive: true });
await writeFile(
  'research/local-access.txt',
  `Why That Goal — local access only\n\nOperator password: ${operator}\nViewer password: ${viewer}\n\nThese grant access only to the local app. Keep this ignored file private.\n`,
  { mode: 0o600 },
);
console.log(
  'Local password hashes configured in ignored .env. Access credentials saved privately to research/local-access.txt.',
);
