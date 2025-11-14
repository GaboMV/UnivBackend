// routes/materiaRoutes.js
const express = require('express');
const router = express.Router();

module.exports = (materiaController) => {

    /**
     * @route GET /api/materia/facultades
     * @desc Obtiene todas las facultades.
     * @access Public
     */
    router.get('/facultades', materiaController.getAllFacultades);

    /**
     * @route GET /api/materia/search/:query
     * @desc Busca materias por nombre o código.
     * @access Public
     */
    router.get('/search/:query', materiaController.searchMaterias);

    /**
     * @route GET /api/materia/by-facultad/:idFacultad
     * @desc Obtiene materias por ID de facultad.
     * @access Public
     */
    router.get('/by-facultad/:idFacultad', materiaController.getMateriasByFacultad);

    /**
     * @route GET /api/materia/paralelos/:idMateria/:idEstudiante/:idSemestreActual
     * @desc Obtiene los paralelos detallados (DTO ParaleloDetalleCompleto) para una materia.
     * @access Private
     */
    router.get('/paralelos/:idMateria/:idEstudiante/:idSemestreActual', materiaController.getParalelosDetalle);

    return router;
};