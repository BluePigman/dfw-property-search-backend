import express from 'express';
import cors from 'cors';
import parcelsRouter from "./routes/parcels.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/parcels", parcelsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;