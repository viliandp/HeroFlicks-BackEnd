// list-routes.js
import express from 'express';
import { authenticate } from '../middleware/auth-middleware.js';
import { 
    createUserList, 
    getUserLists, 
    addComicToUserList, 
    getComicsInUserList,
    removeComicFromUserList,
    updateUserList, // Opcional: para cambiar nombre/tipo
    deleteUserList  // Opcional: para borrar una lista
} from '../controllers/list-controller.js'; // Crearemos este archivo

const router = express.Router();

// Rutas para las listas personalizadas del usuario autenticado
// El prefijo de la ruta base (ej. /api/lists) se definiría en tu archivo principal de la app (app.js o server.js)
// Aquí asumimos que estas rutas se montarían bajo algo como /api/users (ej. /api/users/me/lists) o /api/lists

// Crear una nueva lista (requiere autenticación)
router.post('/', authenticate, createUserList); 
// Ejemplo: POST /api/lists (si se monta así) o POST /api/users/me/lists

// Obtener todas las listas del usuario o filtrar por tipo (requiere autenticación)
router.get('/', authenticate, getUserLists); 
// Ejemplo: GET /api/lists  o GET /api/lists?type=pending

// Obtener los cómics de una lista específica (requiere autenticación)
router.get('/:listId/comics', authenticate, getComicsInUserList);

// Añadir un cómic a una lista específica (requiere autenticación)
router.post('/:listId/comics', authenticate, addComicToUserList);

// Quitar un cómic de una lista específica (requiere autenticación)
router.delete('/:listId/comics/:comicId', authenticate, removeComicFromUserList);

// (Opcional) Actualizar una lista (ej. cambiar nombre)
router.put('/:listId', authenticate, updateUserList);

// (Opcional) Eliminar una lista
router.delete('/:listId', authenticate, deleteUserList);


export default router;