// server.js (Archivo Principal)

const express = require('express');
const cors = require('cors');
const initializeDatabase = require('./config/database');

// Importar las "fábricas" de controladores
const createAuthControlller = require('./controllers/authController');
const createRegistroController = require('./controllers/registroController');
const createMateriaController = require('./controllers/materiaController');

// Importar las "fábricas" de rutas
const createAuthRoutes = require('./routes/authRoutes');
const createRegistroRoutes = require('./routes/registroRoutes');
const createMateriaRoutes = require('./routes/materiaRoutes');

const PORT = process.env.PORT || 3000;
const app = express();

// --- Middleware Básico ---
// Habilita CORS para permitir peticiones desde tu app de Flutter
app.use(cors());
// Permite al servidor entender JSON
app.use(express.json());

/**
 * Función principal asíncrona para inicializar la BD
 * y luego arrancar el servidor.
 */
async function main() {
    try {
        // 1. Inicializar la Base de Datos (crea y siembra los datos)
        const db = await initializeDatabase();
        console.log("Base de Datos lista.");

        // Función simple para pasar la instancia de la BD a los controladores
        const getDb = () => db;

        // 2. Crear los Controladores (Inyectar la BD)
        // (registroController se crea primero porque materiaController usa sus funciones)
        const registroController = createRegistroController(getDb);
        const authController = createAuthControlller(getDb);
        
        // Inyectamos getDb y las funciones de validación de registro
        const materiaController = createMateriaController(getDb, registroController);

        // 3. Crear las Rutas (Inyectar los Controladores)
        const authRoutes = createAuthRoutes(authController);
        const registroRoutes = createRegistroRoutes(registroController);
        const materiaRoutes = createMateriaRoutes(materiaController);

        // 4. Usar las Rutas
        app.use('/api/auth', authRoutes);
        app.use('/api/registro', registroRoutes);
        app.use('/api/materia', materiaRoutes);

        // Ruta de bienvenida
        app.get('/', (req, res) => {
            res.send('API del Sistema Académico funcionando. ¡Conecta tu app de Flutter!');
        });

        // 5. Iniciar el Servidor
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Error fatal al iniciar el servidor:", error.message);
        process.exit(1); // Detiene la aplicación si la BD falla
    }
}

// Ejecutar la función principal
main();