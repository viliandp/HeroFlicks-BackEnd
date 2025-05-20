// routes/like-routes.js
import express from "express";
import {
    likeComic,
    unlikeComic,
    getUserLikedComics,
    getLikeStatus,
    getComicLikeCount
} from "../controllers/like-controller.js";
import { authenticate } from "../middleware/auth-middleware.js";

const router = express.Router();

// Rutas protegidas que requieren autenticación
router.post("/comics/:comicId/like", authenticate, likeComic);
router.delete("/comics/:comicId/like", authenticate, unlikeComic);
router.get("/users/me/likes", authenticate, getUserLikedComics);
router.get("/comics/:comicId/like-status", authenticate, getLikeStatus); // Estado para el usuario logueado

// Ruta pública para contar likes
router.get("/comics/:comicId/likes/count", getComicLikeCount);


export default router;