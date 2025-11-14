// routes/registroRoutes.js
const express = require('express');
const router = express.Router();

module.exports = (registroController) => {

    /**
     * @route GET /api/registro/semestres/:idEstudiante
     * @desc Obtiene los semestres donde el estudiante tuvo inscripciones.
     * @access Private (Debería estar protegido por Auth)
     */
    router.get('/semestres/:idEstudiante', registroController.getSemestresInscritos);

    /**
     * @route GET /api/registro/historial/:idEstudiante/:idSemestre
     * @desc Obtiene el historial de materias (DTO HistorialMateria) para un semestre.
     * @access Private
     */
    router.get('/historial/:idEstudiante/:idSemestre', registroController.getHistorialPorSemestre);

    /**
     * @route POST /api/registro/inscribir
     * @desc Inscribe al estudiante en un paralelo (con validaciones).
     * @access Private
     * @body { idEstudiante, idParalelo, idMateria, idSemestreActual }
     */
    router.post('/inscribir', registroController.inscribirEstudiante);

    /**
     * @route POST /api/registro/retirar
     * @desc Retira (DELETE) al estudiante de un paralelo.
     * @access Private
     * @body { idEstudiante, idParalelo }
     */
    router.post('/retirar', registroController.retirarMateria);

    /**
     * @route POST /api/registro/solicitud/enviar
     * @desc Envía una solicitud de inscripción (si no cumple requisitos).
     * @access Private
     * @body { idEstudiante, idParalelo, motivo }
     */
    router.post('/solicitud/enviar', registroController.enviarSolicitud);

    /**
     * @route POST /api/registro/solicitud/retirar
     * @desc Retira (DELETE) una solicitud 'En Espera'.
     * @access Private
     * @body { idEstudiante, idParalelo }
     */
    router.post('/solicitud/retirar', registroController.retirarSolicitud);

    return router;
};