import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const isAuthenticated = Boolean(authHeader);

        if (isAuthenticated) {
            console.log("Parcels request by AUTHENTICATED user");
        } else {
            console.log("Parcels request by GUEST user");
        }

        // Extract filter query parameters
        const { minPrice, maxPrice, minSqft, maxSqft } = req.query;

        // Build dynamic WHERE conditions
        const conditions: string[] = [];
        const params: (string | number)[] = [];
        let paramIndex = 1;

        // Guest users are restricted to Dallas county
        if (!isAuthenticated) {
            conditions.push(`county = 'dallas'`);
        }

        if (minPrice !== undefined) {
            conditions.push(`total_value >= $${paramIndex++}`);
            params.push(Number(minPrice));
        }

        if (maxPrice !== undefined) {
            conditions.push(`total_value <= $${paramIndex++}`);
            params.push(Number(maxPrice));
        }

        if (minSqft !== undefined) {
            conditions.push(`sqft >= $${paramIndex++}`);
            params.push(Number(minSqft));
        }

        if (maxSqft !== undefined) {
            conditions.push(`sqft <= $${paramIndex++}`);
            params.push(Number(maxSqft));
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        const query = `
            SELECT sl_uuid, address, county, sqft, total_value,
                   public.ST_AsGeoJSON(geom) AS geometry
            FROM takehome.dallas_parcels
            ${whereClause}
            LIMIT 50
        `;

        const { rows } = await pool.query(query, params);

        const formatted = rows.map(row => ({
            ...row,
            geometry: JSON.parse(row.geometry)
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
