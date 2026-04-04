import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8088';
const TEST_EMAIL = 'jachin@mangou.art'; // 使用手动 Seed 的测试用户

async function testFlow() {
    try {
        console.log('--- 1. Testing /auth/send-code ---');
        const sendCodeRes = await fetch(`${BASE_URL}/auth/send-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: TEST_EMAIL })
        });
        const sendCodeData = await sendCodeRes.json();
        console.log('Send Code Response:', sendCodeData);

        console.log('\n--- 2. Testing /auth/login (Mock Mode) ---');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: TEST_EMAIL, code: '123456' }) // 此时后端逻辑是 Mock 的
        });
        const loginData = await loginRes.json();
        console.log('Login Response:', loginData);

        if (!loginData.token) {
            throw new Error('Login failed, no token returned');
        }
        const token = loginData.token;

        console.log('\n--- 3. Testing /billing/balance ---');
        const balanceRes = await fetch(`${BASE_URL}/billing/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const balanceData = await balanceRes.json();
        console.log('Balance Response:', balanceData);

        console.log('\n--- 4. Testing /v1/aigc/task (Proxy to KIE) ---');
        const taskRes = await fetch(`${BASE_URL}/v1/aigc/task`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: 'image',
                provider: 'kie',
                params: {
                    prompt: 'A cute mango character',
                    model: 'stable-diffusion'
                }
            })
        });
        const taskData = await taskRes.json();
        console.log('AIGC Task Response:', taskData);

        console.log('\n--- 5. Verifying Balance Deduction ---');
        const finalBalanceRes = await fetch(`${BASE_URL}/billing/balance`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const finalBalanceData = await finalBalanceRes.json();
        console.log('Final Balance Response:', finalBalanceData);

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

testFlow();
