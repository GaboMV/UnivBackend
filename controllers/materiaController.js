// controllers/materiaController.js
// (¡¡¡LA PUTA VERSIÓN CORREGIDA CON SNAKE_CASE!!!)

/**
 * Crea los controladores de materia.
 * @param {Function} getDb - Función para obtener la instancia de la BD.
 * @param {Object} validationHelpers - Funciones de validación de registroController.
 */
module.exports = function(getDb, validationHelpers) {

    // ... (getHorariosString y getRequisitosString se quedan igual, carajo) ...
    async function getHorariosString(idParalelo) {
        const db = getDb();
        const sql = `
            SELECT H.dia, H.hora_inicio, H.hora_fin
            FROM Paralelo_Horario AS PH
            JOIN Horarios AS H ON PH.id_horario = H.id_horario
            WHERE PH.id_paralelo = ?
            ORDER BY H.dia; 
        `;
        const maps = await db.all(sql, [idParalelo]);
        if (maps.length === 0) return "";
        return maps.map(h => `${h.dia} ${h.hora_inicio}-${h.hora_fin}`).join(', ');
    }
    async function getRequisitosString(idMateria) {
        const db = getDb();
        const sql = `
            SELECT M.nombre
            FROM Requisitos AS R
            JOIN Materias AS M ON R.id_materia_previa = M.id_materia
            WHERE R.id_materia_cursar = ?;
        `;
        const maps = await db.all(sql, [idMateria]);
        if (maps.length === 0) return "";
        const nombres = maps.map(m => m.nombre).join(', ');
        return `Requiere: ${nombres}`;
    }

    // --- MANEJADORES de RUTAS (ENDPOINTS) ---
    // ... (getAllFacultades, searchMaterias, getMateriasByFacultad se quedan igual) ...
    async function getAllFacultades(req, res) {
        try {
            const db = getDb();
            const facultades = await db.all('SELECT * FROM Facultades');
            res.json(facultades);
        } catch (error) {
            console.error('Error al obtener facultades:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
    async function searchMaterias(req, res) {
        const { query } = req.params;
        const searchTerm = `%${query}%`;
        try {
            const db = getDb();
            const materias = await db.all(
                'SELECT * FROM Materias WHERE nombre LIKE ? OR codigo LIKE ?',
                [searchTerm, searchTerm]
            );
            res.json(materias);
        } catch (error) {
            console.error('Error en searchMaterias:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
    async function getMateriasByFacultad(req, res) {
        const { idFacultad } = req.params;
        try {
            const db = getDb();
            const materias = await db.all(
                'SELECT * FROM Materias WHERE id_facultad = ?',
                [idFacultad]
            );
            res.json(materias);
        } catch (error) {
            console.error('Error en getMateriasByFacultad:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    /**
     * GET /api/materia/paralelos/:idMateria/:idEstudiante/:idSemestreActual
     * Emula: MateriaRepository.getParalelosConEstado y ensambla ParaleloDetalleCompleto
     */
    async function getParalelosDetalle(req, res) {
        const { idMateria, idEstudiante, idSemestreActual } = req.params;
        const db = getDb();

        try {
            // 1. Obtener la lista base de paralelos con su estado (ParaleloSimple)
            const sqlParalelos = `
                SELECT 
                    PS.id_paralelo, PS.nombre_paralelo, PS.id_materia,
                    D.nombre AS docente_nombre, D.apellido AS docente_apellido,
                    A.nombre AS aula_nombre,
                    M.creditos,
                    I.estado AS estado_inscripcion,
                    SOL.estado AS estado_solicitud
                FROM Paralelos_Semestre AS PS
                JOIN Docentes AS D ON PS.id_docente = D.id_docente
                JOIN Materias AS M ON PS.id_materia = M.id_materia
                LEFT JOIN Aulas AS A ON PS.id_aula = A.id_aula
                LEFT JOIN Inscripciones AS I 
                    ON PS.id_paralelo = I.id_paralelo AND I.id_estudiante = ?
                LEFT JOIN Solicitudes_Inscripcion AS SOL
                    ON PS.id_paralelo = SOL.id_paralelo AND SOL.id_estudiante = ?
                WHERE 
                    PS.id_materia = ? AND PS.id_semestre = ?;
            `;
            
            // ¡¡¡AQUÍ LA DB NOS DA SNAKE_CASE!!! (Ej: 'id_paralelo')
            const paralelosSimplesRaw = await db.all(sqlParalelos, [
                idEstudiante,
                idEstudiante,
                idMateria,
                idSemestreActual
            ]);

            // 2. Procesar y enriquecer
            const requisitosString = await getRequisitosString(idMateria);
            const cumpleRequisitos = await validationHelpers.cumpleRequisitosParaMateria(idEstudiante, idMateria);
            const paralelosDetalle = [];

            for (const p of paralelosSimplesRaw) {
                let estadoEstudiante = 'ninguno';
                if (p.estado_inscripcion) {
                    if (p.estado_inscripcion === 'Cursando') estadoEstudiante = 'inscrito';
                } else if (p.estado_solicitud) {
                    if (p.estado_solicitud === 'En Espera') estadoEstudiante = 'solicitado';
                }

                // ¡¡¡LA PUTA CIRUGÍA ESTÁ AQUÍ, CARAJO!!!
                // ¡¡¡El backend ahora crea un objeto 'paralelo' que TIENE LAS MISMAS PUTAS CLAVES 'snake_case' que el SQL!!!
                // Tu 'ParaleloSimple.fromMap' ahora encontrará 'id_paralelo', no 'idParalelo'.
                const paraleloSimpleParaJSON = {
                    id_paralelo: p.id_paralelo, // <-- ARREGLADO
                    nombre_paralelo: p.nombre_paralelo, // <-- ARREGLADO
                    docente_nombre: p.docente_nombre, // <-- ARREGLADO
                    docente_apellido: p.docente_apellido, // <-- ARREGLADO
                    aula_nombre: p.aula_nombre || 'Sin aula', // <-- ARREGLADO (¡el ?? de tu Dart!)
                    id_materia: p.id_materia, // <-- ARREGLADO
                    creditos: p.creditos, // <-- ARREGLADO
                    estadoEstudiante: estadoEstudiante, // <-- Este es camelCase, ¡pero tu fromMap no lo usa! ¡Me vale verga!
                };
                
                // ¡¡¡ESPERA, CARAJO!!! Tu 'ParaleloSimple.fromMap' SÍ USA `estado_inscripcion` y `estado_solicitud`
                // ¡¡¡Tengo que mandar el objeto 'p' crudo!!!
                
                // ¡¡¡A LA MIERDA EL OBJETO NUEVO!!! ¡¡¡Mandemos el puto 'p'!!!
                // Tu 'ParaleloSimple.fromMap' espera 'id_paralelo', 'nombre_paralelo', 'docente_nombre', 'aula_nombre', 'creditos', 'estado_inscripcion', 'estado_solicitud'
                // ¡¡¡Y 'p' (el resultado del SQL) YA TIENE ESA PUTA MIERDA!!!
                
                const horariosString = await getHorariosString(p.id_paralelo);

                // 4. Ensamblar DTO Final (ParaleloDetalleCompleto)
                paralelosDetalle.push({
                    paralelo: p, // <-- ¡¡¡LA PUTA SOLUCIÓN!!! ¡MANDA EL 'p' CRUDO, CARAJO!
                    horarios: horariosString,
                    requisitos: requisitosString,
                    cumpleRequisitos: cumpleRequisitos,
                });
            }

            res.json(paralelosDetalle);

        } catch (error) {
            console.error('Error en getParalelosDetalle:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    /**
     * GET /api/materia/:idMateria
     * Emula: MateriaRepository.getMateriaById
     */
    async function getMateriaById(req, res) {
        const { idMateria } = req.params;
        try {
            const db = getDb();
            const materia = await db.get(
                'SELECT * FROM Materias WHERE id_materia = ?',
                [idMateria]
            );
            if (!materia) {
                return res.status(404).json({ error: 'Materia no encontrada' });
            }
            res.json(materia);
        } catch (error) {
            console.error('Error en getMateriaById:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    return {
        getAllFacultades,
        searchMaterias,
        getMateriasByFacultad,
        getParalelosDetalle,
        getMateriaById
    };
};