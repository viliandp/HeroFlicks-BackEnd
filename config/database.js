import mysql from "mysql2/promise"

// Database connection pool
let pool

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
    })

    // Comprobar la conexion
    const connection = await pool.getConnection()
    console.log("Successfully connected to MySQL database")
    connection.release()

    await initializeDatabase()

    return pool
  } catch (error) {
    console.error("Database connection failed:", error)
    throw error
  }
}

export const getDbConnection = () => {
  if (!pool) {
    throw new Error("Database connection not initialized")
  }
  return pool
}
/**
 * Inicializa la base de datos.
 * Crea todas las tablas si no existen y las puebla con un conjunto de datos de prueba.
 * Esto es ideal para entornos de desarrollo.
 */
const initializeDatabase = async () => {
  try {
    // Paso 1: Definir la estructura de todas las tablas.
    // Usamos CREATE TABLE IF NOT EXISTS para que el script se pueda ejecutar múltiples veces sin errores.
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        editorial ENUM('Marvel', 'DC', 'Otros') NOT NULL,
        ruta_pdf VARCHAR(500) NOT NULL,
        coleccion BOOLEAN NOT NULL DEFAULT FALSE,
        familia VARCHAR(100) NOT NULL,
        imagen_portada VARCHAR(500) NOT NULL,
        user_id_uploader INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id_uploader) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(50) UNIQUE NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comics_tags (
        comic_id INT,
        tag_id INT,
        PRIMARY KEY (comic_id, tag_id),
        FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        comic_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_comic (user_id, comic_id)
      );

      CREATE TABLE IF NOT EXISTS pendientes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        comic_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE,
        UNIQUE KEY uk_user_comic_pendiente (user_id, comic_id)
      );

      CREATE TABLE IF NOT EXISTS comentarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        comic_id INT,
        comentario TEXT NOT NULL,
        calificacion TINYINT CHECK (calificacion BETWEEN 1 AND 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_lists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        list_name VARCHAR(100) NOT NULL,
        list_type ENUM('Cómics Pendientes', 'Cómics Gustados') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_list_comics (
        list_id INT NOT NULL,
        comic_id INT NOT NULL,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (list_id, comic_id),
        FOREIGN KEY (list_id) REFERENCES user_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (comic_id) REFERENCES comics(id) ON DELETE CASCADE
      );
      
      CREATE TABLE IF NOT EXISTS notificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        mensaje TEXT NOT NULL,
        leido BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS logros (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        descripcion TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS usuarios_logros (
        user_id INT,
        logro_id INT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, logro_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (logro_id) REFERENCES logros(id) ON DELETE CASCADE
      );
    `;

    const insertInitialDataQuery = `
      INSERT IGNORE INTO tags (id, nombre) VALUES
      (1, 'Superhéroes'), (2, 'Marvel'), (3, 'DC'), (4, 'Acción'), (5, 'Aventura'),
      (6, 'Ciencia Ficción'), (7, 'Drama'), (8, 'Misterio'), (9, 'Individual'), (10, 'Equipo');

      INSERT IGNORE INTO users (id, username, email, password) VALUES
      (1, 'testuser', 'test@example.com', '$2b$10$E.M9j./n4aRk9aZtYVf8b.0t.FL.d6U4zL5UqkcJd4eCGmI0v8y8q');

      INSERT IGNORE INTO comics (id, nombre, editorial, ruta_pdf, coleccion, familia, imagen_portada) VALUES
      (1, 'Spiderman: Número Uno',    'Marvel', 'public/comics/spiderman_uno.pdf',    FALSE, 'Spiderman', 'public/comics/spiderman_uno.jpg'),
      (2, 'Batman: Número Uno',       'DC',     'public/comics/batman_uno.pdf',       FALSE, 'Batman',    'public/comics/batman_uno.jpg'),
      (3, 'Spiderman: Número Dos',    'Marvel', 'public/comics/spiderman_dos.pdf',    FALSE, 'Spiderman', 'public/comics/spiderman_dos.jpg'),
      (4, 'Batman: Número Dos',       'DC',     'public/comics/batman_dos.pdf',       FALSE, 'Batman',    'public/comics/batman_dos.jpg'),
      (5, 'Spiderman: Número Tres',   'Marvel', 'public/comics/spiderman_tres.pdf',   FALSE, 'Spiderman', 'public/comics/spiderman_tres.jpg'),
      (6, 'Batman: Número Tres',      'DC',     'public/comics/batman_tres.pdf',      FALSE, 'Batman',    'public/comics/batman_tres.jpg'),
      (7, 'Spiderman: Número Cuatro', 'Marvel', 'public/comics/spiderman_cuatro.pdf', FALSE, 'Spiderman', 'public/comics/spiderman_cuatro.jpg'),
      (8, 'Batman: Número Cuatro',    'DC',     'public/comics/batman_cuatro.pdf',    FALSE, 'Batman',    'public/comics/batman_cuatro.jpg'),
      (9, 'Spiderman: Número Cinco',  'Marvel', 'public/comics/spiderman_cinco.pdf',  FALSE, 'Spiderman', 'public/comics/spiderman_cinco.jpg'),
      (10, 'Batman: Número Cinco',    'DC',     'public/comics/batman_cinco.pdf',     FALSE, 'Batman',    'public/comics/batman_cinco.jpg'),
      (11, 'Spiderman: Número Seis',  'Marvel', 'public/comics/spiderman_seis.pdf',   FALSE, 'Spiderman', 'public/comics/spiderman_seis.jpg'),
      (12, 'Batman: Número Seis',     'DC',     'public/comics/batman_seis.pdf',      FALSE, 'Batman',    'public/comics/batman_seis.jpg'),
      (13, 'Spiderman: Número Siete', 'Marvel', 'public/comics/spiderman_siete.pdf',  FALSE, 'Spiderman', 'public/comics/spiderman_siete.jpg'),
      (14, 'Batman: Número Siete',    'DC',     'public/comics/batman_siete.pdf',     FALSE, 'Batman',    'public/comics/batman_siete.jpg'),
      (15, 'Spiderman: Número Ocho',  'Marvel', 'public/comics/spiderman_ocho.pdf',   FALSE, 'Spiderman', 'public/comics/spiderman_ocho.jpg'),
      (16, 'Spiderman: Número Nueve', 'Marvel', 'public/comics/spiderman_nueve.pdf',  FALSE, 'Spiderman', 'public/comics/spiderman_nueve.jpg'),
      (17, 'Spiderman: Número Diez',  'Marvel', 'public/comics/spiderman_diez.pdf',   FALSE, 'Spiderman', 'public/comics/spiderman_diez.jpg');
    `;

    const insertTagsRelationsQuery = `
      INSERT IGNORE INTO comics_tags (comic_id, tag_id) VALUES
      (1, 2), (1, 1), (1, 4), (1, 9),
      (2, 3), (2, 1), (2, 8), (2, 7),
      (3, 2), (3, 1), (3, 5),
      (4, 3), (4, 1), (4, 4),
      (5, 2), (5, 1), (5, 6),
      (6, 3), (6, 1), (6, 4), (6, 8),
      (7, 2), (7, 1), (7, 7),
      (8, 3), (8, 1), (8, 9),
      (9, 2), (9, 1), (9, 5), (9, 4),
      (10, 3), (10, 1), (10, 7),
      (11, 2), (11, 1), (11, 4),
      (12, 3), (12, 1), (12, 8), (12, 4),
      (13, 2), (13, 1), (13, 6), (13, 5),
      (14, 3), (14, 1), (14, 4), (14, 9),
      (15, 2), (15, 1), (15, 7),
      (16, 2), (16, 1), (16, 5),
      (17, 2), (17, 1), (17, 4), (17, 7);
    `;

    console.log("Initializing database...");

    // CORRECCIÓN: Se obtiene el pool directamente, sin desestructurar como un array.
    const pool = await getDbConnection(); 
    
    // El driver mysql2 permite ejecutar múltiples sentencias en una sola llamada
    // si la opción `multipleStatements: true` está activada en la configuración del pool.
    // Esto es más eficiente.
    await pool.query(createTablesQuery);
    console.log("Tables created or already exist.");

    await pool.query(insertInitialDataQuery);
    console.log("Initial data (users, tags, comics) inserted or ignored.");
    
    await pool.query(insertTagsRelationsQuery);
    console.log("Tags associated with comics.");

    console.log("✅ Database initialized successfully with default data.");
    console.log("-> Usuario de prueba: testuser / Contraseña: password123");

  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    throw error;
  }
};

