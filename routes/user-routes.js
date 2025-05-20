import express from "express"
import { register, login, getProfile, deleteAccount } from "../controllers/user-controller.js"
import { authenticate } from "../middleware/auth-middleware.js"

const router = express.Router()

// Public routes
router.post("/register", register)
router.post("/login", login)

// Protected routes
router.get("/profile", authenticate, getProfile)
router.delete("/account", authenticate, deleteAccount)

export default router

