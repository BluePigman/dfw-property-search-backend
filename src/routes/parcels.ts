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

        const query = isAuthenticated
            ? `SELECT sl_uuid, address, county, sqft, total_value,
                 public.ST_AsGeoJSON(geom) AS geometry
         FROM takehome.dallas_parcels
         LIMIT 50`
            : `SELECT sl_uuid, address, county, sqft, total_value,
                 public.ST_AsGeoJSON(geom) AS geometry
         FROM takehome.dallas_parcels
         WHERE county = 'dallas'
         LIMIT 50`;

        const { rows } = await pool.query(query);

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
