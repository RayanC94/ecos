import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "192.168.64.8",
      port: parseInt(process.env.DB_PORT || "3306"),
      user: process.env.DB_USER || "ecos",
      password: process.env.DB_PASSWORD || "ecos_pass_2024",
      database: process.env.DB_NAME || "ecos",
      waitForConnections: true,
      connectionLimit: 10,
      charset: "utf8mb4",
    });
  }
  return pool;
}

// Helper to parse JSON fields from MySQL
export function parseJsonField<T>(value: unknown): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return (value ?? null) as T;
}
