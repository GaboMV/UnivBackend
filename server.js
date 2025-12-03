require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const http = require('http'); // 🚨 IMPORTANTE: Necesario para sockets
const { Server } = require("socket.io"); // 🚨 IMPORTANTE: La librería del socket

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

// 1. Configurar CORS y JSON
app.use(cors());
app.use(express.json());

// 2. Crear servidor HTTP y Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Permitir conexión desde cualquier cliente (Flutter/Web)
        methods: ["GET", "POST"]
    }
});

// 3. Lógica del Socket (Quién se conecta)
io.on('connection', (socket) => {
    console.log('⚡ Cliente conectado al Socket:', socket.id);

    // La App Flutter enviará este evento al entrar
    socket.on('identificarse', (userId) => {
        console.log(`👤 Usuario ${userId} unido a su sala privada: user_${userId}`);
        socket.join(`user_${userId}`); 
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

// Middleware para pasar 'io' a las rutas (si lo necesitas en tus controllers)
app.use((req, res, next) => {
    req.io = io;
    next();
});

async function main() {
    try {
        console.log("Inicializando Base de Datos...");
        const db = await initializeDatabase();
        console.log("Base de Datos lista."); 
        const getDb = () => db;
        
        // Controladores
        const registroController = createRegistroController(getDb);
        const authController = createAuthControlller(getDb);
        const materiaController = createMateriaController(getDb); 

        // Rutas
        const authRoutes = createAuthRoutes(authController); 
        const registroRoutes = createRegistroRoutes(registroController, authMiddleware);
        const materiaRoutes = createMateriaRoutes(materiaController, authMiddleware);
        
        app.use('/api/auth', authRoutes);
        app.use('/api/registro', registroRoutes);
        app.use('/api/materia', materiaRoutes);
        
        // 🚨 RUTA ESPECIAL PARA EL ADMIN WEB (Simulación de Backend Admin)
        // Esto recibe la orden de la web y le avisa a la APP
        app.post('/api/admin/resolver', async (req, res) => {
            const { id_estudiante, materia, accion, id_paralelo } = req.body;
            
            console.log(`Admin resolviendo: ${accion} para estudiante ${id_estudiante}`);

            // Mensaje para la notificación
            const mensajeNoti = accion === 'Aceptada' 
                ? `Tu solicitud para ${materia} fue ACEPTADA.`
                : `Tu solicitud para ${materia} fue RECHAZADA.`;
            
            const tipoNoti = accion === 'Aceptada' ? 'solicitud_aceptada' : 'solicitud_rechazada';

            // 🔥 ENVIAR AL SOCKET ESPECÍFICO DEL ESTUDIANTE
            io.to(`user_${id_estudiante}`).emit('nueva_notificacion', {
                mensaje: mensajeNoti,
                fecha: new Date().toISOString(),
                tipo: tipoNoti,
                id_paralelo_asociado: id_paralelo
            });

            res.json({ success: true, message: "Notificación enviada a la app" });
        });

        app.get('/', (req, res) => {
            res.send('API Académica + WebSockets funcionando.');
        });

        // 🚨 CAMBIADO: app.listen -> server.listen
        server.listen(PORT, () => {
            console.log(`¡SERVIDOR SOCKETS CORRIENDO EN PUERTO ${PORT}, CARAJO!`);
        });
    } catch (error) {
        console.error("¡ERROR FATAL AL INICIAR!", error.message);
        console.error(error.stack); 
        process.exit(1); 
    }
}
main();