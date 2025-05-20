// routes/comic-routes.js

import express from "express";
import {
  getAllComics,
  getComicById,
  createComic,
  updateComic,
  deleteComic,
  getComicPdfById,
  addTagToComic,
  removeTagFromComic,
  getMostLikedComicsController,
  getMostCommentedComicsController,
  getRecentlyAddedComicsController,
  getComicsForYou,
  getPopularComicsByTagName,
  getUserLikedComicsTags,
  searchAllComics
} from "../controllers/comic-controller.js";

// Importa directamente la función 'authenticate' de tu middleware
import { authenticate } from '../middleware/auth-middleware.js'; // Asegúrate que la ruta al archivo sea correcta

const router = express.Router();

// --- Rutas para secciones especiales (Explore Screen y Personalizadas) ---
router.get("/most-liked", getMostLikedComicsController);
router.get("/most-commented", getMostCommentedComicsController);
router.get("/recently-added", getRecentlyAddedComicsController);

// --- NUEVA RUTA: Sección "Para Ti" (Requiere autenticación) ---
// Usa 'authenticate' directamente
router.get("/for-you", authenticate, getComicsForYou);

// --- NUEVA RUTA: Cómics populares por nombre de etiqueta ---
router.get("/popular-by-tag", getPopularComicsByTagName);

router.get("/me/liked-comics-tags", authenticate, getUserLikedComicsTags);
// --- Rutas CRUD y generales para cómics ---
router.get("/", getAllComics);
router.get("/search", searchAllComics);
// --- Rutas específicas para un cómic por ID ---
router.get("/:id/pdf", getComicPdfById);
router.get("/:id", getComicById);

// --- Rutas de Modificación (Protegidas con 'authenticate') ---
// Para crear, editar o borrar, generalmente se requiere autenticación.
// Puedes añadir isAdmin si tienes esa lógica también.
router.post("/", authenticate, createComic);
router.put("/:id", authenticate, updateComic);
router.delete("/:id", authenticate, deleteComic);

// --- Rutas para gestionar etiquetas de un cómic (Protegidas con 'authenticate') ---
router.post("/:comicId/tags/:tagId", authenticate, addTagToComic);
router.delete("/:comicId/tags/:tagId", authenticate, removeTagFromComic);

export default router;