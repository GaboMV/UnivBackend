// server.js (¡¡¡LA PUTA VERSIÓN LIMPIA Y FINAL!!!)

require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const initializeDatabase = require('./config/database');

// Importar las "fábricas" de controladores
const createAuthControlller = require('./controllers/authController');
const createRegistroController = require('./controllers/registroController');
const createMateriaController = require('./controllers/materiaController');

// Importar el guardia
const authMiddleware = require('./middleware/authMiddleware');

// Importar las "fábricas" de rutas
const createAuthRoutes = require('./routes/authRoutes');
const createRegistroRoutes = require('./routes/registroRoutes');
const createMateriaRoutes = require('./routes/materiaRoutes');

const PORT = process.env.PORT || 3000;
const app = express();

// --- Middleware Básico ---
app.use(cors());
app.use(express.json());

/**
 * Función principal asíncrona para inicializar la BD
 * y luego arrancar el servidor.
 */
async function main() {
    try {
        // 1. Inicializar la Base de Datos
        console.log("Inicializando Base de Datos...");
        const db = await initializeDatabase();
        console.log("Base de Datos lista."); 

        const getDb = () => db;

        // 2. Crear los Controladores (¡limpio, carajo!)
        const registroController = createRegistroController(getDb);
        const authController = createAuthControlller(getDb);
        const materiaController = createMateriaController(getDb);

        // 3. Crear las Rutas
        const authRoutes = createAuthRoutes(authController); 
        const registroRoutes = createRegistroRoutes(registroController, authMiddleware);
        const materiaRoutes = createMateriaRoutes(materiaController, authMiddleware);

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
            console.log(`¡PUTO SERVIDOR CORRIENDO EN EL PUERTO ${PORT}, CARAJO!`);
        });

    } catch (error) {
        console.error("¡ERROR FATAL DE MIERDA AL INICIAR!", error.message);
        console.error(error.stack); // ¡Muestra toda la puta pila de mierda!
        process.exit(1); 
    }
}

// Ejecutar la función principal
main();