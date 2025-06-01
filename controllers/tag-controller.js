// controllers/tag-controller.js
import { getDbConnection } from "../config/database.js";

// Obtener todas las etiquetas
export const getAllTags = async (req, res) => {
    try {
        const pool = getDbConnection();
        const [tags] = await pool.query("SELECT * FROM tags ORDER BY nombre");
        res.json(tags);
    } catch (error) {
        console.error("Error in getAllTags:", error);
        res.status(500).json({ success: false, message: "Failed to retrieve tags" });
    }
};

// Obtener una etiqueta por ID
export const getTagById = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { id } = req.params;
        const [tag] = await pool.query("SELECT * FROM tags WHERE id = ?", [id]);

        if (tag.length === 0) {
            return res.status(404).json({ success: false, message: "Tag not found" });
        }
        res.json(tag[0]);
    } catch (error) {
        console.error(`Error in getTagById for ID ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to retrieve tag" });
    }
};

// Crear una nueva etiqueta (Potencialmente ruta protegida/admin)
export const createTag = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { nombre } = req.body;

        if (!nombre || nombre.trim() === "") { // Añadida validación para nombre vacío
            return res.status(400).json({ success: false, message: "Tag name is required and cannot be empty" });
        }

        let newTagId;
        try {
            const [result] = await pool.query("INSERT INTO tags (nombre) VALUES (?)", [nombre.trim()]);
            newTagId = result.insertId;
        } catch (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY') {
                // Si ya existe, podríamos recuperarla y devolverla como si se hubiera creado,
                // o simplemente devolver el error 409. Por ahora, devolvemos 409.
                return res.status(409).json({ success: false, message: "Tag name already exists" });
            }
            // Para otros errores de inserción, los relanzamos para que los capture el catch exterior.
            console.error("Error during INSERT in createTag:", insertError);
            return res.status(500).json({ success: false, message: "Database error during tag creation." });
        }

        // Si la inserción fue exitosa, obtener la etiqueta recién creada para devolverla
        if (newTagId) {
            const [newTagRows] = await pool.query("SELECT id, nombre FROM tags WHERE id = ?", [newTagId]);
            if (newTagRows.length > 0) {
                const newTag = newTagRows[0];
                res.status(201).json({
                    success: true,
                    message: "Tag created successfully",
                    tag: newTag // <-- ¡AQUÍ ESTÁ EL CAMBIO IMPORTANTE!
                });
            } else {
                // Esto sería muy raro si la inserción fue exitosa.
                console.error("Error in createTag: Newly inserted tag not found with ID:", newTagId);
                res.status(500).json({ success: false, message: "Failed to retrieve newly created tag." });
            }
        } else {
            // Esto también sería raro si no hubo error de inserción.
             console.error("Error in createTag: InsertId was not obtained after insert.");
            res.status(500).json({ success: false, message: "Failed to obtain ID for newly created tag." });
        }

    } catch (error) { // Catch general para errores no esperados
        console.error("Unexpected error in createTag:", error);
        res.status(500).json({ success: false, message: "Failed to create tag due to an unexpected server error" });
    }
};

// Actualizar una etiqueta (Potencialmente ruta protegida/admin)
export const updateTag = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { id } = req.params;
        const { nombre } = req.body;

        if (!nombre) {
            return res.status(400).json({ success: false, message: "Tag name is required" });
        }

        try {
            const [result] = await pool.query("UPDATE tags SET nombre = ? WHERE id = ?", [nombre, id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: "Tag not found or no changes made" });
            }
            res.json({ success: true, message: "Tag updated successfully" });
        } catch (updateError) {
            if (updateError.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: "Tag name already exists" });
            }
            throw updateError;
        }
    } catch (error) {
        console.error(`Error in updateTag for ID ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to update tag" });
    }
};

// Eliminar una etiqueta (Potencialmente ruta protegida/admin)
// Cuidado: ON DELETE CASCADE borrará las relaciones en comics_tags
export const deleteTag = async (req, res) => {
    try {
        const pool = getDbConnection();
        const { id } = req.params;

        const [result] = await pool.query("DELETE FROM tags WHERE id = ?", [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Tag not found" });
        }
        res.json({ success: true, message: "Tag deleted successfully" });
    } catch (error) {
        console.error(`Error in deleteTag for ID ${req.params.id}:`, error);
        res.status(500).json({ success: false, message: "Failed to delete tag" });
    }
};