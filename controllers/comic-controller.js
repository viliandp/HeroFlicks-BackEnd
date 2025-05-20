// controllers/comic-controller.js

import fs from 'fs';
import path from 'path';
import { getDbConnection } from "../config/database.js";

// --- FUNCIÓN AUXILIAR PARA OBTENER TAGS (REUTILIZABLE) ---
const getTagsForComicId = async (comicId, pool) => {
  try {
    const [tags] = await pool.query(
      `SELECT t.id, t.nombre 
       FROM tags t
       JOIN comics_tags ct ON t.id = ct.tag_id
       WHERE ct.comic_id = ? 
       ORDER BY t.nombre ASC`, // Opcional: ordenar tags alfabéticamente
      [comicId]
    );
    // Mapear para que coincida con la estructura de la data class de Kotlin (id, name)
    return tags.map(tag => ({ id: tag.id, name: tag.nombre }));
  } catch (error) {
    console.error(`Error fetching tags for comic_id ${comicId}:`, error);
    return []; // Devolver array vacío en caso de error para no romper el flujo principal
  }
};

// --- FUNCIÓN AUXILIAR PARA MAPEAR EL RESULTADO DEL CÓMIC A LA ESTRUCTURA DESEADA ---
const mapComicData = (comicRow, tags = [], likesCount = 0, commentsCount = 0) => {
  return {
    id: comicRow.id.toString(),
    title: comicRow.nombre,
    editorial: comicRow.editorial,
    pdfPath: comicRow.ruta_pdf,
    isCollection: !!comicRow.coleccion,
    family: comicRow.familia,
    imageUrl: comicRow.imagen_portada,
    createdAt: comicRow.created_at ? new Date(comicRow.created_at).toISOString() : null,
    likesCount: parseInt(likesCount) || 0,
    commentsCount: parseInt(commentsCount) || 0,
    tags: tags, // ¡Aquí es donde se asignan los tags!
  };
};

// --- CONTROLLERS ---

// Obtener todos los cómics (JSON)
export const getAllComics = async (req, res) => {
  try {
    const pool = getDbConnection();
    let baseQuery = `
        SELECT 
            c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at,
            (SELECT COUNT(*) FROM likes l WHERE l.comic_id = c.id) as likes_count,
            (SELECT COUNT(*) FROM comentarios co WHERE co.comic_id = c.id) as comments_count
        FROM comics c
    `;

    // Lógica para filtrar por tag si se proporciona el query param 'tag' o 'tagName'
    const { tag: tagName } = req.query;
    const queryParams = [];

    if (tagName) {
      // Necesitamos encontrar el tagId basado en el nombre del tag
      const [tagResult] = await pool.query("SELECT id FROM tags WHERE nombre = ?", [tagName]);
      if (tagResult.length > 0) {
        const tagId = tagResult[0].id;
        baseQuery += ` JOIN comics_tags ct ON c.id = ct.comic_id WHERE ct.tag_id = ?`;
        queryParams.push(tagId);
      } else {
        // Si el tag no existe, devolver una lista vacía de cómics
        return res.status(200).json({ success: true, comics: [] });
      }
    }

    baseQuery += " ORDER BY c.nombre ASC"; // O el orden que prefieras para la lista general
    // Podrías añadir paginación aquí si lo necesitas

    const [comicsRows] = await pool.query(baseQuery, queryParams);

    const comicsWithDetails = await Promise.all(
      comicsRows.map(async (comicRow) => {
        const tags = await getTagsForComicId(comicRow.id, pool);
        // Los counts ya vienen de la query principal si se usan subconsultas, o se recalculan
        // En este caso, likes_count y comments_count vienen de las subconsultas en baseQuery
        return mapComicData(comicRow, tags, comicRow.likes_count, comicRow.comments_count);
      })
    );

    res.status(200).json({ success: true, comics: comicsWithDetails });
  } catch (error) {
    console.error("Error in getAllComics:", error);
    res.status(500).json({ success: false, message: "Failed to retrieve comics", error: error.message });
  }
};

