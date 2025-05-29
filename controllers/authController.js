const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const router = express.Router();

/**Controlador con las rutas del usuario, aquí es dónde podemos
registrarnos, logearnos y modificar los datos del*/ 

// Ruta de registro
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ error: "El usuario ya existe" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword
    });

    return res.status(201).json({
      message: "Usuario creado exitosamente",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error en el servidor" });
  }
});

// Ruta de login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    try {
        // Verificar si el usuario existe
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Verificar la contraseña
        const isPasswordValid = await bcrypt.compare(password, user.password); // Compara la contraseña cifrada

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        // Generar el token JWT
        const token = jwt.sign({ userId: user.id }, 'mi_clave_secreta', { expiresIn: '1h' });

        // Enviar la respuesta con el token y la información del usuario
        res.json({
            message: "Login exitoso",
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            },
            token
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Error en el servidor" });
    }
});

module.exports = router;