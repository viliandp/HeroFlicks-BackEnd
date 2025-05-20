// controllers/like-controller.js
import { getDbConnection } from "../config/database.js";

// Dar "like" a un cómic
export const likeComic = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id; // Obtenido del middleware authenticate
        const { comicId } = req.params;

        // Verificar que el cómic existe
        const [comicExists] = await pool.query("SELECT id FROM comics WHERE id = ?", [comicId]);
        if (comicExists.length === 0) {
            return res.status(404).json({ success: false, message: "Comic not found" });
        }

        // Intentar insertar, ignorar si ya existe el like
        await pool.query("INSERT IGNORE INTO likes (user_id, comic_id) VALUES (?, ?)", [userId, comicId]);

        res.status(200).json({ success: true, message: "Comic liked successfully" });

    } catch (error) {
        console.error(`Error liking comic ${req.params.comicId} by user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to like comic" });
    }
};

// Quitar "like" a un cómic
export const unlikeComic = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { comicId } = req.params;

        const [result] = await pool.query("DELETE FROM likes WHERE user_id = ? AND comic_id = ?", [userId, comicId]);

        // No es error si no existía el like, simplemente no se borró nada
        // if (result.affectedRows === 0) {
        //     return res.status(404).json({ success: false, message: "Like not found for this user and comic" });
        // }

        res.json({ success: true, message: "Comic unliked successfully" });

    } catch (error) {
        console.error(`Error unliking comic ${req.params.comicId} by user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to unlike comic" });
    }
};

// Obtener los cómics que le gustan a un usuario
export const getUserLikedComics = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;

        const [likedComics] = await pool.query(
            `SELECT c.id, c.nombre, c.editorial, c.familia, c.imagen_portada
             FROM comics c
             JOIN likes l ON c.id = l.comic_id
             WHERE l.user_id = ?`,
            [userId]
        );

        res.json(likedComics);

    } catch (error) {
        console.error(`Error fetching liked comics for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to retrieve liked comics" });
    }
};

// Obtener el estado de "like" de un usuario para un cómic específico
export const getLikeStatus = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { comicId } = req.params;

        const [like] = await pool.query("SELECT comic_id FROM likes WHERE user_id = ? AND comic_id = ?", [userId, comicId]);

        res.json({ liked: like.length > 0 });

    } catch (error) {
         console.error(`Error fetching like status for comic ${req.params.comicId} by user ${req.user.id}:`, error);
         res.status(500).json({ success: false, message: "Failed to retrieve like status" });
    }
};

// Obtener el número de likes de un cómic (público)
export const getComicLikeCount = async (req, res) => {
     try {
        const pool = getDbConnection();
        const { comicId } = req.params;

        const [countResult] = await pool.query("SELECT COUNT(*) as likeCount FROM likes WHERE comic_id = ?", [comicId]);

        res.json({ likeCount: countResult[0].likeCount || 0 });

    } catch (error) {
         console.error(`Error fetching like count for comic ${req.params.comicId}:`, error);
         res.status(500).json({ success: false, message: "Failed to retrieve like count" });
    }
};