// server.js
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const initializeDatabase = require('./config/database');
const createAuthControlller = require('./controllers/authController');
const createRegistroController = require('./controllers/registroController');
const createMateriaController = require('./controllers/materiaController');
const authMiddleware = require('./middleware/authMiddleware');
const createAuthRoutes = require('./routes/authRoutes');
const createRegistroRoutes = require('./routes/registroRoutes');
const createMateriaRoutes = require('./routes/materiaRoutes');
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());
app.use(express.json());

async function main() {
    try {
        console.log("Inicializando Base de Datos...");
        const db = await initializeDatabase();
        console.log("Base de Datos lista."); 
        const getDb = () => db;
        
        // ¡¡¡ESTA ES LA PUTA LÍNEA QUE ARREGLAMOS!!!
        // ¡¡¡YA NO LE PASAMOS 'registroController' a 'materiaController'!!!
        const registroController = createRegistroController(getDb);
        const authController = createAuthControlller(getDb);
        const materiaController = createMateriaController(getDb); // <-- ¡LIMPIO, CARAJO!

        const authRoutes = createAuthRoutes(authController); 
        const registroRoutes = createRegistroRoutes(registroController, authMiddleware);
        const materiaRoutes = createMateriaRoutes(materiaController, authMiddleware);
        
        app.use('/api/auth', authRoutes);
        app.use('/api/registro', registroRoutes);
        app.use('/api/materia', materiaRoutes);
        app.get('/', (req, res) => {
            res.send('API del Sistema Académico funcionando. ¡Conecta tu app de Flutter!');
        });
        app.listen(PORT, () => {
            console.log(`¡PUTO SERVIDOR CORRIENDO EN EL PUERTO ${PORT}, CARAJO!`);
        });
    } catch (error) {
        console.error("¡ERROR FATAL DE MIERDA AL INICIAR!", error.message);
        console.error(error.stack); 
        process.exit(1); 
    }
}
main();