// Obtener un cómic por ID (JSON)
export const getComicById = async (req, res) => {
  try {
    const pool = getDbConnection();
    const { id } = req.params;

    const [comicResult] = await pool.query(
      "SELECT id, nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada, created_at FROM comics WHERE id = ?",
      [id]
    );
    
    if (comicResult.length === 0) {
      return res.status(404).json({ success: false, message: "Comic not found" });
    }

    const comicRow = comicResult[0];
    const tags = await getTagsForComicId(id, pool); // Obtener los tags

    const [likesResult] = await pool.query("SELECT COUNT(*) as count FROM likes WHERE comic_id = ?", [id]);
    const likesCount = likesResult[0]?.count || 0;

    const [commentsResult] = await pool.query("SELECT COUNT(*) as count FROM comentarios WHERE comic_id = ?", [id]);
    const commentsCount = commentsResult[0]?.count || 0;

    const comicData = mapComicData(comicRow, tags, likesCount, commentsCount); // Pasar los tags

    res.status(200).json({ success: true, comic: comicData });
  } catch (error) {
    console.error(`Error in getComicById for ID ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: "Failed to retrieve comic details", error: error.message });
  }
};

// Obtener el archivo PDF de un cómic por ID (Sirve el archivo)
export const getComicPdfById = async (req, res) => {
  try {
    const pool = getDbConnection();
    const { id } = req.params;
    const [comicData] = await pool.query("SELECT ruta_pdf, nombre FROM comics WHERE id = ?", [id]);

    if (comicData.length === 0) {
      return res.status(404).json({ success: false, message: "Comic not found (for PDF)" });
    }
    const relativePdfPath = comicData[0].ruta_pdf;
    const comicName = comicData[0].nombre || `comic_${id}`;
    if (!relativePdfPath) {
      console.error(`PDF path is null or empty for comic ID: ${id}`);
      return res.status(404).json({ success: false, message: "PDF path not defined for this comic" });
    }
    const absolutePdfPath = path.resolve(process.cwd(), relativePdfPath);
    console.log(`Attempting to serve PDF from absolute path: ${absolutePdfPath}`);
    if (!fs.existsSync(absolutePdfPath)) {
      console.error(`File not found at resolved absolute path: ${absolutePdfPath} (relative was: ${relativePdfPath}) for comic ID: ${id}`);
      return res.status(404).json({ success: false, message: "PDF file not found on server at expected location" });
    }
    const fileName = path.basename(absolutePdfPath) || `${comicName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.sendFile(absolutePdfPath, (err) => {
      if (err) {
        console.error(`Error sending PDF file (${fileName}) for comic ID ${id}:`, err);
        if (!res.headersSent) {
          if (err.code === 'ENOENT') {
            res.status(404).json({ success: false, message: "PDF file disappeared before sending" });
          } else {
            res.status(500).json({ success: false, message: "Error sending PDF file" });
          }
        }
      } else {
        console.log(`Successfully sent PDF: ${fileName} for comic ID: ${id}`);
      }
    });
  } catch (error) {
    console.error(`Error in getComicPdfById for ID ${req.params.id}:`, error);
    if (!res.headersSent) {
      const errorMessage = process.env.NODE_ENV !== 'production' ? error.message : "Failed to process PDF request";
      res.status(500).json({ success: false, error: errorMessage });
    }
  }
};

// Crear un nuevo cómic
export const createComic = async (req, res) => {
  // ... (código de createComic se mantiene igual, los tags se añadirían con addTagToComic por separado)
  try {
    const pool = getDbConnection();
    const { nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada } = req.body;
    if (!nombre || !editorial || !ruta_pdf || typeof coleccion !== 'boolean' || !familia || !imagen_portada) {
      return res.status(400).json({ success: false, message: "Missing or invalid required fields. Ensure 'coleccion' is a boolean." });
    }
    const [result] = await pool.query(
      `INSERT INTO comics (nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada) VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada]
    );
    const [newComicRows] = await pool.query("SELECT * FROM comics WHERE id = ?", [result.insertId]);
    if (newComicRows.length === 0) {
        return res.status(500).json({ success: false, message: "Failed to retrieve newly created comic."});
    }
    // El nuevo cómic no tendrá tags hasta que se añadan explícitamente.
    // Likes y comments serán 0.
    res.status(201).json({ success: true, message: "Comic created successfully", comic: mapComicData(newComicRows[0], []) });
  } catch (error) {
    console.error("Error in createComic:", error);
    res.status(500).json({ success: false, message: "Failed to create comic", error: error.message });
  }
};

// Actualizar un cómic
export const updateComic = async (req, res) => {
  // ... (código de updateComic se mantiene igual, los tags se actualizan con add/removeTagToComic)
  try {
    const pool = getDbConnection();
    const { id } = req.params;
    const { nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada } = req.body;
    if (!nombre || !editorial || !ruta_pdf || typeof coleccion !== 'boolean' || !familia || !imagen_portada) {
      return res.status(400).json({ success: false, message: "Missing or invalid required fields. Ensure 'coleccion' is a boolean." });
    }
    const [result] = await pool.query(
      `UPDATE comics SET nombre = ?, editorial = ?, ruta_pdf = ?, coleccion = ?, familia = ?, imagen_portada = ? WHERE id = ?`,
      [nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Comic not found or no changes made" });
    }
    const [updatedComicRows] = await pool.query("SELECT * FROM comics WHERE id = ?", [id]);
     if (updatedComicRows.length === 0) {
        return res.status(404).json({ success: false, message: "Failed to retrieve updated comic."});
    }
    const tags = await getTagsForComicId(id, pool); // Obtener tags actuales
    const [likesResult] = await pool.query("SELECT COUNT(*) as count FROM likes WHERE comic_id = ?", [id]);
    const likesCount = likesResult[0]?.count || 0;
    const [commentsResult] = await pool.query("SELECT COUNT(*) as count FROM comentarios WHERE comic_id = ?", [id]);
    const commentsCount = commentsResult[0]?.count || 0;

    res.status(200).json({ success: true, message: "Comic updated successfully", comic: mapComicData(updatedComicRows[0], tags, likesCount, commentsCount) });
  } catch (error) {
    console.error(`Error in updateComic for ID ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: "Failed to update comic", error: error.message });
  }
};

// Eliminar un cómic
export const deleteComic = async (req, res) => {
  // ... (código de deleteComic se mantiene igual)
  try {
    const pool = getDbConnection();
    const { id } = req.params;
    // Las relaciones en comics_tags se borrarán por ON DELETE CASCADE
    const [result] = await pool.query("DELETE FROM comics WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Comic not found" });
    }
    res.status(200).json({ success: true, message: "Comic deleted successfully" });
  } catch (error) {
    console.error(`Error in deleteComic for ID ${req.params.id}:`, error);
    res.status(500).json({ success: false, message: "Failed to delete comic", error: error.message });
  }
};

