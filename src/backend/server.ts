import http from 'http';
import { readFileSync } from 'fs';

const PORT = process.env.PORT || 3001;
let version = 'unknown';

try {
  version = readFileSync('/app/VERSION', 'utf-8').trim();
} catch (e) {
  console.error('Could not read VERSION file');
}

console.log(`✅ Server v${version} starting on port ${PORT}`);

const server = http.createServer((req, res) => {
  const response = { status: 'ok', version, timestamp: new Date().toISOString() };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
});

server.listen(PORT, () => {
  console.log(`✅ Server v${version} listening on port ${PORT}`);
});
