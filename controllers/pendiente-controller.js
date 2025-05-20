// controllers/pendiente-controller.js
import { getDbConnection } from "../config/database.js";

// Añadir un cómic a la lista de pendientes
export const addComicToPendientes = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { comicId } = req.params;

        // Verificar que el cómic existe
        const [comicExists] = await pool.query("SELECT id FROM comics WHERE id = ?", [comicId]);
        if (comicExists.length === 0) {
            return res.status(404).json({ success: false, message: "Comic not found" });
        }

        // Intentar insertar, ignorar si ya está en pendientes
        await pool.query("INSERT IGNORE INTO pendientes (user_id, comic_id) VALUES (?, ?)", [userId, comicId]);

        res.status(200).json({ success: true, message: "Comic added to pendientes successfully" });

    } catch (error) {
        console.error(`Error adding comic ${req.params.comicId} to pendientes for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to add comic to pendientes" });
    }
};

// Quitar un cómic de la lista de pendientes
export const removeComicFromPendientes = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { comicId } = req.params;

        await pool.query("DELETE FROM pendientes WHERE user_id = ? AND comic_id = ?", [userId, comicId]);

        res.json({ success: true, message: "Comic removed from pendientes successfully" });

    } catch (error) {
        console.error(`Error removing comic ${req.params.comicId} from pendientes for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to remove comic from pendientes" });
    }
};

// Obtener la lista de cómics pendientes de un usuario
export const getUserPendientesComics = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;

        const [pendientesComics] = await pool.query(
            `SELECT c.id, c.nombre, c.editorial, c.familia, c.imagen_portada
             FROM comics c
             JOIN pendientes p ON c.id = p.comic_id
             WHERE p.user_id = ?`,
            [userId]
        );

        res.json(pendientesComics);

    } catch (error) {
        console.error(`Error fetching pendientes comics for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to retrieve pendientes comics" });
    }
};

// Obtener el estado de "pendiente" de un usuario para un cómic específico
export const getPendienteStatus = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { comicId } = req.params;

        const [pendiente] = await pool.query("SELECT comic_id FROM pendientes WHERE user_id = ? AND comic_id = ?", [userId, comicId]);

        res.json({ pendiente: pendiente.length > 0 });

    } catch (error) {
         console.error(`Error fetching pendiente status for comic ${req.params.comicId} by user ${req.user.id}:`, error);
         res.status(500).json({ success: false, message: "Failed to retrieve pendiente status" });
    }
};