// --- Las funciones addTagToComic y removeTagFromComic ---
// Estas funciones son para la relación comic-tag, se mantienen como las tenías
// ya que las importas en comic-routes.js
export const addTagToComic = async (req, res) => {
  try {
    const pool = getDbConnection();
    const { comicId, tagId } = req.params;
    const [comicExists] = await pool.query("SELECT id FROM comics WHERE id = ?", [comicId]);
    const [tagExists] = await pool.query("SELECT id FROM tags WHERE id = ?", [tagId]);
    if (comicExists.length === 0 || tagExists.length === 0) {
      return res.status(404).json({ success: false, message: "Comic or Tag not found" });
    }
    await pool.query("INSERT IGNORE INTO comics_tags (comic_id, tag_id) VALUES (?, ?)", [comicId, tagId]);
    res.status(200).json({ success: true, message: "Tag added to comic successfully" });
  } catch (error) {
    console.error(`Error adding tag ${req.params.tagId} to comic ${req.params.comicId}:`, error);
    res.status(500).json({ success: false, message: "Failed to add tag to comic", error: error.message });
  }
};

export const removeTagFromComic = async (req, res) => {
  try {
    const pool = getDbConnection();
    const { comicId, tagId } = req.params;
    const [result] = await pool.query("DELETE FROM comics_tags WHERE comic_id = ? AND tag_id = ?", [comicId, tagId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Tag association not found for this comic" });
    }
    res.status(200).json({ success: true, message: "Tag removed from comic successfully" });
  } catch (error) {
    console.error(`Error removing tag ${req.params.tagId} from comic ${req.params.comicId}:`, error);
    res.status(500).json({ success: false, message: "Failed to remove tag from comic", error: error.message });
  }
};


// --- NUEVOS CONTROLLERS PARA SECCIONES DE EXPLORAR (CON TAGS) ---

export const getMostLikedComicsController = async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  try {
    const pool = getDbConnection();
    const query = `
      SELECT 
        c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at, 
        COUNT(l.id) as likes_count
      FROM comics c
      LEFT JOIN likes l ON c.id = l.comic_id
      GROUP BY c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at
      ORDER BY likes_count DESC, c.nombre ASC
      LIMIT ?`;
    const [comicsRows] = await pool.query(query, [limit]);

    const comicsWithDetails = await Promise.all(
        comicsRows.map(async (comicRow) => {
            const tags = await getTagsForComicId(comicRow.id, pool); // Obtener tags
            const [commentsResult] = await pool.query("SELECT COUNT(*) as count FROM comentarios WHERE comic_id = ?", [comicRow.id]);
            const commentsCount = commentsResult[0]?.count || 0;
            return mapComicData(comicRow, tags, comicRow.likes_count, commentsCount);
        })
    );

    res.status(200).json({ success: true, comics: comicsWithDetails });
  } catch (error) {
    console.error("Error in getMostLikedComicsController:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener cómics más gustados.", error: error.message });
  }
};

