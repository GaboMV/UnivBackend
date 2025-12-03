const validationService = require('../utils/validationService');

module.exports = function(getDb) {
    
    // --- FUNCIONES AUXILIARES ---
    async function _enviarSolicitudInterna(idEstudiante, idParalelo, motivo) {
        const db = getDb();
        const result = await db.run(
            'INSERT INTO Solicitudes_Inscripcion (id_estudiante, id_paralelo, motivo, estado, fecha_solicitud) VALUES (?, ?, ?, ?, ?)',
            [idEstudiante, idParalelo, motivo, 'En Espera', new Date().toISOString()]
        );
        return result;
    }

    // --- RUTAS DE CONSULTA DE DATOS ACADÉMICOS ---
    async function getSemestresInscritos(req, res) {
        const { idEstudiante } = req.params;
        const sql = `SELECT DISTINCT S.id_semestre, S.nombre FROM Inscripciones AS I JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo JOIN Semestres AS S ON PS.id_semestre = S.id_semestre WHERE I.id_estudiante = ? ORDER BY S.nombre DESC;`;
        try {
            const db = getDb();
            const semestres = await db.all(sql, [idEstudiante]);
            res.json(semestres); 
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function getHistorialPorSemestre(req, res) {
        const { idEstudiante, idSemestre } = req.params;
        const sql = `SELECT M.nombre AS nombre_materia, I.estado AS estado, I.parcial1, I.parcial2, I.examen_final, I.segundo_turno FROM Inscripciones AS I JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo JOIN Materias AS M ON PS.id_materia = M.id_materia WHERE I.id_estudiante = ? AND PS.id_semestre = ?;`;
        try {
            const db = getDb();
            const historial = await db.all(sql, [idEstudiante, idSemestre]);
            res.json(historial); 
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function getHorarioEstudiante(req, res) {
        const { idEstudiante, nombreSemestre } = req.params;
        const nombreSemestreEscapado = decodeURIComponent(nombreSemestre); 
        const sql = `SELECT H.dia, H.hora_inicio, H.hora_fin, M.nombre AS materia_nombre, A.nombre AS aula_nombre, D.nombre AS docente_nombre, D.apellido AS docente_apellido FROM Inscripciones AS I JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo JOIN Semestres AS S ON PS.id_semestre = S.id_semestre JOIN Materias AS M ON PS.id_materia = M.id_materia LEFT JOIN Aulas AS A ON PS.id_aula = A.id_aula JOIN Docentes AS D ON PS.id_docente = D.id_docente JOIN Paralelo_Horario AS PH ON PS.id_paralelo = PH.id_paralelo JOIN Horarios AS H ON PH.id_horario = H.id_horario WHERE I.id_estudiante = ? AND S.nombre = ? AND I.estado = 'Cursando' ORDER BY CASE H.dia WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3 WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 WHEN 'Sábado' THEN 6 WHEN 'Domingo' THEN 7 END, H.hora_inicio;`;
        try {
            const db = getDb();
            const horario = await db.all(sql, [idEstudiante, nombreSemestreEscapado]);
            res.json(horario);
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    // --- RUTAS DE NOTIFICACIONES (LA PARTE NUEVA) ---
    
    // Obtiene las notificaciones guardadas en la tabla Notificaciones
    async function getNotificaciones(req, res) {
        const { idEstudiante } = req.params;
        const sql = `SELECT * FROM Notificaciones WHERE id_estudiante = ? ORDER BY fecha DESC;`;
        try {
            const db = getDb();
            const notificaciones = await db.all(sql, [idEstudiante]);
            res.json(notificaciones);
        } catch (error) {
            console.error('Error al obtener notificaciones:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    // Borra una notificación de la tabla
    async function borrarNotificacion(req, res) {
        const { idNotificacion } = req.params;
        try {
            const db = getDb();
            await db.run('DELETE FROM Notificaciones WHERE id_notificacion = ?', [idNotificacion]);
            res.json({ message: 'Notificación eliminada.' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar.' });
        }
    }

    // --- RUTAS DE ACCIÓN ---

    async function retirarMateria(req, res) {
        const { idEstudiante, idParalelo } = req.body; 
        try {
            const db = getDb();
            const result = await db.run('DELETE FROM Inscripciones WHERE id_estudiante = ? AND id_paralelo = ? AND estado = ?', [idEstudiante, idParalelo, 'Cursando']);
            if (result.changes === 0) return res.status(404).json({ error: 'Materia no encontrada.' });
            res.json({ message: 'Materia retirada exitosamente.' });
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function retirarSolicitud(req, res) {
        const { idEstudiante, idParalelo } = req.body;
        try {
            const db = getDb();
            const result = await db.run('DELETE FROM Solicitudes_Inscripcion WHERE id_estudiante = ? AND id_paralelo = ? AND estado = ?', [idEstudiante, idParalelo, 'En Espera']);
            if (result.changes === 0) return res.status(404).json({ error: 'Solicitud no encontrada.' });
            res.json({ message: 'Solicitud cancelada exitosamente.' });
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function enviarSolicitud(req, res) {
        const { idEstudiante, idParalelo, motivo } = req.body; 
        try {
            const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, motivo);
            res.status(201).json({ message: 'Solicitud enviada exitosamente.', id_solicitud: result.lastID });
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Solicitud ya existe.' });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function inscribirEstudiante(req, res) {
        const { idEstudiante, idParalelo, idMateria, idSemestreActual } = req.body;
        try {
            const db = getDb(); 
            if (await validationService.isEnrolledInSubject(db, idEstudiante, idMateria, idSemestreActual)) return res.status(409).json({ error: 'Ya estás inscrito en esta materia.' });
            if (await validationService.hasExistingSolicitation(db, idEstudiante, idMateria, idSemestreActual)) return res.status(409).json({ error: 'Ya tienes una solicitud pendiente.' });
            
            if (!await validationService.cumpleRequisitosParaMateria(db, idEstudiante, idMateria)) {
                const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, "Solicitud automática por requisitos");
                return res.status(202).json({ message: 'No cumples requisitos. Solicitud enviada.', id_solicitud: result.lastID });
            }
            if (await validationService.checkScheduleConflict(db, idEstudiante, idParalelo, idSemestreActual)) {
                const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, "Solicitud automática por choque");
                return res.status(202).json({ message: 'Choque de horario. Solicitud enviada.', id_solicitud: result.lastID });
            }
            const result = await db.run('INSERT INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)', [idEstudiante, idParalelo, 'Cursando', new Date().toISOString()]);
            res.status(201).json({ message: 'Inscripción exitosa.', id_inscripcion: result.lastID });
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Error de restricción.' });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    // --- RUTAS DE ADMIN ---
    async function getSolicitudesPendientes(req, res) {
        const sql = `SELECT S.id_solicitud as id, S.id_estudiante, S.id_paralelo, S.motivo, S.fecha_solicitud, E.nombre || ' ' || E.apellido as estudiante, M.nombre as materia, P.nombre_paralelo FROM Solicitudes_Inscripcion AS S JOIN Estudiantes AS E ON S.id_estudiante = E.id_estudiante JOIN Paralelos_Semestre AS P ON S.id_paralelo = P.id_paralelo JOIN Materias AS M ON P.id_materia = M.id_materia WHERE S.estado = 'En Espera' ORDER BY S.fecha_solicitud DESC;`;
        try {
            const db = getDb();
            const solicitudes = await db.all(sql);
            res.json(solicitudes);
        } catch (error) {
            res.status(500).json({ error: 'Error al cargar solicitudes' });
        }
    }

    async function resolverSolicitud(req, res) {
        const io = req.io; 
        const { id_solicitud, id_estudiante, materia, accion, id_paralelo } = req.body;
        const db = getDb();

        try {
            // 1. Actualizar solicitud (histórico)
            await db.run("UPDATE Solicitudes_Inscripcion SET estado = ?, fecha_respuesta = ? WHERE id_solicitud = ?", [accion, new Date().toISOString(), id_solicitud]);

            // 2. Si es aceptada, inscribir
            if (accion === 'Aceptada') {
                await db.run('INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)', [id_estudiante, id_paralelo, 'Cursando', new Date().toISOString()]);
            }

            // 3. ¡¡¡GUARDAR EN LA NUEVA TABLA NOTIFICACIONES!!!
            const titulo = accion === 'Aceptada' ? 'Solicitud Aceptada' : 'Solicitud Rechazada';
            const mensaje = accion === 'Aceptada' ? `Tu inscripción en ${materia} fue aprobada.` : `Tu solicitud para ${materia} fue rechazada.`;
            const tipo = accion === 'Aceptada' ? 'success' : 'error';
            
            await db.run(
                `INSERT INTO Notificaciones (id_estudiante, titulo, mensaje, fecha, tipo, id_paralelo_asociado) VALUES (?, ?, ?, ?, ?, ?)`,
                [id_estudiante, titulo, mensaje, new Date().toISOString(), tipo, id_paralelo]
            );

            // 4. Emitir Socket
            if (io) {
                io.to(`user_${id_estudiante}`).emit('nueva_notificacion', {
                    titulo: titulo, mensaje: mensaje, tipo: tipo, fecha: new Date().toISOString()
                });
            }

            res.json({ success: true, message: `Solicitud ${accion}` });
        } catch (error) {
            console.error('Error resolviendo:', error);
            res.status(500).json({ error: 'Error interno al resolver' });
        }
    }

    return {
        getSemestresInscritos, getHistorialPorSemestre, inscribirEstudiante, retirarMateria, enviarSolicitud, retirarSolicitud, getHorarioEstudiante, 
        getNotificaciones, borrarNotificacion, // Rutas para la App
        getSolicitudesPendientes, resolverSolicitud // Rutas para el Admin
    };
};