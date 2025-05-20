// routes/notification-routes.js
import express from "express";
import {
    getUserNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
} from "../controllers/notification-controller.js";
import { authenticate } from "../middleware/auth-middleware.js";

const router = express.Router();

// Rutas protegidas
router.get("/users/me/notifications", authenticate, getUserNotifications);
router.patch("/notifications/:notificationId/read", authenticate, markNotificationAsRead); // PATCH es semánticamente mejor para marcar como leído
router.patch("/users/me/notifications/readall", authenticate, markAllNotificationsAsRead);

export default router;