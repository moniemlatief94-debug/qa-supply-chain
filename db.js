import mysql from "mysql2/promise";

if (!process.env.DATABASE_URL) {
  throw new Error("The managed database connection is not configured.");
}

// The platform DSN contains the TLS settings for its managed MySQL service.
export const pool = mysql.createPool(process.env.DATABASE_URL);

export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function closeDatabase() {
  await pool.end();
}