export const getMostCommentedComicsController = async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  try {
    const pool = getDbConnection();
    const query = `
      SELECT 
        c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at, 
        COUNT(co.id) as comments_count
      FROM comics c
      LEFT JOIN comentarios co ON c.id = co.comic_id
      GROUP BY c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at
      ORDER BY comments_count DESC, c.nombre ASC
      LIMIT ?`;
    const [comicsRows] = await pool.query(query, [limit]);

    const comicsWithDetails = await Promise.all(
        comicsRows.map(async (comicRow) => {
            const tags = await getTagsForComicId(comicRow.id, pool); // Obtener tags
            const [likesResult] = await pool.query("SELECT COUNT(*) as count FROM likes WHERE comic_id = ?", [comicRow.id]);
            const likesCount = likesResult[0]?.count || 0;
            return mapComicData(comicRow, tags, likesCount, comicRow.comments_count);
        })
    );
    res.status(200).json({ success: true, comics: comicsWithDetails });
  } catch (error) {
    console.error("Error in getMostCommentedComicsController:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener cómics más comentados.", error: error.message });
  }
};

export const getRecentlyAddedComicsController = async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  try {
    const pool = getDbConnection();
    const query = `
      SELECT id, nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada, created_at
      FROM comics
      ORDER BY created_at DESC, nombre ASC
      LIMIT ?`;
    const [comicsRows] = await pool.query(query, [limit]);

    const comicsWithDetails = await Promise.all(
      comicsRows.map(async (comicRow) => {
        const tags = await getTagsForComicId(comicRow.id, pool); // Obtener tags
        const [likesResult] = await pool.query("SELECT COUNT(*) as count FROM likes WHERE comic_id = ?", [comicRow.id]);
        const likesCount = likesResult[0]?.count || 0;
        const [commentsResult] = await pool.query("SELECT COUNT(*) as count FROM comentarios WHERE comic_id = ?", [comicRow.id]);
        const commentsCount = commentsResult[0]?.count || 0;
        return mapComicData(comicRow, tags, likesCount, commentsCount);
      })
    );

    res.status(200).json({ success: true, comics: comicsWithDetails });
  } catch (error) {
    console.error("Error in getRecentlyAddedComicsController:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener cómics recientes.", error: error.message });
  }
};

