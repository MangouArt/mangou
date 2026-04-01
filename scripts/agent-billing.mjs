import fs from 'fs';
import path from 'path';
import os from 'os';

const BILLING_URL = process.env.BILLING_URL || 'http://localhost:8008';
const TOKEN_PATH = path.join(os.homedir(), '.mangou', 'token');

async function getAuthToken() {
  try {
    return fs.readFileSync(TOKEN_PATH, 'utf-8');
  } catch {
    return null;
  }
}

async function main() {
  const token = await getAuthToken();
  if (!token) {
    console.error('Not logged in. Please run agent-auth.mjs first.');
    process.exit(1);
  }

  const action = process.argv[2] || 'balance';

  if (action === 'balance') {
    const res = await fetch(`${BILLING_URL}/billing/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`Current Balance: ${data.balance} Gems`);
  } else if (action === 'recharge') {
    const tier = process.argv[3] || 'gems_100';
    const res = await fetch(`${BILLING_URL}/billing/recharge-qr?tier=${tier}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    console.log(`\n--- RECHARGE ---`);
    console.log(`Scan the QR code or open link in browser to pay via Alipay:`);
    console.log(data.qr_url);
    console.log(`\n----------------\n`);
  } else {
    console.log('Usage: node agent-billing.mjs [balance|recharge <tier>]');
  }
}

main();
