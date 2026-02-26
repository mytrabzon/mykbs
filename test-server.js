const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint works!', timestamp: new Date().toISOString() });
});

const PORT = 8081;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Test server running on http://${HOST}:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.4.105:${PORT}`);
});
