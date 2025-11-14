// controllers/materiaController.js
// (¡¡¡LA PUTA VERSIÓN CORREGIDA CON HORAS ORDENADAS!!!)

/**
 * Crea los controladores de materia.
 * @param {Function} getDb - Función para obtener la instancia de la BD.
 * @param {Object} validationHelpers - Funciones de validación de registroController.
 */
module.exports = function(getDb, validationHelpers) {

    // --- FUNCIONES AUXILIARES ---

    /**
     * Obtiene los horarios formateados como string.
     * Emula: MateriaRepository.getHorariosString
     */
    async function getHorariosString(idParalelo) {
        const db = getDb();
        
        // ¡¡¡LA PUTA CIRUGÍA ESTÁ AQUÍ, CARAJO!!!
        // ¡Añadí 'ORDER BY H.dia, H.hora_inicio'!
        const sql = `
            SELECT H.dia, H.hora_inicio, H.hora_fin
            FROM Paralelo_Horario AS PH
            JOIN Horarios AS H ON PH.id_horario = H.id_horario
            WHERE PH.id_paralelo = ?
            ORDER BY 
                CASE H.dia
                    WHEN 'Lunes' THEN 1
                    WHEN 'Martes' THEN 2
                    WHEN 'Miércoles' THEN 3
                    WHEN 'Jueves' THEN 4
                    WHEN 'Viernes' THEN 5
                    WHEN 'Sábado' THEN 6
                    WHEN 'Domingo' THEN 7
                END, 
                H.hora_inicio; 
        `;
        // (Ese CASE de mierda es para que ordene los días bien, no alfabéticamente)
        
        const maps = await db.all(sql, [idParalelo]);
        if (maps.length === 0) return "";
        // ¡Ahora esta mierda saldrá ordenada!
        return maps.map(h => `${h.dia} ${h.hora_inicio}-${h.hora_fin}`).join(', ');
    }

    /**
     * Obtiene los requisitos formateados como string.
     * Emula: MateriaRepository.getRequisitosString
     */
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

    // (getAllFacultades, searchMaterias, getMateriasByFacultad están bien, carajo)
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
            // (Esta consulta SQL está bien, carajo)
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
            
            const paralelosSimplesRaw = await db.all(sqlParalelos, [
                idEstudiante,
                idEstudiante,
                idMateria,
                idSemestreActual
            ]);

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
                
                // ¡Esta mierda ahora llamará a la función de horarios ORDENADA!
                const horariosString = await getHorariosString(p.id_paralelo);

                paralelosDetalle.push({
                    paralelo: p, // ¡Mandamos el 'p' crudo para que 'fromMap' funcione!
                    horarios: horariosString, // ¡Ahora ordenado!
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
        // (Este estaba bien, carajo)
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