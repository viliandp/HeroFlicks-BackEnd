// controllers/comment-controller.js
import { getDbConnection } from "../config/database.js";

// Añadir un comentario/calificación a un cómic
export const addComment = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { comicId } = req.params;
        const { comentario, calificacion } = req.body;

        if (!comentario) {
            return res.status(400).json({ success: false, message: "Comment text is required" });
        }
        // Validación de calificación (opcional si la DB ya tiene CHECK)
        if (calificacion !== undefined && (calificacion < 1 || calificacion > 5)) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
        }

        // Verificar que el cómic existe
        const [comicExists] = await pool.query("SELECT id FROM comics WHERE id = ?", [comicId]);
        if (comicExists.length === 0) {
            return res.status(404).json({ success: false, message: "Comic not found" });
        }

        // Insertar comentario
        const [result] = await pool.query(
            "INSERT INTO comentarios (user_id, comic_id, comentario, calificacion) VALUES (?, ?, ?, ?)",
            [userId, comicId, comentario, calificacion]
        );

        // Devolver el comentario creado (opcional)
        const [newComment] = await pool.query(
             `SELECT c.*, u.username
              FROM comentarios c
              JOIN users u ON c.user_id = u.id
              WHERE c.id = ?`,
             [result.insertId]
        );

        res.status(201).json({ success: true, message: "Comment added successfully", comment: newComment[0] });

    } catch (error) {
        console.error(`Error adding comment to comic ${req.params.comicId} by user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to add comment" });
    }
};

// Obtener comentarios de un cómic (con info del usuario)
export const getComicComments = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { comicId } = req.params;
        const { page = 1, limit = 10 } = req.query; // Paginación simple
        const offset = (page - 1) * limit;

        const [comments] = await pool.query(
            `SELECT c.id, c.comentario, c.calificacion, c.created_at, c.user_id, u.username
             FROM comentarios c
             JOIN users u ON c.user_id = u.id
             WHERE c.comic_id = ?
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [comicId, parseInt(limit), parseInt(offset)]
        );

        // Obtener total para paginación
         const [totalResult] = await pool.query(
            "SELECT COUNT(*) as total FROM comentarios WHERE comic_id = ?",
            [comicId]
        );
        const totalComments = totalResult[0].total;

        res.json({
            comments,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalComments / limit),
            totalComments
        });

    } catch (error) {
        console.error(`Error fetching comments for comic ${req.params.comicId}:`, error);
        res.status(500).json({ success: false, message: "Failed to retrieve comments" });
    }
};

// Actualizar un comentario (solo el propio usuario o admin)
export const updateComment = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { commentId } = req.params;
        const { comentario, calificacion } = req.body; // Solo permitir actualizar estos

        if (!comentario) {
            return res.status(400).json({ success: false, message: "Comment text is required" });
        }
        if (calificacion !== undefined && (calificacion < 1 || calificacion > 5)) {
            return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
        }

        // Verificar que el comentario existe y pertenece al usuario
        const [commentData] = await pool.query("SELECT user_id FROM comentarios WHERE id = ?", [commentId]);
        if (commentData.length === 0) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (commentData[0].user_id !== userId /* && !req.user.isAdmin */) { // Añadir lógica de admin si es necesario
            return res.status(403).json({ success: false, message: "Forbidden: You can only update your own comments" });
        }

        // Actualizar
        const [result] = await pool.query(
            "UPDATE comentarios SET comentario = ?, calificacion = ? WHERE id = ?",
            [comentario, calificacion, commentId]
        );

         if (result.affectedRows === 0) {
             // Esto no debería pasar si la verificación anterior fue correcta
             return res.status(404).json({ success: false, message: "Comment not found or no changes made" });
         }

        res.json({ success: true, message: "Comment updated successfully" });

    } catch (error) {
        console.error(`Error updating comment ${req.params.commentId} by user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to update comment" });
    }
};

// Eliminar un comentario (solo el propio usuario o admin)
export const deleteComment = async (req, res) => {
     try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { commentId } = req.params;

        // Verificar que el comentario existe y pertenece al usuario
        const [commentData] = await pool.query("SELECT user_id FROM comentarios WHERE id = ?", [commentId]);
        if (commentData.length === 0) {
            return res.status(404).json({ success: false, message: "Comment not found" });
        }
        if (commentData[0].user_id !== userId /* && !req.user.isAdmin */) {
            return res.status(403).json({ success: false, message: "Forbidden: You can only delete your own comments" });
        }

        // Eliminar
        const [result] = await pool.query("DELETE FROM comentarios WHERE id = ?", [commentId]);

         if (result.affectedRows === 0) {
             return res.status(404).json({ success: false, message: "Comment not found" });
         }

        res.json({ success: true, message: "Comment deleted successfully" });

    } catch (error) {
        console.error(`Error deleting comment ${req.params.commentId} by user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to delete comment" });
    }
};

// Calcular calificación promedio de un cómic (público)
export const getComicAverageRating = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { comicId } = req.params;

        const [ratingResult] = await pool.query(
            "SELECT AVG(calificacion) as averageRating, COUNT(calificacion) as ratingCount FROM comentarios WHERE comic_id = ? AND calificacion IS NOT NULL",
            [comicId]
        );

        res.json({
            averageRating: ratingResult[0].averageRating ? parseFloat(ratingResult[0].averageRating.toFixed(1)) : null, // Redondear a 1 decimal
            ratingCount: ratingResult[0].ratingCount || 0
        });

    } catch (error) {
        console.error(`Error calculating average rating for comic ${req.params.comicId}:`, error);
        res.status(500).json({ success: false, message: "Failed to calculate average rating" });
    }
};