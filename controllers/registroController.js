// controllers/registroController.js
// (¡¡¡LA PUTA VERSIÓN CORREGIDA CON INSCRIPCIÓN INTELIGENTE!!!)

/**
 * Crea los controladores de registro académico.
 * @param {Function} getDb - Función para obtener la instancia de la BD.
 */
module.exports = function(getDb) {
    
    // --- FUNCIONES DE VALIDACIÓN (¡Se quedan igual, carajo!) ---
    async function tieneMateriaAprobada(idEstudiante, idMateriaPrevia) {
        const db = getDb();
        const result = await db.get(
            `SELECT I.estado
             FROM Inscripciones AS I
             JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
             WHERE I.id_estudiante = ? AND PS.id_materia = ? AND I.estado = 'Aprobada'
             LIMIT 1`,
            [idEstudiante, idMateriaPrevia]
        );
        return !!result;
    }
    async function cumpleRequisitosParaMateria(idEstudiante, idMateriaACursar) {
        const db = getDb();
        const requisitos = await db.all(
            'SELECT id_materia_previa FROM Requisitos WHERE id_materia_cursar = ?',
            [idMateriaACursar]
        );
        if (requisitos.length === 0) return true; 
        for (const req of requisitos) {
            if (!await tieneMateriaAprobada(idEstudiante, req.id_materia_previa)) {
                return false;
            }
        }
        return true;
    }
    async function isEnrolledInSubject(idEstudiante, idMateria, idSemestreActual) {
        const db = getDb();
        const sql = `
            SELECT I.id_inscripcion
            FROM Inscripciones AS I
            JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
            WHERE I.id_estudiante = ? 
              AND PS.id_materia = ?
              AND PS.id_semestre = ?
              AND I.estado = 'Cursando'
            LIMIT 1;
        `;
        const result = await db.get(sql, [idEstudiante, idMateria, idSemestreActual]);
        return !!result;
    }
    async function checkScheduleConflict(idEstudiante, idParaleloNuevo, idSemestreActual) {
        const db = getDb();
        const nuevosHorariosMap = await db.all(
            'SELECT id_horario FROM Paralelo_Horario WHERE id_paralelo = ?',
            [idParaleloNuevo]
        );
        const nuevosHorariosIds = nuevosHorariosMap.map(h => h.id_horario);
        if (nuevosHorariosIds.length === 0) return false; 
        const sqlInscritos = `
            SELECT PH.id_horario
            FROM Inscripciones AS I
            JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
            JOIN Paralelo_Horario AS PH ON PS.id_paralelo = PH.id_paralelo
            WHERE I.id_estudiante = ? 
              AND PS.id_semestre = ? 
              AND I.estado = 'Cursando';
        `;
        const inscritosHorariosMap = await db.all(sqlInscritos, [idEstudiante, idSemestreActual]);
        const inscritosHorariosIds = inscritosHorariosMap.map(h => h.id_horario);
        if (inscritosHorariosIds.length === 0) return false; 
        const inscritosSet = new Set(inscritosHorariosIds);
        const hayChoque = nuevosHorariosIds.some(id => inscritosSet.has(id));
        return hayChoque;
    }

    // ¡¡¡NUEVA FUNCIÓN AUXILIAR, CARAJO!!!
    // (Movimos la lógica de 'enviarSolicitud' aquí para reutilizarla)
    async function _enviarSolicitudInterna(idEstudiante, idParalelo, motivo) {
        const db = getDb();
        const result = await db.run(
            'INSERT INTO Solicitudes_Inscripcion (id_estudiante, id_paralelo, motivo, estado, fecha_solicitud) VALUES (?, ?, ?, ?, ?)',
            [idEstudiante, idParalelo, motivo, 'En Espera', new Date().toISOString()]
        );
        return result;
    }


    // --- MANEJADORES DE RUTAS (ENDPOINTS) ---

    // (getSemestresInscritos, getHistorialPorSemestre, retirarMateria, retirarSolicitud se quedan igual)
    async function getSemestresInscritos(req, res) {
        const { idEstudiante } = req.params;
        const sql = `
            SELECT DISTINCT 
                S.id_semestre, S.nombre
            FROM Inscripciones AS I
            JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
            JOIN Semestres AS S ON PS.id_semestre = S.id_semestre
            WHERE I.id_estudiante = ?
            ORDER BY S.nombre DESC; 
        `;
        try {
            const db = getDb();
            const semestres = await db.all(sql, [idEstudiante]);
            res.json(semestres); 
        } catch (error) {
            console.error('Error al obtener semestres inscritos:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
    async function getHistorialPorSemestre(req, res) {
        const { idEstudiante, idSemestre } = req.params;
        const sql = `
            SELECT 
                M.nombre AS nombre_materia,
                I.estado AS estado, 
                I.parcial1, I.parcial2, I.examen_final, I.segundo_turno
            FROM Inscripciones AS I
            JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
            JOIN Materias AS M ON PS.id_materia = M.id_materia
            WHERE I.id_estudiante = ? AND PS.id_semestre = ?;
        `;
        try {
            const db = getDb();
            const historial = await db.all(sql, [idEstudiante, idSemestre]);
            res.json(historial); 
        } catch (error) {
            console.error('Error al obtener historial por semestre:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
    async function retirarMateria(req, res) {
        const { idEstudiante, idParalelo } = req.body; 
        if (!idEstudiante || !idParalelo) {
            return res.status(400).json({ error: 'Faltan campos (idEstudiante, idParalelo).' });
        }
        try {
            const db = getDb();
            const result = await db.run(
                'DELETE FROM Inscripciones WHERE id_estudiante = ? AND id_paralelo = ? AND estado = ?',
                [idEstudiante, idParalelo, 'Cursando']
            );
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Materia no encontrada o no está en estado "Cursando".' });
            }
            res.json({ message: 'Materia retirada exitosamente.' });
        } catch (error) {
            console.error('Error en retirarMateria:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
    async function retirarSolicitud(req, res) {
        const { idEstudiante, idParalelo } = req.body;
        if (!idEstudiante || !idParalelo) {
            return res.status(400).json({ error: 'Faltan campos (idEstudiante, idParalelo).' });
        }
        try {
            const db = getDb();
            const result = await db.run(
                'DELETE FROM Solicitudes_Inscripcion WHERE id_estudiante = ? AND id_paralelo = ? AND estado = ?',
                [idEstudiante, idParalelo, 'En Espera']
            );
            if (result.changes === 0) {
                return res.status(404).json({ error: 'Solicitud no encontrada o no está "En Espera".' });
            }
            res.json({ message: 'Solicitud cancelada exitosamente.' });
        } catch (error) {
            console.error('Error en retirarSolicitud:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
    async function getHorarioEstudiante(req, res) {
        const { idEstudiante, nombreSemestre } = req.params;
        const nombreSemestreEscapado = decodeURIComponent(nombreSemestre); // Decodifica el nombre
        const sql = `
            SELECT 
                H.dia, H.hora_inicio, H.hora_fin, 
                M.nombre AS materia_nombre, 
                A.nombre AS aula_nombre, 
                D.nombre AS docente_nombre,
                D.apellido AS docente_apellido
            FROM Inscripciones AS I
            JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
            JOIN Semestres AS S ON PS.id_semestre = S.id_semestre
            JOIN Materias AS M ON PS.id_materia = M.id_materia
            LEFT JOIN Aulas AS A ON PS.id_aula = A.id_aula
            JOIN Docentes AS D ON PS.id_docente = D.id_docente
            JOIN Paralelo_Horario AS PH ON PS.id_paralelo = PH.id_paralelo
            JOIN Horarios AS H ON PH.id_horario = H.id_horario
            WHERE 
                I.id_estudiante = ? AND
                S.nombre = ? AND
                I.estado = 'Cursando';
        `;
        try {
            const db = getDb();
            const horario = await db.all(sql, [idEstudiante, nombreSemestreEscapado]);
            res.json(horario);
        } catch (error) {
            console.error('Error en getHorarioEstudiante:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    /**
     * POST /api/registro/solicitud/enviar
     * (Este ahora solo lo puede llamar el estudiante DIRECTAMENTE)
     */
    async function enviarSolicitud(req, res) {
        const { idEstudiante, idParalelo, motivo } = req.body; 
        if (!idEstudiante || !idParalelo || !motivo) {
            return res.status(400).json({ error: 'Faltan campos (idEstudiante, idParalelo, motivo).' });
        }
        try {
            // ¡Llama a la función interna, carajo!
            const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, motivo);
            res.status(201).json({ 
                message: 'Solicitud enviada exitosamente.', 
                id_solicitud: result.lastID
            });
        } catch (error) {
            console.error('Error en enviarSolicitud:', error.message);
            if (error.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Restricción ÚNICA fallida (ya inscrito o solicitud pendiente).' });
            }
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    /**
     * POST /api/registro/inscribir
     * ¡¡¡LA PUTA CIRUGÍA PRINCIPAL ESTÁ AQUÍ!!!
     */
    async function inscribirEstudiante(req, res) {
        const { idEstudiante, idParalelo, idMateria, idSemestreActual } = req.body;
        if (!idEstudiante || !idParalelo || !idMateria || !idSemestreActual) {
            return res.status(400).json({ error: 'Faltan campos requeridos (idEstudiante, idParalelo, idMateria, idSemestreActual).' });
        }
        
        try {
            // 1. Validar si ya está inscrito en la misma materia (¡Esto sigue siendo un error duro!)
            if (await isEnrolledInSubject(idEstudiante, idMateria, idSemestreActual)) {
                return res.status(409).json({ error: 'Ya está inscrito en otro paralelo de esta materia.' });
            }

            // 2. Validar requisitos (¡Esto sigue siendo un error duro!)
            if (!await cumpleRequisitosParaMateria(idEstudiante, idMateria)) {
                return res.status(403).json({ error: 'No cumple los requisitos. Debe enviar una solicitud.' });
            }

            // ¡¡¡LA PUTA LÓGICA NUEVA, CARAJO!!!
            // 3. Validar choque de horario
            if (await checkScheduleConflict(idEstudiante, idParalelo, idSemestreActual)) {
                // ¡¡¡HAY UN PUTO CHOQUE!!!
                // ¡A la mierda el 409! ¡Vamos a enviar una solicitud en su lugar!
                console.log(`LOG: Choque de horario detectado para Estudiante ${idEstudiante}. Forzando solicitud...`);
                
                try {
                    // ¡Llamamos a la función interna, carajo!
                    const result = await _enviarSolicitudInterna(
                        idEstudiante, 
                        idParalelo, 
                        "Solicitud automática por choque de horario"
                    );
                    
                    // ¡Devolvemos un 202 (Aceptado) que significa "OK, pero no es una inscripción, es una solicitud"
                    return res.status(202).json({ 
                        message: '¡Choque de horario detectado! Se ha enviado una solicitud en tu nombre.', 
                        id_solicitud: result.lastID 
                    });
                
                } catch (solicitudError) {
                     // Si la solicitud falla (ej: ya había una solicitud)
                    if (solicitudError.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Restricción ÚNICA fallida (ya inscrito o solicitud pendiente).' });
                    }
                    throw solicitudError; // Lanza el error interno
                }
            }

            // 4. ¡¡¡NO HAY CHOQUE!!! ¡Inscribir a la mierda!
            const db = getDb();
            const result = await db.run(
                'INSERT INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)',
                [idEstudiante, idParalelo, 'Cursando', new Date().toISOString()]
            );

            // ¡¡¡Devolvemos 201 (Creado)!!!
            res.status(201).json({ 
                message: 'Inscripción exitosa.', 
                id_inscripcion: result.lastID 
            });

        } catch (error) {
            console.error('Error en inscribirEstudiante:', error.message);
            if (error.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Restricción ÚNICA fallida (ya inscrito o solicitud pendiente).' });
            }
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    // ¡¡¡EL PUTO RETURN!!!
    return {
        getSemestresInscritos,
        getHistorialPorSemestre,
        inscribirEstudiante,
        retirarMateria,
        enviarSolicitud,
        retirarSolicitud,
        getHorarioEstudiante,
        cumpleRequisitosParaMateria,
        isEnrolledInSubject,
        checkScheduleConflict,
        tieneMateriaAprobada
    };
};