// routes/registroRoutes.js
// (¡¡¡LA PUTA VERSIÓN COMPLETA!!!)

const express = require('express');
const router = express.Router();

module.exports = (registroController, authMiddleware) => {

    // --- RUTAS DE CONSULTA (GET) ---
    router.get('/semestres/:idEstudiante', authMiddleware, registroController.getSemestresInscritos);
    router.get('/historial/:idEstudiante/:idSemestre', authMiddleware, registroController.getHistorialPorSemestre);
    router.get('/horario/:idEstudiante/:nombreSemestre', authMiddleware, registroController.getHorarioEstudiante);

    // --- RUTAS DE ACCIÓN (POST) ---
    router.post('/inscribir', authMiddleware, registroController.inscribirEstudiante);
    router.post('/retirar', authMiddleware, registroController.retirarMateria);
    router.post('/solicitud/enviar', authMiddleware, registroController.enviarSolicitud);
    router.post('/solicitud/retirar', authMiddleware, registroController.retirarSolicitud);

    // --- RUTAS DE NOTIFICACIONES ---
    router.get('/notificaciones/:idEstudiante', authMiddleware, registroController.getNotificaciones);
    router.delete('/notificaciones/:idNotificacion', authMiddleware, registroController.borrarNotificacion);

    // --- RUTAS DE ADMINISTRACIÓN (SIN AUTH) ---
    router.get('/solicitudes', registroController.getSolicitudesPendientes);
    router.post('/resolver', registroController.resolverSolicitud);
    router.post('/anuncio', registroController.enviarAnuncioGlobal);

    router.get('/sistema/estado', registroController.getEstadoInscripciones); 
    router.post('/sistema/toggle', registroController.toggleInscripciones);

    return router;
};