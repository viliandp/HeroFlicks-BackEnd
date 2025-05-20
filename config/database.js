import mysql from "mysql2/promise"

// Database connection pool
let pool

export const connectToDatabase = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })

    // Test connection
    const connection = await pool.getConnection()
    console.log("Successfully connected to MySQL database")
    connection.release()

    // Create tables if they don't exist
    await initializeDatabase()

    return pool
  } catch (error) {
    console.error("Database connection failed:", error)
    throw error
  }
}

export const getDbConnection = () => {
  if (!pool) {
    throw new Error("Database connection not initialized")
  }
  return pool
}

// Initialize database tables
const initializeDatabase = async () => {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `

  try {
    await pool.query(createUsersTable)
    console.log("Database tables initialized")
  } catch (error) {
    console.error("Failed to initialize database tables:", error)
    throw error
  }
}

