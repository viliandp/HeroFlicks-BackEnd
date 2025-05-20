// routes/tag-routes.js
import express from "express";
import {
    getAllTags,
    getTagById,
    createTag,
    updateTag,
    deleteTag
} from "../controllers/tag-controller.js";
import { authenticate } from "../middleware/auth-middleware.js"; // Asumiendo que quieres proteger algunas

const router = express.Router();

router.get("/", getAllTags); // Pública
router.get("/:id", getTagById); // Pública

// Ejemplo: Proteger creación, actualización y borrado (podrías necesitar un middleware de admin)
// router.post("/", authenticate, /* isAdmin, */ createTag);
// router.put("/:id", authenticate, /* isAdmin, */ updateTag);
// router.delete("/:id", authenticate, /* isAdmin, */ deleteTag);

// --- Rutas sin protección para prueba ---
router.post("/", createTag);
router.put("/:id", updateTag);
router.delete("/:id", deleteTag);
// --- Fin rutas sin protección ---


export default router;