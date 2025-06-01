import { getDbConnection } from "../config/database.js"; 
import { getTagsForComicId, mapComicData } from './comic-controller.js';

export const createUserList = async (req, res) => {
    const userId = req.user.id;
    const { list_name, list_type: clientListType } = req.body; // Renombrado para claridad

    const typeMapping = {
        pending: 'Cómics Pendientes',
        liked: 'Cómics Gustados'
    };

    if (!userId) {
        return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }
    if (!list_name || !clientListType) {
        return res.status(400).json({ success: false, message: "El nombre y el tipo de la lista son requeridos." });
    }

    const dbListType = typeMapping[clientListType]; // Mapear al valor de la BD

    if (!dbListType) { // Si clientListType no es 'pending' ni 'liked', dbListType será undefined
        return res.status(400).json({ success: false, message: "El tipo de lista debe ser 'pending' o 'liked'." });
    }

    try {
        const pool = getDbConnection();
        const [result] = await pool.query(
            "INSERT INTO user_lists (user_id, list_name, list_type) VALUES (?, ?, ?)",
            [userId, list_name, dbListType] // Usar el valor mapeado para la BD
        );
        const newListId = result.insertId;
        const [newListRows] = await pool.query("SELECT * FROM user_lists WHERE id = ?", [newListId]);

        res.status(201).json({ 
            success: true, 
            message: "Lista creada exitosamente.", 
            list: newListRows[0]
        });
    } catch (error) {
        console.error("Error creating user list:", error);
        if (error.code === 'ER_DUP_ENTRY') {
             return res.status(409).json({ success: false, message: "Ya tienes una lista de este tipo con el mismo nombre." });
        }
        res.status(500).json({ success: false, message: "Error al crear la lista." });
    }
};

export const getUserLists = async (req, res) => {
    const userId = req.user.id;
    const { type: clientListTypeFilter } = req.query; // Renombrado para claridad

    // Mapeo de los tipos de filtro del cliente a los valores ENUM de la base de datos
    const typeMapping = {
        pending: 'Cómics Pendientes',
        liked: 'Cómics Gustados'
    };

    let dbListTypeFilter = null; // Valor que se usará en la consulta SQL

    let query = "SELECT id, list_name, list_type, created_at, updated_at FROM user_lists WHERE user_id = ?";
    const queryParams = [userId];

    if (clientListTypeFilter) {
        if (clientListTypeFilter !== 'pending' && clientListTypeFilter !== 'liked') {
            return res.status(400).json({ success: false, message: "Tipo de filtro inválido. Usar 'pending' o 'liked'." });
        }
        dbListTypeFilter = typeMapping[clientListTypeFilter]; // Traducir al valor de la BD
        query += " AND list_type = ?";
        queryParams.push(dbListTypeFilter); // Usar el valor mapeado en la consulta
    }
    query += " ORDER BY list_name ASC";

    try {
        const pool = getDbConnection();
        // 1. Primero obtenemos las listas que coinciden con los filtros
        const [initialLists] = await pool.query(query, queryParams);

        if (initialLists.length === 0) {
            return res.status(200).json({ success: true, lists: [] }); // Devolver lista vacía si no hay resultados
        }

        // 2. Luego, para cada lista, obtenemos la cuenta de cómics
        const listsWithCounts = await Promise.all(initialLists.map(async (list) => {
            const [countResult] = await pool.query(
                "SELECT COUNT(*) as comic_count FROM user_list_comics WHERE list_id = ?", 
                [list.id]
            );
            return { ...list, comic_count: countResult[0]?.comic_count || 0 }; // Asegurar que comic_count sea 0 si no hay resultado
        }));

        res.status(200).json({ success: true, lists: listsWithCounts });
    } catch (error) {
        console.error("Error fetching user lists:", error);
        res.status(500).json({ success: false, message: "Error al obtener las listas." });
    }
};

export const getComicsInUserList = async (req, res) => {
    const userId = req.user.id;
    const { listId } = req.params;

    try {
        const pool = getDbConnection();
        const [listCheck] = await pool.query(
            "SELECT id, list_name, list_type FROM user_lists WHERE id = ? AND user_id = ?", // Verifica que la lista es del usuario
            [listId, userId]
        );
        if (listCheck.length === 0) {
            return res.status(404).json({ success: false, message: "Lista no encontrada o no tienes permiso para accederla." });
        }

        // Modifica esta consulta para que devuelva los cómics con el formato que necesitas,
        // incluyendo sus tags si es necesario, usando tus funciones getTagsForComicId y mapComicData.
        const [comicRows] = await pool.query(
            `SELECT c.id, c.nombre, c.editorial, c.familia, c.imagen_portada, c.ruta_pdf, c.coleccion, c.created_at,
                    (SELECT COUNT(*) FROM likes l WHERE l.comic_id = c.id) as likes_count,
                    (SELECT COUNT(*) FROM comentarios co WHERE co.comic_id = c.id) as comments_count
             FROM comics c
             JOIN user_list_comics ulc ON c.id = ulc.comic_id
             WHERE ulc.list_id = ?
             ORDER BY c.nombre ASC`, // O como prefieras ordenarlos
            [listId]
        );
        
        // Reutiliza tus funciones mapComicData y getTagsForComicId si el frontend espera esa estructura detallada
        const comicsWithDetails = await Promise.all(
            comicRows.map(async (comicRow) => {
                const tags = await getTagsForComicId(comicRow.id, pool); // Necesitas getTagsForComicId de comic-controller
                return mapComicData(comicRow, tags, comicRow.likes_count, comicRow.comments_count); // Necesitas mapComicData de comic-controller
            })
        );

        res.status(200).json({ 
            success: true, 
            list_info: listCheck[0], // Envía también la info de la lista
            comics: comicsWithDetails // Envía los cómics con todos sus detalles y tags
        });

    } catch (error) {
        console.error(`Error fetching comics in list ${listId}:`, error);
        res.status(500).json({ success: false, message: "Error al obtener los cómics de la lista." });
    }
};

