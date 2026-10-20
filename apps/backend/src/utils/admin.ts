import { createInterface, emitKeypressEvents } from 'node:readline';
import { z } from '@tovarka/shared';
import { prisma } from '../config/database.js';
import { setAdminPassword } from '../services/admin.service.js';
class AdminSetupError extends Error {}
async function promptPassword(label: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdin.setRawMode)
    throw new AdminSetupError(
      'Run this command in an interactive terminal (PowerShell or Windows Terminal on Windows).',
    );
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write('\n');
    };
    const onKey = (
      text: string | undefined,
      key: { name?: string; ctrl?: boolean; meta?: boolean },
    ) => {
      if (key.ctrl && key.name === 'c') {
        finish();
        reject(new AdminSetupError('Cancelled.'));
      } else if (key.name === 'return' || key.name === 'enter') {
        finish();
        resolve(value);
      } else if (key.name === 'backspace') {
        if (value.length) {
          value = [...value].slice(0, -1).join('');
          process.stdout.write('\b \b');
        }
      } else if (
        text &&
        [...text].every(
          (character) =>
            character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
        ) &&
        !key.ctrl &&
        !key.meta &&
        !['escape', 'up', 'down', 'left', 'right', 'tab', 'delete'].includes(
          key.name ?? '',
        ) &&
        value.length < 128
      ) {
        value += text;
        process.stdout.write('*');
      }
    };
    process.stdin.on('keypress', onKey);
  });
}
try {
  if (!process.stdin.isTTY)
    throw new AdminSetupError(
      'Run this command in an interactive terminal (PowerShell or Windows Terminal on Windows).',
    );
  const reader = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const username = await new Promise<string>((resolve) =>
    reader.question('Administrator username [admin]: ', (answer) =>
      resolve(answer.trim() || 'admin'),
    ),
  );
  reader.close();
  if (
    !z
      .string()
      .regex(/^[a-zA-Z0-9_-]{3,80}$/)
      .safeParse(username).success
  )
    throw new AdminSetupError(
      'Username must contain 3-80 letters, digits, underscores, or hyphens.',
    );
  console.log(
    'This command creates the account or resets its password and revokes its sessions.',
  );
  const password = await promptPassword('Password (12-128 characters): ');
  const confirmation = await promptPassword('Repeat password: ');
  if (password.length < 12 || password.length > 128)
    throw new AdminSetupError('Password must contain 12-128 characters.');
  if (password !== confirmation)
    throw new AdminSetupError('Passwords do not match.');
  await setAdminPassword(username, password);
  console.log('Administrator saved. Open /admin on your store to sign in.');
} catch (error) {
  console.error(
    error instanceof AdminSetupError
      ? error.message
      : 'Administrator setup failed. Verify PostgreSQL is running and npm run db:migrate has succeeded.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
