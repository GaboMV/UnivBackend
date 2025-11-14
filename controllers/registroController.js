// controllers/registroController.js
// (¡¡¡LA PUTA VERSIÓN FINAL CON LAS 6 REGLAS, CARAJO!!!)

/**
 * Crea los controladores de registro académico.
 * @param {Function} getDb - Función para obtener la instancia de la BD.
 */
module.exports = function(getDb) {
    
    // --- FUNCIONES DE VALIDACIÓN (Se quedan igual, carajo) ---
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
    // (Esta la borré en la versión anterior, ¡pero la necesitamos!)
    async function _hasExistingSolicitation(idEstudiante, idMateria, idSemestreActual) {
        const db = getDb();
        const sql = `
            SELECT SOL.id_solicitud
            FROM Solicitudes_Inscripcion AS SOL
            JOIN Paralelos_Semestre AS PS ON SOL.id_paralelo = PS.id_paralelo
            WHERE SOL.id_estudiante = ?
              AND PS.id_materia = ?
              AND PS.id_semestre = ?
              AND SOL.estado = 'En Espera'
            LIMIT 1;
        `;
        const result = await db.get(sql, [idEstudiante, idMateria, idSemestreActual]);
        return !!result;
    }
    async function _enviarSolicitudInterna(idEstudiante, idParalelo, motivo) {
        const db = getDb();
        const result = await db.run(
            'INSERT INTO Solicitudes_Inscripcion (id_estudiante, id_paralelo, motivo, estado, fecha_solicitud) VALUES (?, ?, ?, ?, ?)',
            [idEstudiante, idParalelo, motivo, 'En Espera', new Date().toISOString()]
        );
        return result;
    }

    // --- MANEJADORES DE RUTAS (ENDPOINTS) ---

    // (getSemestresInscritos, getHistorialPorSemestre, retirarMateria, retirarSolicitud, getHorarioEstudiante, enviarSolicitud...
    // ...TODAS ESAS MIERDAS SE QUEDAN IGUAL QUE ANTES, CARAJO)
    async function getSemestresInscritos(req, res) { /* ... (código igual) ... */ }
    async function getHistorialPorSemestre(req, res) { /* ... (código igual) ... */ }
    async function retirarMateria(req, res) { /* ... (código igual) ... */ }
    async function retirarSolicitud(req, res) { /* ... (código igual) ... */ }
    async function getHorarioEstudiante(req, res) { /* ... (código igual) ... */ }
    async function enviarSolicitud(req, res) { /* ... (código igual) ... */ }


    /**
     * POST /api/registro/inscribir
     * ¡¡¡LA PUTA LÓGICA DE MIERDA QUE ME PEDISTE, CARAJO!!!
     */
    async function inscribirEstudiante(req, res) {
        const { idEstudiante, idParalelo, idMateria, idSemestreActual } = req.body;
        if (!idEstudiante || !idParalelo || !idMateria || !idSemestreActual) {
            return res.status(400).json({ error: 'Faltan campos requeridos.' });
        }
        
        try {
            // REGLA 4: ¿Estás inscrito en otro paralelo? ¡A LA MIERDA!
            if (await isEnrolledInSubject(idEstudiante, idMateria, idSemestreActual)) {
                return res.status(409).json({ error: 'Ya estás inscrito en esta materia en otro paralelo.' });
            }
            
            // REGLA (EXTRA): ¿Ya tienes una solicitud PENDIENTE para esta materia? ¡A LA MIERDA!
            // (¡Esta es la que causó la cagada! La volvemos a poner)
            if (await _hasExistingSolicitation(idEstudiante, idMateria, idSemestreActual)) {
                return res.status(409).json({ error: 'Ya tienes una solicitud pendiente para esta materia. Cancela la solicitud original si quieres cambiar de paralelo.' });
            }

            // REGLA 2: ¿No cumples requisitos? ¡Es una SOLICITUD!
            if (!await cumpleRequisitosParaMateria(idEstudiante, idMateria)) {
                console.log(`LOG: No cumple requisitos. Estudiante ${idEstudiante}. Forzando solicitud...`);
                try {
                    const result = await _enviarSolicitudInterna(
                        idEstudiante, 
                        idParalelo, 
                        "Solicitud automática por requisitos pendientes"
                    );
                    return res.status(202).json({ // 202 = Aceptado (como solicitud)
                        message: 'No cumples los requisitos. Se ha enviado una solicitud.', 
                        id_solicitud: result.lastID 
                    });
                } catch (e) {
                     if (e.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Restricción ÚNICA fallida (ya tienes una solicitud para ESTE paralelo).' });
                    }
                    throw e;
                }
            }

            // REGLA 3: ¿Hay choque de horario? ¡Es una SOLICITUD!
            if (await checkScheduleConflict(idEstudiante, idParalelo, idSemestreActual)) {
                console.log(`LOG: Choque de horario detectado para Estudiante ${idEstudiante}. Forzando solicitud...`);
                try {
                    const result = await _enviarSolicitudInterna(
                        idEstudiante, 
                        idParalelo, 
                        "Solicitud automática por choque de horario"
                    );
                    return res.status(202).json({ // 202 = Aceptado (como solicitud)
                        message: '¡Choque de horario detectado! Se ha enviado una solicitud en tu nombre.', 
                        id_solicitud: result.lastID 
                    });
                } catch (e) {
                     if (e.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Restricción ÚNICA fallida (ya tienes una solicitud para ESTE paralelo).' });
                    }
                    throw e;
                }
            }

            // REGLA 1: ¡Pasaste toda la mierda! ¡INSCRITO, CARAJO!
            const db = getDb();
            const result = await db.run(
                'INSERT INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)',
                [idEstudiante, idParalelo, 'Cursando', new Date().toISOString()]
            );
            res.status(201).json({ // 201 = Creado
                message: 'Inscripción exitosa.', 
                id_inscripcion: result.lastID 
            });

        } catch (error) {
            console.error('Error en inscribirEstudiante:', error.message);
            if (error.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Restricción ÚNICA fallida (Error desconocido).' });
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
        // ... (el resto de funciones de validación)
        cumpleRequisitosParaMateria,
        isEnrolledInSubject,
        checkScheduleConflict,
        tieneMateriaAprobada,
        _hasExistingSolicitation // ¡La exportamos por si acaso, carajo!
    };
};