export const getComicsForYou = async (req, res) => {
  try {
    const pool = getDbConnection();
    // Asumiendo que tienes el ID del usuario logeado desde un middleware de autenticación
    // Por ejemplo: req.user = { id: userIdFromToken };
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }

    // 1. Obtener los comic_id de los cómics que le han gustado al usuario (tabla 'likes')
    const [likedComicsRows] = await pool.query(
      `SELECT comic_id FROM likes WHERE user_id = ?`, // Usamos la tabla 'likes'
      [userId]
    );

    if (likedComicsRows.length === 0) {
      return res.status(200).json({ success: true, comics: [], message: "Aún no te ha gustado ningún cómic. ¡Explora y dale like a tus favoritos!" });
    }

    const likedComicIds = likedComicsRows.map(like => like.comic_id);

    // 2. Identificar las dos etiquetas más repetidas de esos cómics
    const [topTagsRows] = await pool.query(
      `SELECT ct.tag_id, t.nombre as tag_name, COUNT(ct.tag_id) as tag_count
       FROM comics_tags ct
       JOIN tags t ON ct.tag_id = t.id
       WHERE ct.comic_id IN (?)
       GROUP BY ct.tag_id, t.nombre
       ORDER BY tag_count DESC
       LIMIT 2`,
      [likedComicIds] // Pasamos el array de IDs directamente
    );

    if (topTagsRows.length === 0) {
      return res.status(200).json({ success: true, comics: [], message: "Los cómics que te gustan no tienen etiquetas o no se pudieron procesar." });
    }

    const topTagIds = topTagsRows.map(tag => tag.tag_id);

    // 3. Obtener todos los cómics que tengan alguna de esas dos etiquetas
    const [comicsWithTopTagsRows] = await pool.query(
      `SELECT DISTINCT
          c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at,
          (SELECT COUNT(*) FROM likes l WHERE l.comic_id = c.id) as likes_count,
          (SELECT COUNT(*) FROM comentarios co WHERE co.comic_id = c.id) as comments_count
       FROM comics c
       JOIN comics_tags ct ON c.id = ct.comic_id
       WHERE ct.tag_id IN (?)
       ORDER BY c.nombre ASC`,
      [topTagIds] // Pasamos el array de IDs directamente
    );

    const comicsWithDetails = await Promise.all(
      comicsWithTopTagsRows.map(async (comicRow) => {
        const tags = await getTagsForComicId(comicRow.id, pool);
        // likes_count y comments_count ya vienen de la subconsulta
        return mapComicData(comicRow, tags, comicRow.likes_count, comicRow.comments_count);
      })
    );

    res.status(200).json({
        success: true,
        comics: comicsWithDetails,
        message: `Cómics recomendados basados en las etiquetas más frecuentes de tus 'Me Gusta': ${topTagsRows.map(t => t.tag_name).join(', ')}.`,
        recommended_based_on_tags: topTagsRows.map(t => ({id: t.tag_id, name: t.tag_name}))
    });

  } catch (error) {
    console.error("Error in getComicsForYou:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener cómics para ti.", error: error.message });
  }
};

// En comic-controller.js
// ... (tus otras importaciones y funciones)

export const getPopularComicsByTagName = async (req, res) => {
  try {
    const pool = getDbConnection();
    const { tagName } = req.query;
    const limit = 5; // Los 5 cómics con más likes

    if (!tagName) {
      return res.status(400).json({ success: false, message: "El parámetro 'tagName' es requerido." });
    }

    // 1. Obtener el tag_id a partir del tagName (tabla 'tags', columna 'nombre')
    const [tagResult] = await pool.query("SELECT id FROM tags WHERE nombre = ?", [tagName]);

    if (tagResult.length === 0) {
      return res.status(404).json({ success: true, comics: [], message: `La etiqueta '${tagName}' no fue encontrada.` });
    }
    const tagId = tagResult[0].id;

    // 2. Obtener los 5 cómics más populares para esa etiqueta
    const query = `
      SELECT
        c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at,
        COUNT(DISTINCT l.id) as likes_count, -- Contar likes distintos
        (SELECT COUNT(*) FROM comentarios co WHERE co.comic_id = c.id) as comments_count
      FROM comics c
      JOIN comics_tags ct ON c.id = ct.comic_id
      LEFT JOIN likes l ON c.id = l.comic_id
      WHERE ct.tag_id = ?
      GROUP BY c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at
      ORDER BY likes_count DESC, c.nombre ASC
      LIMIT ?`;

    const [comicsRows] = await pool.query(query, [tagId, limit]);

    if (comicsRows.length === 0) {
        return res.status(200).json({ success: true, comics: [], message: `No hay cómics (o no hay cómics con likes) para la etiqueta '${tagName}'.` });
    }

    const comicsWithDetails = await Promise.all(
        comicsRows.map(async (comicRow) => {
            const tags = await getTagsForComicId(comicRow.id, pool);
            // likes_count y comments_count ya vienen de la query principal
            return mapComicData(comicRow, tags, comicRow.likes_count, comicRow.comments_count);
        })
    );

    res.status(200).json({ success: true, comics: comicsWithDetails });

  } catch (error) {
    console.error("Error in getPopularComicsByTagName:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener cómics populares por etiqueta.", error: error.message });
  }
};

