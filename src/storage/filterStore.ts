import fs from "fs";
import path from "path";

const FILE_PATH = path.join(process.cwd(), "filters.json");

type FilterMap = Record<string, any>;

function readStore(): FilterMap {
    if (!fs.existsSync(FILE_PATH)) return {};
    try {
        const content = fs.readFileSync(FILE_PATH, "utf-8");
        return JSON.parse(content);
    } catch (err) {
        console.error("Error reading filter store:", err);
        return {};
    }
}

function writeStore(data: FilterMap) {
    try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Error writing to filter store:", err);
    }
}

export function saveFilters(userKey: string, filters: any) {
    if (Object.keys(filters).length === 0) return;

    const store = readStore();
    store[userKey] = {
        filters,
        updatedAt: new Date().toISOString(),
    };
    writeStore(store);
}

export function loadFilters(userKey: string) {
    const store = readStore();
    return store[userKey]?.filters ?? null;
}