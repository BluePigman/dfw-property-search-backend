import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/tables", async (_req, res) => {
    const result = await pool.query(`
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE'
    ORDER BY table_schema, table_name;
  `);

    res.json(result.rows);
});

export default router;
