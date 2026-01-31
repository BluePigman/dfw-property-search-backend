import express from 'express';
import cors from 'cors';
import { pool } from "./db.js";
import inspectRouter from "./routes/inspect.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/inspect", inspectRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});


app.get("/db-test", async (_req, res) => {
  const result = await pool.query("SELECT 1 as test");
  res.json(result.rows);
});

export default app;