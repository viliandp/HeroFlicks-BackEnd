// routes/pendiente-routes.js
import express from "express";
import {
    addComicToPendientes,
    removeComicFromPendientes,
    getUserPendientesComics,
    getPendienteStatus
} from "../controllers/pendiente-controller.js";
import { authenticate } from "../middleware/auth-middleware.js";

const router = express.Router();

// Rutas protegidas
router.post("/comics/:comicId/pendientes", authenticate, addComicToPendientes);
router.delete("/comics/:comicId/pendientes", authenticate, removeComicFromPendientes);
router.get("/users/me/pendientes", authenticate, getUserPendientesComics);
router.get("/comics/:comicId/pendiente-status", authenticate, getPendienteStatus); // Estado para el usuario logueado

export default router;