// routes/materiaRoutes.js
const express = require('express');
const router = express.Router();

module.exports = (materiaController, authMiddleware) => {

    router.get('/facultades', materiaController.getAllFacultades);
    router.get('/search/:query', materiaController.searchMaterias);
    router.get('/by-facultad/:idFacultad', materiaController.getMateriasByFacultad);
    router.get('/:idMateria', materiaController.getMateriaById);

    router.get('/paralelos/:idMateria/:idEstudiante/:idSemestreActual', authMiddleware, materiaController.getParalelosDetalle);
//
router.get('/materias/estudiante/horario/:idEstudiante', getHorarioEstudiante);    return router;
};