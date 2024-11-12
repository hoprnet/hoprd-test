// src/index.ts
import express, { Request, Response } from 'express';

const app = express();
const port = 8080;

app.get('*', (req: Request, res: Response) => {
  const queryParams = req.query;
  console.log(JSON.stringify(queryParams));
  res.json({ message: queryParams });
});

app.listen(port, () => {
  console.log(`Echo service listening on port ${port}`);
});