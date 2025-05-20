// routes/logro-routes.js
import express from "express";
import {
    getAllLogros,
    createLogro,
    updateLogro,
    deleteLogro,
    adminAwardLogro, // Endpoint admin para otorgar
    getUserLogros
} from "../controllers/logro-controller.js";
import { authenticate } from "../middleware/auth-middleware.js";
// import { isAdmin } from "../middleware/admin-middleware.js"; // Necesitarías crear este middleware

const router = express.Router();

// CRUD de definiciones de logros (Requieren Admin)
// router.get("/", authenticate, isAdmin, getAllLogros); // O hacerla pública si quieres
router.get("/", getAllLogros); // Hacerla pública por ahora
// router.post("/", authenticate, isAdmin, createLogro);
// router.put("/:id", authenticate, isAdmin, updateLogro);
// router.delete("/:id", authenticate, isAdmin, deleteLogro);

// Rutas sin protección admin para prueba:
router.post("/", createLogro);
router.put("/:id", updateLogro);
router.delete("/:id", deleteLogro);
// Fin rutas sin protección admin

// Otorgar logro a usuario (Admin)
// router.post("/award", authenticate, isAdmin, adminAwardLogro);
// Ruta sin protección admin para prueba:
router.post("/award", adminAwardLogro);


// Obtener logros de usuario
router.get("/users/me/logros", authenticate, getUserLogros); // Logros del usuario autenticado
router.get("/users/:userId/logros", getUserLogros); // Logros de un usuario específico (público o admin?)

export default router;