export const getUserLikedComicsTags = async (req, res) => {
  try {
    const pool = getDbConnection();
    const userId = req.user?.id; // Asume que el middleware 'authenticate' ya pobló req.user

    if (!userId) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }

    // Consulta para obtener las etiquetas únicas de los cómics que le han gustado al usuario
    const [likedComicsTagsRows] = await pool.query(
      `SELECT DISTINCT 
            t.id, 
            t.nombre 
       FROM likes l
       JOIN comics_tags ct ON l.comic_id = ct.comic_id
       JOIN tags t ON ct.tag_id = t.id
       WHERE l.user_id = ?
       ORDER BY t.nombre ASC`,
      [userId]
    );

    // El resultado ya debería estar en el formato { id: ..., name: ... }
    // gracias al SELECT t.id, t.nombre. Si necesitas renombrar 'nombre' a 'name'
    // para que coincida exactamente con TagInfo (id, name) de Kotlin, puedes mapear:
    // const userTags = likedComicsTagsRows.map(tag => ({ id: tag.id, name: tag.nombre }));
    // Pero como ya seleccionas t.nombre, y mapComicData usa 'name' para los tags,
    // `likedComicsTagsRows` debería estar bien si la data class TagInfo usa @SerializedName("nombre") o si el campo es 'nombre'.
    // Para asegurar compatibilidad con `data class TagInfo(val id: Int, val name: String)`:
    const userTags = likedComicsTagsRows.map(tag => ({
        id: tag.id,
        name: tag.nombre // Aseguramos que la propiedad se llame 'name'
    }));


    res.status(200).json({ success: true, tags: userTags });

  } catch (error) {
    console.error("Error in getUserLikedComicsTags:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener etiquetas de cómics gustados.", error: error.message });
  }
};

// En comic-controller.js
// ... (importaciones y funciones auxiliares como getTagsForComicId, mapComicData) ...

export const searchAllComics = async (req, res) => {
    const searchTerm = req.query.q?.toLowerCase() || '';

    if (!searchTerm || searchTerm.trim() === "") {
        return res.status(200).json({
            success: true,
            comics: [],
            message: "Por favor, introduce un término de búsqueda.",
        });
    }

    try {
        const pool = getDbConnection();
        const searchPattern = `%${searchTerm}%`;

        const query = `
            SELECT DISTINCT
                c.id, c.nombre, c.editorial, c.ruta_pdf, c.coleccion, c.familia, c.imagen_portada, c.created_at,
                (SELECT COUNT(*) FROM likes l WHERE l.comic_id = c.id) as likes_count,
                (SELECT COUNT(*) FROM comentarios co WHERE co.comic_id = c.id) as comments_count
            FROM comics c
            LEFT JOIN comics_tags ct ON c.id = ct.comic_id
            LEFT JOIN tags t ON ct.tag_id = t.id
            WHERE 
                c.nombre LIKE ? OR
                c.editorial LIKE ? OR
                c.familia LIKE ? OR
                t.nombre LIKE ?
            ORDER BY c.nombre ASC;
        `;

        const queryParams = [searchPattern, searchPattern, searchPattern, searchPattern];

        const [comicsRows] = await pool.query(query, queryParams);

        if (comicsRows.length === 0) {
            return res.status(200).json({
                success: true,
                comics: [],
                message: `No se encontraron cómics para "${searchTerm}".`,
            });
        }

        const comicsWithDetails = await Promise.all(
            comicsRows.map(async (comicRow) => {
                const tags = await getTagsForComicId(comicRow.id, pool);
                return mapComicData(comicRow, tags, comicRow.likes_count, comicRow.comments_count);
            })
        );

        res.status(200).json({ success: true, comics: comicsWithDetails });

    } catch (error) {
        console.error("Error in searchAllComics:", error);
        res.status(500).json({
            success: false,
            message: "Error del servidor durante la búsqueda.",
            error: error.message,
        });
    }
};
