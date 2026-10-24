import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// Inspect tracked files only. Never open ignored local configuration or emit
// matching content: even a failing CI log must not disclose a credential.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const forbiddenPath = /(^|\/)(\.env(?:\..*)?|\.local)(\/|$)|\.(?:sqlite(?:-wal|-shm)?|db|log)$/i;
const credential = /sk_(?:test|live)_[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/;
let failures = 0;
for (const file of files) {
  if (forbiddenPath.test(file) && file !== '.env.example') {
    console.error(`Forbidden private/local file is tracked: ${file}`);
    failures++;
    continue;
  }
  if (credential.test(readFileSync(file, 'utf8'))) {
    console.error(`Potential credential found in tracked file: ${file}`);
    failures++;
  }
}
if (failures) process.exit(1);
console.log(`Tracked-file hygiene passed (${files.length} files). Pattern checks do not replace secret review.`);
