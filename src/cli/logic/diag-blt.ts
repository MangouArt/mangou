#!/usr/bin/env bun
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.BLTAI_API_KEY;
console.log('Testing BLTAI key starting with:', apiKey?.slice(0, 5));

const res = await fetch('https://api.bltcy.ai/v1/images/generations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: 'nano-banana',
    prompt: 'a tiny mango',
    response_format: 'url'
  })
});

console.log('Status:', res.status);
console.log('Response:', await res.text());
