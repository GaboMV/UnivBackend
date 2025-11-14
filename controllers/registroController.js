// controllers/registroController.js
const validationService = require('../utils/validationService');

module.exports = function(getDb) {
    async function _enviarSolicitudInterna(idEstudiante, idParalelo, motivo) {
        const db = getDb();
        const result = await db.run(
            'INSERT INTO Solicitudes_Inscripcion (id_estudiante, id_paralelo, motivo, estado, fecha_solicitud) VALUES (?, ?, ?, ?, ?)',
            [idEstudiante, idParalelo, motivo, 'En Espera', new Date().toISOString()]
        );
        return result;
    }
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
    async function getHorarioEstudiante(req, res) {
        const { idEstudiante, nombreSemestre } = req.params;
        const nombreSemestreEscapado = decodeURIComponent(nombreSemestre); 
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
                I.estado = 'Cursando'
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
        try {
            const db = getDb();
            const horario = await db.all(sql, [idEstudiante, nombreSemestreEscapado]);
            res.json(horario);
        } catch (error) {
            console.error('Error en getHorarioEstudiante:', error.message);
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
    async function enviarSolicitud(req, res) {
        const { idEstudiante, idParalelo, motivo } = req.body; 
        if (!idEstudiante || !idParalelo || !motivo) {
            return res.status(400).json({ error: 'Faltan campos (idEstudiante, idParalelo, motivo).' });
        }
        try {
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
    async function inscribirEstudiante(req, res) {
        const { idEstudiante, idParalelo, idMateria, idSemestreActual } = req.body;
        if (!idEstudiante || !idParalelo || !idMateria || !idSemestreActual) {
            return res.status(400).json({ error: 'Faltan campos requeridos.' });
        }
        try {
            const db = getDb(); 
            if (await validationService.isEnrolledInSubject(db, idEstudiante, idMateria, idSemestreActual)) {
                return res.status(409).json({ error: 'Ya estás inscrito en esta materia en otro paralelo.' });
            }
            if (await validationService.hasExistingSolicitation(db, idEstudiante, idMateria, idSemestreActual)) {
                return res.status(409).json({ error: 'Ya tienes una solicitud pendiente para esta materia. Cancela la solicitud original si quieres cambiar de paralelo.' });
            }
            if (!await validationService.cumpleRequisitosParaMateria(db, idEstudiante, idMateria)) {
                console.log(`LOG: No cumple requisitos. Estudiante ${idEstudiante}. Forzando solicitud...`);
                try {
                    const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, "Solicitud automática por requisitos pendientes");
                    return res.status(202).json({
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
            if (await validationService.checkScheduleConflict(db, idEstudiante, idParalelo, idSemestreActual)) {
                console.log(`LOG: Choque de horario detectado para Estudiante ${idEstudiante}. Forzando solicitud...`);
                try {
                    const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, "Solicitud automática por choque de horario");
                    return res.status(202).json({
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
            const result = await db.run(
                'INSERT INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)',
                [idEstudiante, idParalelo, 'Cursando', new Date().toISOString()]
            );
            res.status(201).json({
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
    return {
        getSemestresInscritos,
        getHistorialPorSemestre,
        inscribirEstudiante,
        retirarMateria,
        enviarSolicitud,
        retirarSolicitud,
        getHorarioEstudiante
    };
};