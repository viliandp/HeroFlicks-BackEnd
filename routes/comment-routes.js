// routes/comment-routes.js
import express from "express";
import {
    addComment,
    getComicComments,
    updateComment,
    deleteComment,
    getComicAverageRating
} from "../controllers/comment-controller.js";
import { authenticate } from "../middleware/auth-middleware.js";

const router = express.Router();

// Obtener comentarios y calificación promedio (público)
router.get("/comics/:comicId/comments", getComicComments);
router.get("/comics/:comicId/rating", getComicAverageRating);

// Añadir, modificar, eliminar comentarios (protegido)
router.post("/comics/:comicId/comments", authenticate, addComment);
router.put("/comments/:commentId", authenticate, updateComment);
router.delete("/comments/:commentId", authenticate, deleteComment);

export default router;