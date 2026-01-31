import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (_req, res) => {
    const result = await pool.query(
        "SELECT * FROM takehome.dallas_parcels LIMIT 10"
    );
    res.json(result.rows);
});

export default router;