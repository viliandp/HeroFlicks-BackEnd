import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
// import fs from "fs"; // Ya no es necesario para la comprobación específica del PDF

// Importar Rutas existentes
import userRoutes from "./routes/user-routes.js";
import comicRoutes from "./routes/comic-routes.js";

// Importar NUEVAS Rutas
import tagRoutes from './routes/tag-routes.js';
import likeRoutes from './routes/like-routes.js';
import pendienteRoutes from './routes/pendiente-routes.js';
import commentRoutes from './routes/comment-routes.js';
import notificationRoutes from './routes/notification-routes.js';
import logroRoutes from './routes/logro-routes.js'; // Contiene todas las rutas de logros

// Importar conexión a DB
import { connectToDatabase, getDbConnection } from "./config/database.js"; // Asumo que connectToDatabase existe o la lógica está aquí

// Cargar las variables de entorno
dotenv.config();

// Inicializar la aplicación express
const app = express();
const PORT = process.env.PORT || 3007; // Cambiado a 3007 como mencionaste inicialmente
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS (configura según tus necesidades)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Si usas forms en algún momento

// --- Rutas Estáticas ---
// Servir archivos estáticos de la carpeta 'public/comics' bajo la ruta '/comics'
// ¡Importante! Coloca esto ANTES de las rutas API que puedan solaparse si tienes rutas como /api/comics/public/...
app.use("/comics", express.static(path.join(__dirname, "public/comics")));
// También podrías servir las imágenes de portada si están en public
app.use("/images", express.static(path.join(__dirname, "public/images"))); // Asumiendo que las imágenes están en public/images


// --- Rutas de la API ---
console.log("Registrando rutas API...");

app.use("/api/users", userRoutes);     // Rutas de usuarios (login, register, profile...)
app.use("/api/comics", comicRoutes);   // Rutas de cómics (CRUD, PDF, gestión de tags del cómic)
app.use("/api/tags", tagRoutes);       // Rutas para CRUD de Tags

// Rutas que operan sobre entidades específicas (likes, pendientes, etc.)
// Se montan en /api porque sus definiciones internas ya especifican /comics/:id/... o /users/me/...
app.use("/api", likeRoutes);
app.use("/api", pendienteRoutes);
app.use("/api", commentRoutes);
app.use("/api", notificationRoutes);

// Rutas para Logros
// '/api/logros' para el CRUD de definiciones de logros (GET /, POST /, PUT /:id, DELETE /:id)
// Y también '/api' para las rutas que actúan sobre usuarios (/users/me/logros, /award)
app.use("/api/logros", logroRoutes);   // Para GET /, POST / etc. de definiciones
app.use("/api", logroRoutes);        // Para /users/:userId/logros, /award etc.


// --- Rutas de Utilidad ---

// Health check route
app.get("/health", (req, res) => {
    console.log("Health check recibido");
    res.status(200).json({ status: "ok", message: "HeroFlicks API is running" });
});

// Ruta raíz simple
app.get("/", (req, res) => {
    res.send("Welcome to HeroFlicks API!");
});

// --- Manejo de Errores ---
// Middleware para manejar errores (debe ir al final)
app.use((err, req, res, next) => {
    console.error("Error en el servidor:", err); // Loguea el error completo
    // Evita mandar stack trace en producción
    const errorResponse = {
        success: false,
        message: err.message || "Something went wrong on the server",
        // Añade detalles específicos del error solo en desarrollo
        ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    };
    // Usa el status code del error si está disponible, sino 500
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json(errorResponse);
});


// --- Iniciar el Servidor ---
const startServer = async () => {
    try {
        console.log("Conectando a la base de datos...");
        // Conectar a la base de datos MySQL
        // Si `connectToDatabase` inicializa y configura el pool que usa `getDbConnection`, está bien.
        // Si solo prueba la conexión, asegúrate que `getDbConnection` funcione independientemente.
        await connectToDatabase(); // O asegúrate de que el pool se inicialice correctamente
        console.log("Conexión a la base de datos exitosa!");

        app.listen(PORT, () => {
            console.log(`🚀 HeroFlicks server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("❌ Error crítico al iniciar el servidor:", error);
        process.exit(1); // Salir si no se puede conectar a la DB u otro error crítico
    }
};

startServer();