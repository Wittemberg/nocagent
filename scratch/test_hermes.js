require('dotenv').config({ path: '/var/www/nocagent/.env' });
const { processMessage } = require('/var/www/nocagent/core/src/agent/hermes');

async function test() {
  const result = await processMessage({
    text: 'manda um print da camera 6 do dvr 01 da loja 4',
    senderPhone: '1234567890',
    senderName: 'TestUser',
    role: 'SUPERADMIN'
  });
  console.log(result);
}

test();
