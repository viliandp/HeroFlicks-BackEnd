import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { getDbConnection } from "../config/database.js"

// Register a new user
export const register = async (req, res) => {
  const { username, email, password } = req.body

  // Validate input
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide username, email and password",
    })
  }

  try {
    const pool = getDbConnection()

    // Check if user already exists
    const [existingUsers] = await pool.query("SELECT * FROM users WHERE username = ? OR email = ?", [username, email])

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username or email already exists",
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Insert new user
    const [result] = await pool.query("INSERT INTO users (username, email, password) VALUES (?, ?, ?)", [
      username,
      email,
      hashedPassword,
    ])

    // Generate JWT token
    const token = jwt.sign({ id: result.insertId, username }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: result.insertId,
        username,
        email,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to register user",
    })
  }
}

// Login user
export const login = async (req, res) => {
  const { email, password } = req.body

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide email and password",
    })
  }

  try {
    const pool = getDbConnection()

    // Find user by email
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email])

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    const user = users[0]

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to login",
    })
  }
}

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const pool = getDbConnection()

    // Get user from database (excluding password)
    const [users] = await pool.query("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.user.id])

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      user: users[0],
    })
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
    })
  }
}

// Delete user account
export const deleteAccount = async (req, res) => {
  try {
    const pool = getDbConnection()

    // Delete user from database
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [req.user.id])

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    })
  } catch (error) {
    console.error("Delete account error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to delete account",
    })
  }
}

