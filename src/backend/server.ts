import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

console.log('Minimal server starting...');

// Intercept .get to see what's being registered
const originalGet = app.get.bind(app);
app.get = function(path: any, ...args: any[]) {
  console.log(`[ROUTE] Registering GET: ${path}`);
  if (path === '*') {
    console.error('[ERROR] Wildcard route attempted!');
    console.trace();
  }
  return originalGet(path, ...args);
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
