import jwt from "jsonwebtoken"
import { getDbConnection } from "../config/database.js"

export const authenticate = async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required. No token provided.",
    })
  }

  const token = authHeader.split(" ")[1]

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Check if user still exists
    const pool = getDbConnection()
    const [users] = await pool.query("SELECT id, username FROM users WHERE id = ?", [decoded.id])

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      })
    }

    // Add user to request object
    req.user = {
      id: decoded.id,
      username: decoded.username,
    }

    next()
  } catch (error) {
    console.error("Authentication error:", error)
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    })
  }
}

