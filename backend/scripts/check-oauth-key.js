const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const envPath = path.resolve(__dirname, '../.env');
console.log('env file:', envPath);
console.log('env exists:', fs.existsSync(envPath));

if (!fs.existsSync(envPath)) {
  console.log('FAIL: Create backend/.env (copy from backend/.env.example)');
  process.exit(1);
}

const raw = fs.readFileSync(envPath, 'utf8');
const line = raw.split(/\r?\n/).find((l) => /^\s*OAUTH_TOKEN_ENCRYPTION_KEY\s*=/.test(l));

if (!line) {
  console.log('FAIL: OAUTH_TOKEN_ENCRYPTION_KEY not found in backend/.env');
  process.exit(1);
}

const val = line.replace(/^\s*OAUTH_TOKEN_ENCRYPTION_KEY\s*=\s*/, '').replace(/\s*#.*$/, '').trim();
const unquoted = val.replace(/^['"]|['"]$/g, '');
const loaded = process.env.OAUTH_TOKEN_ENCRYPTION_KEY || '';

console.log('file value length:', unquoted.length, '(need 64)');
console.log('file value is hex:', /^[0-9a-fA-F]{64}$/.test(unquoted));
console.log('is placeholder:', /your_64_char/i.test(unquoted));
console.log('has extra whitespace:', val !== unquoted || /\s/.test(val));
console.log('dotenv loaded length:', loaded.length, '(need 64)');
console.log('dotenv loaded is hex:', /^[0-9a-fA-F]{64}$/.test(loaded));

if (/^[0-9a-fA-F]{64}$/.test(loaded)) {
  console.log('OK: Key is valid');
  process.exit(0);
}

console.log('FAIL: Fix OAUTH_TOKEN_ENCRYPTION_KEY in backend/.env');
console.log('Generate: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
process.exit(1);
