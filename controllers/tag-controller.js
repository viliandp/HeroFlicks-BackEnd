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

        if (!nombre) {
            return res.status(400).json({ success: false, message: "Tag name is required" });
        }

        // Verificar si ya existe (por la constraint UNIQUE)
        try {
            const [result] = await pool.query("INSERT INTO tags (nombre) VALUES (?)", [nombre]);
            res.status(201).json({ success: true, message: "Tag created successfully", tagId: result.insertId });
        } catch (insertError) {
            if (insertError.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ success: false, message: "Tag name already exists" });
            }
            throw insertError; // Re-lanzar otros errores de inserción
        }
    } catch (error) {
        console.error("Error in createTag:", error);
        res.status(500).json({ success: false, message: "Failed to create tag" });
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