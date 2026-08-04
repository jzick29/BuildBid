import https from 'https';
import { readFileSync } from 'fs';

const src = readFileSync('./scripts/seed-templates.cjs', 'utf8');
const match = src.match(/const SEED_TEMPLATES = (\[[\s\S]*?\]);/);
if (!match) { console.log('Could not extract templates'); process.exit(1); }
const SEED_TEMPLATES = eval(match[1]);

function post(path, data, cookie) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: 'buildbid.pro', path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...(cookie ? { Cookie: cookie } : {}) }
    }, res => {
      let responseBody = '';
      res.on('data', c => responseBody += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Login
  const login = await post('/api/login', { email: 'admin@buildbid.pro', password: 'BuildBid2026!' });
  if (login.status !== 200) { console.log('Login failed:', login.body); process.exit(1); }
  const cookie = login.headers['set-cookie']?.find(c => c.startsWith('buildbid_session='))?.split(';')[0];
  console.log('Logged in, session:', cookie.substring(0, 20) + '...');

  // Seed templates
  const seed = await post('/api/call', { function: 'templates.seedTemplates', args: { data: { templates: SEED_TEMPLATES } } }, cookie);
  console.log('Seed result:', seed.body);
  
  // Verify
  const list = await post('/api/call', { function: 'templates.getTemplates', args: {} }, cookie);
  console.log('Templates list:', list.body.substring(0, 200) + '...');
}

main().catch(console.error);
