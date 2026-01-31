import { Router, type Request } from "express";
import { pool } from "../db.js";

const router = Router();

function buildParcelFilters(req: Request, isAuthenticated: boolean) {
    const { minPrice, maxPrice, minSqft, maxSqft } = req.query;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (!isAuthenticated) {
        conditions.push(`county = 'dallas'`);
    }

    if (minPrice !== undefined) {
        conditions.push(`(total_value)::numeric >= $${paramIndex++}`);
        params.push(Number(minPrice));
    }

    if (maxPrice !== undefined) {
        conditions.push(`(total_value)::numeric <= $${paramIndex++}`);
        params.push(Number(maxPrice));
    }

    if (minSqft !== undefined) {
        conditions.push(`sqft IS NOT NULL AND sqft >= $${paramIndex++}`);
        params.push(Number(minSqft));
    }

    if (maxSqft !== undefined) {
        conditions.push(`sqft IS NOT NULL AND sqft <= $${paramIndex++}`);
        params.push(Number(maxSqft));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereClause, params };
}

router.get("/", async (req, res) => {
    try {
        const isAuthenticated = Boolean(req.headers.authorization);
        console.log(`Parcels request by ${isAuthenticated ? "AUTHENTICATED" : "GUEST"} user`);

        const { whereClause, params } = buildParcelFilters(req, isAuthenticated);

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
            geometry: row.geometry ? JSON.parse(row.geometry) : null
        }));

        res.json(formatted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/export", async (req, res) => {
    try {
        const isAuthenticated = Boolean(req.headers.authorization);
        console.log(`CSV export by ${isAuthenticated ? "AUTHENTICATED" : "GUEST"} user`);

        const { whereClause, params } = buildParcelFilters(req, isAuthenticated);

        const query = `
            SELECT sl_uuid, address, county, sqft, total_value
            FROM takehome.dallas_parcels
            ${whereClause}
        `;

        const { rows } = await pool.query(query, params);

        // Build CSV
        const header = ["sl_uuid", "address", "county", "sqft", "total_value"];
        const csvRows = [
            header.join(","),
            ...rows.map(row =>
                header.map(field => {
                    const value = row[field];
                    if (value === null || value === undefined) return "";
                    return `"${String(value).replace(/"/g, '""')}"`;
                }).join(",")
            )
        ];

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=parcels.csv");
        res.send(csvRows.join("\n"));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to export CSV" });
    }
});

export default router;