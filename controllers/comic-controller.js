// controllers/comic-controller.js

import fs from 'fs';
import path from 'path';
import { getDbConnection } from "../config/database.js";
import multer from 'multer';

// --- FUNCIÓN AUXILIAR PARA OBTENER TAGS (REUTILIZABLE) ---
export const getTagsForComicId = async (comicId, pool) => {
  try {
    const [tags] = await pool.query(
      `SELECT t.id, t.nombre 
       FROM tags t
       JOIN comics_tags ct ON t.id = ct.tag_id
       WHERE ct.comic_id = ? 
       ORDER BY t.nombre ASC`, // Opcional: ordenar tags alfabéticamente
      [comicId]
    );

    return tags.map(tag => ({ id: tag.id, nombre: tag.nombre }));
  } catch (error) {
    console.error(`Error fetching tags for comic_id ${comicId}:`, error);
    return []; 
    /**  Aquí tengo que devolver un array vacío en 
     * caso de error para no romper el flujo principal
    */
  }
};

// --- FUNCIÓN AUXILIAR PARA MAPEAR EL RESULTADO DEL CÓMIC A LA ESTRUCTURA DESEADA ---
export const mapComicData = (comicRow, tags = [], likesCount = 0, commentsCount = 0) => {
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
    tags: tags
  };
};

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

    baseQuery += " ORDER BY c.nombre ASC"; 

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
      return res.status(404).json({ success: false, message: "Cómic no encontrado (no existe en la base de datos)" });
    }
    const relativePdfPath = comicData[0].ruta_pdf;
    const comicName = comicData[0].nombre || `comic_${id}`;
    if (!relativePdfPath) {
      console.error(`PDF la ruta está null o vacía para el comic ID: ${id}`);
      return res.status(404).json({ success: false, message: "Ruta PDF no definida para este cómic" });
    }
    const absolutePdfPath = path.resolve(process.cwd(), relativePdfPath);
    console.log(`Intentando servir el PDF desde la ruta absoluta: ${absolutePdfPath}`);
    if (!fs.existsSync(absolutePdfPath)) {
      console.error(`Archivo no encontrado en la ruta absoluta: ${absolutePdfPath} (la relativa era: ${relativePdfPath}) para el cómic con ID: ${id}`);
      return res.status(404).json({ success: false, message: "El archivo PDF no se encontró en el servidor en la ruta esperada" });
    }
    const fileName = path.basename(absolutePdfPath) || `${comicName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.sendFile(absolutePdfPath, (err) => {
      if (err) {
        console.error(`Error mandando el archivo PDF (${fileName}) para el cómic con ID ${id}:`, err);
        if (!res.headersSent) {
          if (err.code === 'ENOENT') {
            res.status(404).json({ success: false, message: "El archivo PDF ha desaparecido antes de ser enviado" });
          } else {
            res.status(500).json({ success: false, message: "Error enviando el archivo PDF" });
          }
        }
      } else {
        console.log(`PDF enviado correctamente: ${fileName} para el cómic con ID : ${id}`);
      }
    });
  } catch (error) {
    console.error(`Error en getComicPdfById para el ID ${req.params.id}:`, error);
    if (!res.headersSent) {
      const errorMessage = process.env.NODE_ENV !== 'production' ? error.message : "Fallo en procesar la petición del PDF";
      res.status(500).json({ success: false, error: errorMessage });
    }
  }
};

export const deleteComic = async (req, res) => {
  try {
    const pool = getDbConnection();
    const { id } = req.params;
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado." });
    }
    const [likedComicsRows] = await pool.query(
      `SELECT comic_id FROM likes WHERE user_id = ?`, // Usamos la tabla 'likes'
      [userId]
    );

    if (likedComicsRows.length === 0) {
      return res.status(200).json({ success: true, comics: [], message: "Aún no te ha gustado ningún cómic. ¡Explora y dale like a tus favoritos!" });
    }

    const likedComicIds = likedComicsRows.map(like => like.comic_id);

    const [topTagsRows] = await pool.query(
      `SELECT ct.tag_id, t.nombre as tag_name, COUNT(ct.tag_id) as tag_count
       FROM comics_tags ct
       JOIN tags t ON ct.tag_id = t.id
       WHERE ct.comic_id IN (?)
       GROUP BY ct.tag_id, t.nombre
       ORDER BY tag_count DESC
       LIMIT 2`,
      [likedComicIds] 
    );

    if (topTagsRows.length === 0) {
      return res.status(200).json({ success: true, comics: [], message: "Los cómics que te gustan no tienen etiquetas o no se pudieron procesar." });
    }

    const topTagIds = topTagsRows.map(tag => tag.tag_id);

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
        return mapComicData(comicRow, tags, comicRow.likes_count, comicRow.comments_count);
      })
    );

    res.status(200).json({
        success: true,
        comics: comicsWithDetails,
        message: `Cómics recomendados basados en las etiquetas más frecuentes de tus 'Me Gusta': ${topTagsRows.map(t => t.tag_name).join(', ')}.`,
        recommended_based_on_tags: topTagsRows.map(t => ({id: t.tag_id, nombre: t.tag_name}))
    });

  } catch (error) {
    console.error("Error in getComicsForYou:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener cómics para ti.", error: error.message });
  }
};

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

    const userTags = likedComicsTagsRows.map(tag => ({
        id: tag.id,
        nombre: tag.nombre // Aseguramos que la propiedad se llame 'name'
    }));


    res.status(200).json({ success: true, tags: userTags });

  } catch (error) {
    console.error("Error in getUserLikedComicsTags:", error);
    res.status(500).json({ success: false, message: "Error del servidor al obtener etiquetas de cómics gustados.", error: error.message });
  }
};

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

export const uploadComicWithMetadata = async (req, res) => {
  const pool = getDbConnection();
  let connection; // Declarar la conexión para que sea accesible en el bloque finally

  try {
    const { nombre, editorial, coleccion, familia, tagIds } = req.body;

    // --- Validación de Metadatos Básicos ---
    if (!nombre || !editorial || typeof coleccion === 'undefined' || !familia) {
      // No es necesario liberar la conexión aquí, aún no se ha obtenido
      return res.status(400).json({ success: false, message: "Faltan campos obligatorios: nombre, editorial, coleccion, familia." });
    }

    // --- Validación de Archivo PDF ---
    if (!req.files || !req.files.comicPdf || !req.files.comicPdf[0]) {
      // No es necesario liberar la conexión aquí
      return res.status(400).json({ success: false, message: "No se ha subido ningún archivo PDF para 'comicPdf'." });
    }

    const pdfFile = req.files.comicPdf[0];
    const ruta_pdf = path.join('public/comics', pdfFile.filename).replace(/\\/g, '/');

    // --- Manejo de Imagen de Portada (Opcional) ---
    let imagen_portada = '/comics/default_cover.jpg';
    if (req.files && req.files.comicImage && req.files.comicImage[0]) {
      const imageFile = req.files.comicImage[0];
      imagen_portada = path.join('public/comics', imageFile.filename).replace(/\\/g, '/');
    } else if (req.body.imagen_portada_url) {
        imagen_portada = req.body.imagen_portada_url;
    }

    const userId = req.user?.id;
    const parsedColeccion = coleccion === 'true' || coleccion === true;

    // --- Iniciar Transacción ---
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // --- Insertar el Cómic ---
    const comicSql = `INSERT INTO comics (nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada ${userId ? ', user_id_uploader' : ''}) 
                      VALUES (?, ?, ?, ?, ?, ? ${userId ? ', ?' : ''})`;
    const comicParams = userId
        ? [nombre, editorial, ruta_pdf, parsedColeccion, familia, imagen_portada, userId]
        : [nombre, editorial, ruta_pdf, parsedColeccion, familia, imagen_portada];
    
    const [result] = await connection.query(comicSql, comicParams);
    const newComicId = result.insertId;

    // --- Procesar y Asignar Etiquetas ---
    if (tagIds) {
      let parsedTagIds = [];
      if (typeof tagIds === 'string') {
        parsedTagIds = tagIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      } else if (Array.isArray(tagIds)) {
        parsedTagIds = tagIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      }

      if (parsedTagIds.length > 0) {
        const tagInsertPromises = parsedTagIds.map(tagId => {
          const comicsTagsSql = "INSERT IGNORE INTO comics_tags (comic_id, tag_id) VALUES (?, ?)";
          return connection.query(comicsTagsSql, [newComicId, tagId]);
        });
        await Promise.all(tagInsertPromises);
      }
    }
    
    // --- Confirmar Transacción ---
    await connection.commit();

    // --- Obtener Datos del Cómic Creado para la Respuesta (después del commit) ---
    // Puedes usar la misma conexión o una nueva del pool. Usar la misma es eficiente.
    const [newComicRows] = await connection.query("SELECT * FROM comics WHERE id = ?", [newComicId]);
    
    if (newComicRows.length === 0) {
        // Esto no debería suceder si el commit fue exitoso y el ID es correcto,
        // pero es una comprobación de seguridad.
        // Técnicamente, si esto falla después del commit, los datos están guardados.
        // Considera cómo manejar este caso extremo.
        console.error("Error crítico: Cómic no encontrado después del commit.");
        // No se puede hacer rollback aquí porque ya se hizo commit.
        return res.status(500).json({ success: false, message: "Fallo al recuperar el cómic después de guardarlo."});
    }
    
    const assignedTags = await getTagsForComicId(newComicId, connection); // Pasa la conexión
    const newComicData = mapComicData(newComicRows[0], assignedTags, 0, 0);

    res.status(201).json({
      success: true,
      message: "Cómic subido y creado exitosamente con sus etiquetas!",
      comic: newComicData
    });

  } catch (error) {
    // Si hay una conexión y aún no se ha hecho commit (o falló antes), hacer rollback
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Error durante el rollback:", rollbackError);
        // No se puede hacer mucho más aquí, solo loggear.
      }
    }

    console.error("Error en uploadComicWithMetadata:", error);
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Error de subida: ${error.message}` });
    } else if (error.message && error.message.includes('Formato de archivo no permitido')) {
        return res.status(400).json({ success: false, message: error.message });
    }
    // Error general del servidor o error de la DB
    res.status(500).json({ success: false, message: "Error del servidor al subir el cómic.", error: error.message });
  } finally {
    if (connection) {
      connection.release(); // Liberar la conexión de vuelta al pool en todos los casos
    }
  }
};
