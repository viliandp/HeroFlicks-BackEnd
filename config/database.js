import mysql from "mysql2/promise";
import bcrypt from 'bcrypt';

// Database connection pool
let pool;

export const connectToDatabase = async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      multipleStatements: true, 
    });

    const connection = await pool.getConnection();
    console.log("Successfully connected to MySQL database");
    connection.release();

    await initializeDatabase();

    return pool;
  } catch (error) {
    console.error("Database connection failed:", error);
    throw error;
  }
};

export const getDbConnection = () => {
  if (!pool) {
    throw new Error("Database connection not initialized");
  }
  return pool;
};

/**
 * Inicializa la base de datos con un script SQL completo y estático.
 */
const initializeDatabase = async () => {
  try {
    const pool = await getDbConnection();

    // 1. Script completo para crear TODAS las tablas.
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS comics (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(255) NOT NULL, editorial ENUM('Marvel', 'DC', 'Otros') NOT NULL, ruta_pdf VARCHAR(500) NOT NULL, coleccion BOOLEAN NOT NULL DEFAULT FALSE, familia VARCHAR(100) NOT NULL, imagen_portada VARCHAR(500) NOT NULL, user_id_uploader INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id_uploader) REFERENCES users(id) ON DELETE SET NULL);
      CREATE TABLE IF NOT EXISTS tags (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(50) UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS comics_tags (comic_id INT, tag_id INT, PRIMARY KEY (comic_id, tag_id), FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE, FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS likes (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, comic_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE, UNIQUE KEY uk_user_comic (user_id, comic_id));
      CREATE TABLE IF NOT EXISTS pendientes (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, comic_id INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE, UNIQUE KEY uk_user_comic_pendiente (user_id, comic_id));
      CREATE TABLE IF NOT EXISTS comentarios (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, comic_id INT, comentario TEXT NOT NULL, calificacion TINYINT CHECK (calificacion BETWEEN 1 AND 5), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS user_lists (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, list_name VARCHAR(100) NOT NULL, list_type ENUM('Cómics Pendientes', 'Cómics Gustados') NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS user_list_comics (list_id INT NOT NULL, comic_id INT NOT NULL, added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (list_id, comic_id), FOREIGN KEY (list_id) REFERENCES user_lists(id) ON DELETE CASCADE, FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS notificaciones (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, mensaje TEXT NOT NULL, leido BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS logros (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100) UNIQUE NOT NULL, descripcion TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS usuarios_logros (user_id INT, logro_id INT, fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, logro_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (logro_id) REFERENCES logros(id) ON DELETE CASCADE);
    `;
    console.log("Initializing database...");
    await pool.query(createTablesQuery);
    console.log("All tables created or already exist.");
    
    // 2. Hashear contraseña y crear 20 usuarios
    const saltRounds = 10;
    const plainPassword = '1234';
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    
    for (let i = 1; i <= 20; i++) {
        const user = [`testuser${i}`, `test${i}@example.com`, hashedPassword];
        await pool.query("INSERT IGNORE INTO users (username, email, password) VALUES (?, ?, ?)", user);
    }
    console.log("20 test users inserted or ignored.");

    // 3. Insertar datos estáticos de Cómics, Tags y AÑADIR relaciones de tags
    const insertStaticDataQuery = `
      INSERT IGNORE INTO tags (id, nombre) VALUES (1, 'Superhéroes'), (2, 'Marvel'), (3, 'DC'), (4, 'Acción'), (5, 'Aventura'), (6, 'Ciencia Ficción'), (7, 'Drama'), (8, 'Misterio'), (9, 'Individual'), (10, 'Equipo');
      
      INSERT IGNORE INTO comics (id, nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada) VALUES 
      (1, 'Spiderman: Número Uno', 'Marvel', 'public/comics/spiderman_uno.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_uno.jpg'),
      (2, 'Batman: Número Uno', 'DC', 'public/comics/batman_uno.pdf', FALSE, 'Batman', 'public/comics/batman_uno.jpg'),
      (3, 'Spiderman: Número Dos', 'Marvel', 'public/comics/spiderman_dos.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_dos.jpg'),
      (4, 'Batman: Número Tres', 'DC', 'public/comics/batman_tres.pdf', FALSE, 'Batman', 'public/comics/batman_tres.jpg'),
      (5, 'Spiderman: Número Cuatro', 'Marvel', 'public/comics/spiderman_cuatro.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_cuatro.jpg'),
      (6, 'Batman: Número Dos', 'DC', 'public/comics/batman_dos.pdf', FALSE, 'Batman', 'public/comics/batman_dos.jpg'),
      (7, 'Spiderman: Número Tres', 'Marvel', 'public/comics/spiderman_tres.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_tres.jpg'),
      (8, 'Batman: Número Cuatro', 'DC', 'public/comics/batman_cuatro.pdf', FALSE, 'Batman', 'public/comics/batman_cuatro.jpg'),
      (9, 'Spiderman: Número Cinco', 'Marvel', 'public/comics/spiderman_cinco.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_cinco.jpg'),
      (10, 'Spiderman: Número Seis', 'Marvel', 'public/comics/spiderman_seis.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_seis.jpg'),
      (11, 'Batman: Número Cinco', 'DC', 'public/comics/batman_cinco.pdf', FALSE, 'Batman', 'public/comics/batman_cinco.jpg'),
      (12, 'Spiderman: Número Siete', 'Marvel', 'public/comics/spiderman_siete.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_siete.jpg'),
      (13, 'Batman: Número Seis', 'DC', 'public/comics/batman_seis.pdf', FALSE, 'Batman', 'public/comics/batman_seis.jpg'),
      (14, 'Spiderman: Número Ocho', 'Marvel', 'public/comics/spiderman_ocho.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_ocho.jpg'),
      (15, 'Batman: Número Siete', 'DC', 'public/comics/batman_siete.pdf', FALSE, 'Batman', 'public/comics/batman_siete.jpg'),
      (16, 'Spiderman: Número Nueve', 'Marvel', 'public/comics/spiderman_nueve.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_nueve.jpg'),
      (17, 'Spiderman: Número Diez', 'Marvel', 'public/comics/spiderman_diez.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_diez.jpg');

      -- --- NUEVA SECCIÓN AÑADIDA PARA RELACIONAR COMICS Y TAGS ---
      INSERT IGNORE INTO comics_tags (comic_id, tag_id) VALUES
      (1, 1), (1, 2), (1, 5), (1, 9),
      (2, 1), (2, 3), (2, 8), (2, 7),
      (3, 1), (3, 2), (3, 4),
      (4, 1), (4, 3), (4, 4), (4, 8),
      (5, 1), (5, 2), (5, 6),
      (6, 1), (6, 3), (6, 4),
      (7, 1), (7, 2), (7, 7),
      (8, 1), (8, 3), (8, 9),
      (9, 1), (9, 2), (9, 5),
      (10, 1), (10, 2), (10, 4), (10, 10),
      (11, 1), (11, 3), (11, 7),
      (12, 1), (12, 2), (12, 6),
      (13, 1), (13, 3), (13, 8), (13, 10),
      (14, 1), (14, 2), (14, 5),
      (15, 1), (15, 3), (15, 4),
      (16, 1), (16, 2), (16, 7),
      (17, 1), (17, 2), (17, 4), (17, 5);
    `;
    await pool.query(insertStaticDataQuery);
    console.log("Static data (tags, comics, and tag relations) inserted.");

    // 4. Generar LIKES y PENDIENTES de forma aleatoria
    const NUM_USERS = 20;
    const NUM_COMICS = 17;
    const likesToInsert = new Set();
    const pendientesToInsert = new Set();
    const popularComics = [1, 2, 9, 10, 17]; 

    while (likesToInsert.size < 120) {
      let userId = Math.ceil(Math.random() * NUM_USERS);
      let comicId = Math.random() > 0.3 ? popularComics[Math.floor(Math.random() * popularComics.length)] : Math.ceil(Math.random() * NUM_COMICS);
      likesToInsert.add(`${userId}-${comicId}`);
    }

    while (pendientesToInsert.size < 80) {
      let userId = Math.ceil(Math.random() * NUM_USERS);
      let comicId = Math.ceil(Math.random() * NUM_COMICS);
      if (!likesToInsert.has(`${userId}-${comicId}`)) {
        pendientesToInsert.add(`${userId}-${comicId}`);
      }
    }
    
    const likesValues = Array.from(likesToInsert).map(pair => pair.split('-').map(Number));
    const pendientesValues = Array.from(pendientesToInsert).map(pair => pair.split('-').map(Number));

    if (likesValues.length > 0) {
      await pool.query("INSERT IGNORE INTO likes (user_id, comic_id) VALUES ?", [likesValues]);
    }
    if (pendientesValues.length > 0) {
      await pool.query("INSERT IGNORE INTO pendientes (user_id, comic_id) VALUES ?", [pendientesValues]);
    }
    console.log(`Generated ${likesValues.length} likes and ${pendientesValues.length} pending items.`);

    // 5. Insertar comentarios aleatorios
    const sampleComments = [
      "¡Una obra maestra! Lo recomiendo totalmente.", "No está mal, pero esperaba un poco más de la trama.", "El arte es espectacular, cada página es una maravilla.",
      "Un clásico que todo fan debería leer.", "Me ha decepcionado bastante, la historia no avanza.", "¿Alguien sabe si van a continuar esta saga?",
      "De lo mejor que he leído de este personaje.", "Se me hizo un poco pesado, pero el final merece la pena.", "Simplemente increíble. 5/5 estrellas.",
      "Lo compré por la portada y no me arrepiento. ¡Genial!",
    ];

    const commentsToInsert = [];
    for (let i = 0; i < 50; i++) {
      const userId = Math.ceil(Math.random() * NUM_USERS);
      const comicId = Math.ceil(Math.random() * NUM_COMICS);
      const comentario = sampleComments[Math.floor(Math.random() * sampleComments.length)];
      const calificacion = Math.ceil(Math.random() * 5);
      commentsToInsert.push([userId, comicId, comentario, calificacion]);
    }
    
    if (commentsToInsert.length > 0) {
        await pool.query("INSERT INTO comentarios (user_id, comic_id, comentario, calificacion) VALUES ?", [commentsToInsert]);
    }
    console.log(`Generated and inserted ${commentsToInsert.length} random comments.`);

    console.log("✅ Database initialized successfully.");

  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    throw error;
  }
};