// (Importa getTagsForComicId y mapComicData si están en otro archivo y no las redefines aquí)
// Si getTagsForComicId y mapComicData están en comic-controller.js, necesitarías exportarlas desde allí
// y luego importarlas en list-controller.js:
// import { getTagsForComicId, mapComicData } from './comic-controller.js';


export const addComicToUserList = async (req, res) => {
    const userId = req.user.id;
    const { listId } = req.params;
    const { comic_id } = req.body; // Esperamos el ID del cómic en el cuerpo

    if (!comic_id) {
        return res.status(400).json({ success: false, message: "El ID del cómic es requerido." });
    }

    try {
        const pool = getDbConnection();
        // Verificar que la lista pertenece al usuario y que el cómic existe
        const [listCheck] = await pool.query("SELECT id FROM user_lists WHERE id = ? AND user_id = ?", [listId, userId]);
        if (listCheck.length === 0) {
            return res.status(404).json({ success: false, message: "Lista no encontrada o no tienes permiso." });
        }
        const [comicCheck] = await pool.query("SELECT id FROM comics WHERE id = ?", [comic_id]);
        if (comicCheck.length === 0) {
            return res.status(404).json({ success: false, message: "Cómic no encontrado." });
        }

        await pool.query(
            "INSERT IGNORE INTO user_list_comics (list_id, comic_id) VALUES (?, ?)",
            [listId, comic_id]
        );
        res.status(200).json({ success: true, message: "Cómic añadido a la lista exitosamente." });
    } catch (error) {
        console.error(`Error adding comic ${comic_id} to list ${listId}:`, error);
         if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: "Este cómic ya está en la lista." });
        }
        res.status(500).json({ success: false, message: "Error al añadir el cómic a la lista." });
    }
};

export const removeComicFromUserList = async (req, res) => {
    const userId = req.user.id;
    const { listId, comicId } = req.params; // comicId viene de la URL

    try {
        const pool = getDbConnection();
        const [listCheck] = await pool.query("SELECT id FROM user_lists WHERE id = ? AND user_id = ?", [listId, userId]);
        if (listCheck.length === 0) {
            return res.status(404).json({ success: false, message: "Lista no encontrada o no tienes permiso." });
        }

        const [result] = await pool.query(
            "DELETE FROM user_list_comics WHERE list_id = ? AND comic_id = ?",
            [listId, comicId]
        );
        if (result.affectedRows === 0) {
            // Esto no es necesariamente un error si el cómic ya no estaba,
            // pero puedes notificarlo si quieres.
            return res.status(404).json({ success: false, message: "El cómic no se encontró en esta lista." });
        }
        res.status(200).json({ success: true, message: "Cómic eliminado de la lista exitosamente." });
    } catch (error) {
        console.error(`Error removing comic ${comicId} from list ${listId}:`, error);
        res.status(500).json({ success: false, message: "Error al eliminar el cómic de la lista." });
    }
};

// Funciones opcionales para actualizar y eliminar listas:
export const updateUserList = async (req, res) => {
    const userId = req.user.id;
    const { listId } = req.params;
    const { list_name, list_type } = req.body;

    if (!list_name && !list_type) {
        return res.status(400).json({ success: false, message: "Se requiere al menos un campo para actualizar (list_name o list_type)." });
    }
    if (list_type && list_type !== 'pending' && list_type !== 'liked') {
        return res.status(400).json({ success: false, message: "El tipo de lista debe ser 'pending' o 'liked'." });
    }
    
    // Construir la query de actualización dinámicamente
    let updateQuery = "UPDATE user_lists SET ";
    const updateParams = [];
    if (list_name) {
        updateQuery += "list_name = ?";
        updateParams.push(list_name);
    }
    if (list_type) {
        if (updateParams.length > 0) updateQuery += ", ";
        updateQuery += "list_type = ?";
        updateParams.push(list_type);
    }
    updateQuery += " WHERE id = ? AND user_id = ?";
    updateParams.push(listId, userId);

    try {
        const pool = getDbConnection();
        const [result] = await pool.query(updateQuery, updateParams);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Lista no encontrada, no pertenece al usuario, o no se realizaron cambios." });
        }
        const [updatedListRows] = await pool.query("SELECT * FROM user_lists WHERE id = ?", [listId]);
        res.status(200).json({ success: true, message: "Lista actualizada.", list: updatedListRows[0] });
    } catch (error) {
        console.error(`Error updating list ${listId}:`, error);
         if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, message: "Ya tienes otra lista de este tipo con ese nombre." });
        }
        res.status(500).json({ success: false, message: "Error al actualizar la lista." });
    }
};

export const deleteUserList = async (req, res) => {
    const userId = req.user.id;
    const { listId } = req.params;

    try {
        const pool = getDbConnection();
        // ON DELETE CASCADE en la tabla user_list_comics se encargará de borrar las asociaciones.
        // Primero verificamos que la lista pertenece al usuario.
        const [result] = await pool.query(
            "DELETE FROM user_lists WHERE id = ? AND user_id = ?",
            [listId, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Lista no encontrada o no tienes permiso." });
        }
        res.status(200).json({ success: true, message: "Lista eliminada exitosamente." });
    } catch (error) {
        console.error(`Error deleting list ${listId}:`, error);
        res.status(500).json({ success: false, message: "Error al eliminar la lista." });
    }
};