import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

const BILLING_URL = process.env.BILLING_URL || 'http://localhost:8008';
const TOKEN_PATH = path.join(os.homedir(), '.mangou', 'token');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function request(endpoint, body) {
  const res = await fetch(`${BILLING_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function login() {
  const email = await new Promise(resolve => rl.question('Enter Email: ', resolve));
  
  console.log(`Sending verification code to ${email}...`);
  const sendRes = await request('/auth/send-code', { email });
  if (sendRes.status !== 'ok') {
    console.error('Failed to send code:', sendRes.msg);
    process.exit(1);
  }

  const code = await new Promise(resolve => rl.question('Enter Verification Code: ', resolve));
  console.log('Logging in...');
  const loginRes = await request('/auth/login', { email, code });

  if (loginRes.status === 'ok') {
    const dir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKEN_PATH, loginRes.token);
    console.log('Login successful! Token saved to', TOKEN_PATH);
  } else {
    console.error('Login failed:', loginRes.detail || loginRes.msg);
  }
  rl.close();
}

login();
