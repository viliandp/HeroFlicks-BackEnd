// controllers/logro-controller.js
import { getDbConnection } from "../config/database.js";
import { createNotificationInternal } from "./notification-controller.js"; // Importar si quieres notificar

// Obtener todos los logros
export const getAllLogros = async (req, res) => {
    try {
        const pool = getDbConnection();
        const [logros] = await pool.query("SELECT * FROM logros ORDER BY nombre");
        res.json(logros);
    } catch (error) {
        console.error("Error in getAllLogros:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve logros" });
    }
};

// Crear un nuevo logro (Admin)
export const createLogro = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { nombre, descripcion } = req.body;

        if (!nombre || !descripcion) {
            return res.status(400).json({ success: false, message: "Logro name and description are required" });
        }

        try {
            const [result] = await pool.query("INSERT INTO logros (nombre, descripcion) VALUES (?, ?)", [nombre, descripcion]);
            res.status(201).json({ success: true, message: "Logro created successfully", logroId: result.insertId });
        } catch (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: "Logro name already exists" });
            }
            throw insertError;
        }
    } catch (error) {
        console.error("Error in createLogro:", error);
        res.status(500).json({ success: false, message: "Failed to create logro" });
    }
};

// Actualizar un logro (Admin)
export const updateLogro = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { id } = req.params;
        const { nombre, descripcion } = req.body;

        if (!nombre || !descripcion) {
            return res.status(400).json({ success: false, message: "Logro name and description are required" });
        }

        try {
            const [result] = await pool.query("UPDATE logros SET nombre = ?, descripcion = ? WHERE id = ?", [nombre, descripcion, id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Logro not found or no changes made" });
            }
            res.json({ success: true, message: "Logro updated successfully" });
        } catch (updateError) {
             if (updateError.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: "Logro name already exists" });
            }
            throw updateError;
        }
    } catch (error) {
        console.error(`Error in updateLogro for ID ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to update logro" });
    }
};

// Eliminar un logro (Admin)
// Cuidado: ON DELETE CASCADE borrará las relaciones en usuarios_logros
export const deleteLogro = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { id } = req.params;

        const [result] = await pool.query("DELETE FROM logros WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Logro not found" });
        }
        res.json({ success: true, message: "Logro deleted successfully" });
    } catch (error) {
        console.error(`Error in deleteLogro for ID ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to delete logro" });
    }
};

// --- Gestión de Logros de Usuario ---

// Otorgar un logro a un usuario (Interno o Admin)
// Podría llamarse desde otras partes del código (ej: al leer X cómics)
// O desde un endpoint admin
export const awardLogroToUser = async (userId, logroId) => {
    try {
        const pool = getDbConnection();

        // Verificar que existen
        const [userExists] = await pool.query("SELECT id FROM users WHERE id = ?", [userId]);
        const [logroExists] = await pool.query("SELECT id, nombre FROM logros WHERE id = ?", [logroId]); // Obtener nombre para notificación

        if (userExists.length === 0 || logroExists.length === 0) {
            console.error(`Cannot award logro: User ${userId} or Logro ${logroId} not found.`);
            return false; // Indicar fallo
        }

        // Intentar insertar, ignorar si ya lo tiene
        const [result] = await pool.query("INSERT IGNORE INTO usuarios_logros (user_id, logro_id) VALUES (?, ?)", [userId, logroId]);

        // Si se insertó una nueva fila (affectedRows=1), el logro es nuevo para el usuario
        if (result.affectedRows === 1) {
            console.log(`Logro ${logroId} awarded to user ${userId}`);
            // Crear notificación (si se quiere)
            const logroName = logroExists[0].nombre;
            await createNotificationInternal(userId, `¡Has desbloqueado el logro: ${logroName}!`);
            return true; // Indicar éxito
        } else {
            console.log(`User ${userId} already has logro ${logroId}.`);
            return false; // Indicar que ya lo tenía (no es un error)
        }

    } catch (error) {
        console.error(`Error awarding logro ${logroId} to user ${userId}:`, error);
        return false; // Indicar fallo
    }
};

// Endpoint para que un ADMIN otorgue un logro (Ejemplo)
export const adminAwardLogro = async (req, res) => {
     // Aquí necesitarías un middleware que verifique si req.user es admin
    // if (!req.user.isAdmin) return res.status(403).json({...});

    const { userId, logroId } = req.body;
    if (!userId || !logroId) {
        return res.status(400).json({ success: false, message: "userId and logroId are required" });
    }

    const success = await awardLogroToUser(userId, logroId);

    if (success) {
        res.status(200).json({ success: true, message: "Logro awarded successfully (if not already possessed)" });
    } else {
        // Podría ser error o que ya lo tenía, la función awardLogroToUser ya loguea detalles
         res.status(409).json({ success: false, message: "Failed to award logro or user already possessed it. Check server logs." });
    }
};


// Obtener los logros de un usuario (el propio usuario o público/admin)
export const getUserLogros = async (req, res) => {
    try {
        const pool = getDbConnection();
        // Puede ser el ID del usuario logueado o uno de los params si es endpoint público/admin
        const userId = req.params.userId || req.user.id; // Asume que si no hay param, es 'me'

        // Validar que el usuario existe (si se obtiene de params)
        if (req.params.userId) {
             const [userExists] = await pool.query("SELECT id FROM users WHERE id = ?", [userId]);
             if (userExists.length === 0) {
                 return res.status(404).json({ success: false, message: "User not found" });
             }
        } else if (!userId) {
             // Si no hay req.user.id (no autenticado y no se pidió userId específico)
             return res.status(401).json({ success: false, message: "Authentication required or userId parameter missing" });
        }


        const [logros] = await pool.query(
            `SELECT l.id, l.nombre, l.descripcion, ul.fecha
             FROM logros l
             JOIN usuarios_logros ul ON l.id = ul.logro_id
             WHERE ul.user_id = ?
             ORDER BY ul.fecha DESC`,
            [userId]
        );

        res.json(logros);

    } catch (error) {
        const targetUserId = req.params.userId || req.user?.id; // Para el log
        console.error(`Error fetching logros for user ${targetUserId}:`, error);
        res.status(500).json({ success: false, message: "Failed to retrieve user logros" });
    }
};