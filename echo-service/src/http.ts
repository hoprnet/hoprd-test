// src/index.ts
import express, { Request, Response } from 'express';

const app = express();
const port = 8080;

app.get('*', (req: Request, res: Response) => {
  const queryParams = req.query;
  console.log(JSON.stringify(queryParams));
  res.json({ message: queryParams });
});

const server = app.listen(port, () => {
  console.log(`[HTTP] Server listening on port ${port}`);
}).on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Implement graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('[HTTP] Server closed');
    process.exit(0);
  });
});