
const express = require('express');
const router = express.Router();


module.exports = (registroController, authMiddleware) => {

   
    
    router.get('/semestres/:idEstudiante', authMiddleware, registroController.getSemestresInscritos);
    router.get('/historial/:idEstudiante/:idSemestre', authMiddleware, registroController.getHistorialPorSemestre);
    router.post('/inscribir', authMiddleware, registroController.inscribirEstudiante);
    router.post('/retirar', authMiddleware, registroController.retirarMateria);
    router.post('/solicitud/enviar', authMiddleware, registroController.enviarSolicitud);
    router.post('/solicitud/retirar', authMiddleware, registroController.retirarSolicitud);
    router.get('/horario/:idEstudiante/:nombreSemestre', authMiddleware, registroController.getHorarioEstudiante);
    router.get('/solicitudes', registroController.getSolicitudesPendientes);
    router.post('/resolver', registroController.resolverSolicitud);
router.get('/solicitudes/resueltas/:idEstudiante', authMiddleware, registroController.getSolicitudesResueltas);
    router.delete('/solicitudes/resueltas/:idSolicitud', authMiddleware, registroController.deleteSolicitudResuelta);
    return router;
};