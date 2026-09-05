console.log('Starting server...');
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());
console.log('Files in src/backend:', require('fs').readdirSync('src/backend'));

import http from 'http';
const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
