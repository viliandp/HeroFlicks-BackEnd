// config/multer-config.js
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Directorio donde se guardarán los PDFs y las imágenes de portada
const uploadDir = 'public/comics'; // <--- CAMBIO AQUÍ

// Asegurarse de que el directorio de subida exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento para Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); // Directorio de destino para todos los archivos
  },
  filename: function (req, file, cb) {
    // Crear un nombre de archivo único para evitar colisiones
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const originalNameWithoutExt = path.parse(file.originalname).name;
    const sanitizedOriginalName = originalNameWithoutExt.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const extension = path.extname(file.originalname); // Obtener la extensión original
    cb(null, sanitizedOriginalName + '-' + uniqueSuffix + extension); // Usar extensión original
  }
});

// Filtro de archivos para aceptar PDFs e Imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
    cb(null, true); // Aceptar el archivo si es PDF o imagen
  } else {
    cb(new Error('Formato de archivo no permitido. Solo se aceptan PDFs e imágenes.'), false);
  }
};

// Configuración de límites (opcional, pero recomendado)
const limits = {
  fileSize: 1024 * 1024 * 50 // Límite de 50 MB por archivo (ajusta según necesidad)
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: limits
});