// controllers/notification-controller.js
import { getDbConnection } from "../config/database.js";

// Obtener notificaciones del usuario (no leídas primero, luego leídas)
export const getUserNotifications = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { page = 1, limit = 15 } = req.query; // Paginación
        const offset = (page - 1) * limit;

        const [notifications] = await pool.query(
            `SELECT id, mensaje, leido, created_at
             FROM notificaciones
             WHERE user_id = ?
             ORDER BY leido ASC, created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, parseInt(limit), parseInt(offset)]
        );

        // Contar total para paginación
        const [totalResult] = await pool.query(
            "SELECT COUNT(*) as total FROM notificaciones WHERE user_id = ?",
            [userId]
        );
        const totalNotifications = totalResult[0].total;


        // Opcional: Contar no leídas
        const [unreadResult] = await pool.query(
            "SELECT COUNT(*) as unreadCount FROM notificaciones WHERE user_id = ? AND leido = FALSE",
            [userId]
        );
        const unreadCount = unreadResult[0].unreadCount;

        res.json({
            notifications,
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalNotifications / limit),
            totalNotifications,
            unreadCount
        });

    } catch (error) {
        console.error(`Error fetching notifications for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to retrieve notifications" });
    }
};

// Marcar una notificación como leída
export const markNotificationAsRead = async (req, res) => {
    try {
        const pool = getDbConnection();
        const userId = req.user.id;
        const { notificationId } = req.params;

        const [result] = await pool.query(
            "UPDATE notificaciones SET leido = TRUE WHERE id = ? AND user_id = ?",
            [notificationId, userId]
        );

        if (result.affectedRows === 0) {
            // Podría ser que no exista o que ya estuviera leída, o que no pertenezca al usuario
            return res.status(404).json({ success: false, message: "Notification not found or not owned by user" });
        }

        res.json({ success: true, message: "Notification marked as read" });

    } catch (error) {
        console.error(`Error marking notification ${req.params.notificationId} as read for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to mark notification as read" });
    }
};

// Marcar TODAS las notificaciones del usuario como leídas
export const markAllNotificationsAsRead = async (req, res) => {
     try {
        const pool = getDbConnection();
        const userId = req.user.id;

        await pool.query(
            "UPDATE notificaciones SET leido = TRUE WHERE user_id = ? AND leido = FALSE",
            [userId]
        );

        // No es necesario verificar affectedRows aquí, puede ser 0 si no había no leídas

        res.json({ success: true, message: "All unread notifications marked as read" });

    } catch (error) {
        console.error(`Error marking all notifications as read for user ${req.user.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to mark all notifications as read" });
    }
};

// --- Función interna para crear notificaciones (Ejemplo) ---
// No expondrías esto directamente como un endpoint POST público generalmente
export const createNotificationInternal = async (userId, message) => {
    try {
        const pool = getDbConnection();
        await pool.query("INSERT INTO notificaciones (user_id, mensaje) VALUES (?, ?)", [userId, message]);
        console.log(`Notification created for user ${userId}: ${message}`);
        // Aquí podrías añadir lógica de push notifications si la tuvieras
    } catch (error) {
        console.error(`Failed to create internal notification for user ${userId}:`, error);
        // Decide cómo manejar este error (log, reintentar, etc.)
    }
};