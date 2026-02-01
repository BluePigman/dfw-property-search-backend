import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { saveFilters, loadFilters } from "../storage/filterStore.js";

const router = Router();

function buildParcelFilters(req: Request, isAuthenticated: boolean) {
    const { minPrice, maxPrice, minSqft, maxSqft, west, east, south, north } = req.query;
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

    let orderBy = "sl_uuid";
    if (west !== undefined && east !== undefined && south !== undefined && north !== undefined) {
        conditions.push(`public.ST_Intersects(geom, public.ST_MakeEnvelope($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, 4326))`);
        params.push(Number(west), Number(south), Number(east), Number(north));

        const centerX = (Number(west) + Number(east)) / 2;
        const centerY = (Number(south) + Number(north)) / 2;
        orderBy = `public.ST_Distance(geom, public.ST_SetSRID(public.ST_MakePoint(${centerX}, ${centerY}), 4326)) ASC`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return { whereClause, params, orderBy };
}

function getUserKey(req: Request): string {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.decode(token);
            if (decoded && typeof decoded === "object") {
                const userId = decoded.sub || decoded.id || decoded.userId || decoded.user_id;
                if (userId) return String(userId);
            }
        } catch (err) {
            console.error("Error decoding token:", err);
        }
        return authHeader;
    }
    return req.ip || "anonymous";
}

router.get("/", async (req, res) => {
    try {
        const userKey = getUserKey(req);
        const isAuthenticated = Boolean(req.headers.authorization);
        console.log(`Parcels request by ${isAuthenticated ? "AUTHENTICATED" : "GUEST"} user (${userKey})`);

        const { whereClause, params, orderBy } = buildParcelFilters(req, isAuthenticated);

        // Authenticated users get 1000 rows, guests get 500
        const limit = isAuthenticated ? 1000 : 500;

        const query = `
            SELECT sl_uuid, address, county, sqft, total_value,
                   public.ST_AsGeoJSON(geom, 6) AS geometry
            FROM takehome.dallas_parcels
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT ${limit}
        `;

        const { rows } = await pool.query(query, params);

        const { west: _w, east: _e, south: _s, north: _n, ...otherFilters } = req.query;
        saveFilters(userKey, otherFilters);

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

router.get("/filters", (req, res) => {
    try {
        const userKey = getUserKey(req);
        const filters = loadFilters(userKey);
        res.json(filters);
    } catch (err) {
        console.error("Error loading filters:", err);
        res.status(500).json({ error: "Failed to load filters" });
    }
});

router.get("/export", async (req, res) => {
    try {
        const isAuthenticated = Boolean(req.headers.authorization);
        console.log(`CSV export starting for ${isAuthenticated ? "AUTHENTICATED" : "GUEST"} user`);

        const { whereClause, params } = buildParcelFilters(req, isAuthenticated);

        // Limit export to 10,000 rows to prevent heap memory exhaustion on Render
        const query = `
            SELECT sl_uuid, address, county, sqft, total_value
            FROM takehome.dallas_parcels
            ${whereClause}
            LIMIT 10000
        `;

        const { rows } = await pool.query(query, params);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=parcels.csv");

        // Write header
        const header = ["sl_uuid", "address", "county", "sqft", "total_value"];
        res.write(header.join(",") + "\n");

        // Stream rows to avoid creating a massive in-memory string
        for (const row of rows) {
            const csvLine = header.map(field => {
                const value = (row as any)[field];
                if (value === null || value === undefined) return "";
                const strValue = String(value).replace(/"/g, '""');
                return strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')
                    ? `"${strValue}"`
                    : strValue;
            }).join(",");
            res.write(csvLine + "\n");
        }

        res.end();
    } catch (err) {
        console.error("Export error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to export CSV" });
        } else {
            res.end();
        }
    }
});

export default router;