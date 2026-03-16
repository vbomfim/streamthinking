import { createGateway } from './server.js';

const gw = createGateway({ port: 8080 });
gw.start();
console.log('✅ Gateway listening on ws://localhost:8080');

process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await gw.stop();
  process.exit(0);
});
