// server.js (¡¡¡LA PUTA VERSIÓN LIMPIA Y FINAL!!!)

console.log("Paso 1: Arrancando server.js...");

require('dotenv').config(); 
console.log("Paso 1.1: dotenv cargado.");

const express = require('express');
console.log("Paso 1.2: express cargado.");
const cors = require('cors');
console.log("Paso 1.3: cors cargado.");
const initializeDatabase = require('./config/database');
console.log("Paso 1.4: database.js cargado.");

// Importar las "fábricas" de controladores
console.log("Paso 2: Cargando authController...");
const createAuthControlller = require('./controllers/authController');
console.log("Paso 2.1: ¡authController CARGADO!");

console.log("Paso 3: Cargando registroController...");
const createRegistroController = require('./controllers/registroController');
console.log("Paso 3.1: ¡registroController CARGADO!");

console.log("Paso 4: Cargando materiaController...");
const createMateriaController = require('./controllers/materiaController');
console.log("Paso 4.1: ¡materiaController CARGADO!");

console.log("Paso 5: Cargando authMiddleware...");
const authMiddleware = require('./middleware/authMiddleware');
console.log("Paso 5.1: ¡authMiddleware CARGADO!");

console.log("Paso 6: Cargando rutas...");
const createAuthRoutes = require('./routes/authRoutes');
const createRegistroRoutes = require('./routes/registroRoutes');
const createMateriaRoutes = require('./routes/materiaRoutes');
console.log("Paso 6.1: ¡Rutas CARGADAS!");


const PORT = process.env.PORT || 3000;
const app = express();
console.log("Paso 7: App de Express creada.");

app.use(cors());
app.use(express.json());
console.log("Paso 8: Middlewares (cors, json) listos.");

async function main() {
    console.log("Paso 9: Entrando a main()...");
    try {
        console.log("Paso 10: Inicializando Base de Datos...");
        const db = await initializeDatabase();
        console.log("Base de Datos lista."); 

        const getDb = () => db;

        // ¡¡¡LA PUTA CIRUGÍA #4!!!
        // ¡¡¡YA NO HAY PUTA INYECCIÓN DE DEPENDENCIA DE MIERDA!!!
        console.log("Paso 11: Creando controladores...");
        const registroController = createRegistroController(getDb);
        const authController = createAuthControlller(getDb);
        const materiaController = createMateriaController(getDb); // <-- ¡MÁS LIMPIO, CARAJO!

        console.log("Paso 12: Creando rutas...");
        const authRoutes = createAuthRoutes(authController); 
        const registroRoutes = createRegistroRoutes(registroController, authMiddleware);
        const materiaRoutes = createMateriaRoutes(materiaController, authMiddleware);

        console.log("Paso 13: Usando rutas...");
        app.use('/api/auth', authRoutes);
        app.use('/api/registro', registroRoutes);
        app.use('/api/materia', materiaRoutes);

        app.get('/', (req, res) => {
            res.send('API del Sistema Académico funcionando. ¡Conecta tu app de Flutter!');
        });

        console.log(`Paso 14: Arrancando servidor en puerto ${PORT}...`);
        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("Error fatal al iniciar el servidor:", error.message);
        process.exit(1); 
    }
}

main();