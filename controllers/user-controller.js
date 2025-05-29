import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getDbConnection } from "../config/database.js";

// Register a new user
export const register = async (req, res) => {
  const { username, email, password } = req.body;

  // Validate input
  if (!username || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide username, email and password",
    });
  }

  try {
    const pool = getDbConnection();

    // Check if the specific combination of username AND email already exists
    const [existingUsers] = await pool.query(
      "SELECT * FROM users WHERE username = ? AND email = ?", // Cambiado de OR a AND
      [username, email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "La combinación de nombre de usuario y correo electrónico ya existe.",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user
    const [result] = await pool.query(
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword]
    );

    // Generate JWT token
    const token = jwt.sign({ id: result.insertId, username }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: result.insertId,
        username,
        email,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
};

// Login user
export const login = async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Please provide email and password",
    });
  }

  try {
    const pool = getDbConnection();

    // Find user by email
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials", // Se mantiene un mensaje genérico
      });
    }

    const user = users[0];

    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to login",
    });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const pool = getDbConnection();

    // Get user from database (excluding password)
    const [users] = await pool.query("SELECT id, username, email, created_at FROM users WHERE id = ?", [req.user.id]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user: users[0],
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user profile",
    });
  }
};

// Delete user account
export const deleteAccount = async (req, res) => {
  try {
    const pool = getDbConnection();

    // Delete user from database
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [req.user.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    console.error("Delete account error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};

// Update Username
export const updateUsername = async (req, res) => {
  const { username: newUsername, currentPassword } = req.body;
  const userId = req.user.id;

  if (!newUsername || !currentPassword) {
    return res.status(400).json({
      success: false,
      message: "El nuevo nombre de usuario y la contraseña actual son obligatorios.",
    });
  }

  try {
    const pool = getDbConnection();

    // 1. Verificar la contraseña actual y obtener el email actual
    const [currentUserDataRows] = await pool.query("SELECT email, password FROM users WHERE id = ?", [userId]);
    if (currentUserDataRows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    const currentUserData = currentUserDataRows[0];
    const isPasswordMatch = await bcrypt.compare(currentPassword, currentUserData.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: "La contraseña actual es incorrecta." });
    }

    // 2. Verificar si la nueva combinación de username Y el email actual del usuario ya existe para OTRO usuario
    const [existingCombinations] = await pool.query(
      "SELECT id FROM users WHERE username = ? AND email = ? AND id != ?",
      [newUsername, currentUserData.email, userId]
    );
    if (existingCombinations.length > 0) {
      return res.status(409).json({
        success: false,
        message: "La combinación de este nuevo nombre de usuario y tu correo actual ya existe para otra cuenta.",
      });
    }

    // 3. Actualizar el nombre de usuario
    const [result] = await pool.query(
      "UPDATE users SET username = ? WHERE id = ?",
      [newUsername, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado (al actualizar)." });
    }

    const [updatedUsers] = await pool.query(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [userId]
    );

    res.status(200).json({
      success: true,
      message: "Nombre de usuario actualizado exitosamente.",
      user: updatedUsers[0],
    });
  } catch (error) {
    console.error("Update username error:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar el nombre de usuario.",
    });
  }
};

// Update Email
export const updateEmail = async (req, res) => {
  const { email: newEmail, currentPassword } = req.body;
  const userId = req.user.id;

  if (!newEmail || !currentPassword) {
    return res.status(400).json({
      success: false,
      message: "El nuevo correo electrónico y la contraseña actual son obligatorios.",
    });
  }

  try {
    const pool = getDbConnection();

    // 1. Verificar la contraseña actual y obtener el username actual
    const [currentUserDataRows] = await pool.query("SELECT username, password FROM users WHERE id = ?", [userId]);
    if (currentUserDataRows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado." });
    }
    const currentUserData = currentUserDataRows[0];
    const isPasswordMatch = await bcrypt.compare(currentPassword, currentUserData.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ success: false, message: "La contraseña actual es incorrecta." });
    }

    // 2. Verificar si la nueva combinación de email Y el username actual del usuario ya existe para OTRO usuario
    const [existingCombinations] = await pool.query(
      "SELECT id FROM users WHERE username = ? AND email = ? AND id != ?",
      [currentUserData.username, newEmail, userId]
    );
    if (existingCombinations.length > 0) {
      return res.status(409).json({
        success: false,
        message: "La combinación de tu nombre de usuario y este nuevo correo electrónico ya existe para otra cuenta.",
      });
    }

    // 3. Actualizar el correo electrónico
    const [result] = await pool.query(
      "UPDATE users SET email = ? WHERE id = ?",
      [newEmail, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado (al actualizar)." });
    }
    
    const [updatedUsers] = await pool.query(
      "SELECT id, username, email, created_at FROM users WHERE id = ?",
      [userId]
    );

    res.status(200).json({
      success: true,
      message: "Correo electrónico actualizado exitosamente.",
      user: updatedUsers[0],
    });
  } catch (error) {
    console.error("Update email error:", error);
    res.status(500).json({
      success: false,
      message: "Error al actualizar el correo electrónico.",
    });
  }
};

// Change user password
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; 

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "La contraseña actual y la nueva contraseña son obligatorias.",
    });
  }

  if (newPassword.length < 6) { 
    return res.status(400).json({
        success: false,
        message: "La nueva contraseña debe tener al menos 6 caracteres."
    });
  }

  try {
    const pool = getDbConnection();
    const [users] = await pool.query("SELECT password FROM users WHERE id = ?", [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado.",
      });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "La contraseña actual es incorrecta.",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    const [result] = await pool.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedNewPassword,
      userId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(500).json({ // Podría ser 404 si el usuario desapareció entre verificaciones, pero 500 es seguro.
        success: false,
        message: "Error al actualizar la contraseña.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Contraseña actualizada exitosamente.",
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Error al cambiar la contraseña.",
    });
  }
};