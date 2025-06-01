// routes/comic-routes.js

import express from "express";
import {
  getAllComics,
  getComicById,
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
  searchAllComics,
  uploadComicWithMetadata, 
} from "../controllers/comic-controller.js";

// Importa el middleware de autenticación
import { authenticate } from '../middleware/auth-middleware.js'; // Asegúrate que la ruta al archivo sea correcta

// Importa la configuración de Multer
import { upload } from '../config/multer-config.js'; // <--- IMPORTAR CONFIGURACIÓN DE MULTER


const router = express.Router();

// --- Rutas para secciones especiales (Explore Screen y Personalizadas) ---
router.get("/most-liked", getMostLikedComicsController);
router.get("/most-commented", getMostCommentedComicsController);
router.get("/recently-added", getRecentlyAddedComicsController);
router.get("/for-you", authenticate, getComicsForYou);
router.get("/popular-by-tag", getPopularComicsByTagName);
router.get("/me/liked-comics-tags", authenticate, getUserLikedComicsTags);

// --- Rutas CRUD y generales para cómics ---
router.get("/", getAllComics);
router.get("/search", searchAllComics);

// --- NUEVA RUTA PARA SUBIR UN CÓMIC (PDF, imagen de portada y metadatos incl. tags) ---
router.post(
  "/upload",
  authenticate, // Middleware de autenticación
  upload.fields([ // Middleware de Multer para manejar los archivos
    { name: 'comicPdf', maxCount: 1 },     // Campo para el archivo PDF del cómic
    { name: 'comicImage', maxCount: 1 }  // Campo opcional para la imagen de portada
  ]),
  uploadComicWithMetadata // Controlador que procesará la subida, metadatos y tags
);

// --- Rutas específicas para un cómic por ID ---
router.get("/:id/pdf", getComicPdfById);
router.get("/:id", getComicById);

router.delete("/:id", authenticate, deleteComic);

// --- Rutas para gestionar etiquetas de un cómic (Protegidas con 'authenticate') ---
// Estas siguen siendo útiles para añadir/quitar etiquetas después de la creación
router.post("/:comicId/tags/:tagId", authenticate, addTagToComic);
router.delete("/:comicId/tags/:tagId", authenticate, removeTagFromComic);

export default router;