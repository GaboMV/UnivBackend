// controllers/registroController.js
// (¡¡¡LA PUTA VERSIÓN COMPLETA, SIN ABREVIACIONES!!!)

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

    // --- LÓGICA DE SIMULACIÓN DE WORKER ---
    async function _simularDecisiones() {
        const db = getDb();
        try {
            const solicitud = await db.get(
                "SELECT * FROM Solicitudes_Inscripcion WHERE estado = 'En Espera' ORDER BY fecha_solicitud ASC LIMIT 1"
            );
            if (!solicitud) return;
            // 60% Aceptada
            const nuevoEstado = Math.random() > 0.4 ? 'Aceptada' : 'Rechazada'; 
            const motivo = nuevoEstado === 'Aceptada' ? "Aprobada por excepción" : "Criterios no cumplidos o cupo lleno.";

            await db.run(
                "UPDATE Solicitudes_Inscripcion SET estado = ?, motivo = ?, fecha_respuesta = ? WHERE id_solicitud = ?",
                [nuevoEstado, motivo, new Date().toISOString(), solicitud.id_solicitud]
            );
            console.log(`WORKER SIMULADO: [ID ${solicitud.id_solicitud}] -> ${nuevoEstado}.`);

            if (nuevoEstado === 'Aceptada') {
                await db.run(
                    'INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)',
                    [solicitud.id_estudiante, solicitud.id_paralelo, 'Cursando', new Date().toISOString()]
                );
            }
            // Guardar notificación automática (sin socket porque es simulado en background)
             const titulo = nuevoEstado === 'Aceptada' ? 'Solicitud Aceptada' : 'Solicitud Rechazada';
             const mensaje = nuevoEstado === 'Aceptada' ? `Tu solicitud automática fue aprobada.` : `Tu solicitud automática fue rechazada.`;
             const tipo = nuevoEstado === 'Aceptada' ? 'success' : 'error';
            await db.run(
                `INSERT INTO Notificaciones (id_estudiante, titulo, mensaje, fecha, leida, tipo, id_paralelo_asociado) VALUES (?, ?, ?, ?, 0, ?, ?)`,
                [solicitud.id_estudiante, titulo, mensaje, new Date().toISOString(), tipo, solicitud.id_paralelo]
            );

        } catch (e) {
            console.error("WORKER SIMULADO ERROR: ", e.message);
        }
    }


    // --- RUTAS DE CONSULTA BÁSICA ---
    async function getSemestresInscritos(req, res) {
        const { idEstudiante } = req.params;
        const sql = `
            SELECT DISTINCT S.id_semestre, S.nombre
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
            console.error('Error:', error.message);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function getHistorialPorSemestre(req, res) {
        const { idEstudiante, idSemestre } = req.params;
        const sql = `
            SELECT M.nombre AS nombre_materia, I.estado AS estado, I.parcial1, I.parcial2, I.examen_final, I.segundo_turno
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
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function getHorarioEstudiante(req, res) {
        const { idEstudiante, nombreSemestre } = req.params;
        const nombreSemestreEscapado = decodeURIComponent(nombreSemestre); 
        const sql = `
            SELECT H.dia, H.hora_inicio, H.hora_fin, M.nombre AS materia_nombre, A.nombre AS aula_nombre, D.nombre AS docente_nombre, D.apellido AS docente_apellido
            FROM Inscripciones AS I
            JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
            JOIN Semestres AS S ON PS.id_semestre = S.id_semestre
            JOIN Materias AS M ON PS.id_materia = M.id_materia
            LEFT JOIN Aulas AS A ON PS.id_aula = A.id_aula
            JOIN Docentes AS D ON PS.id_docente = D.id_docente
            JOIN Paralelo_Horario AS PH ON PS.id_paralelo = PH.id_paralelo
            JOIN Horarios AS H ON PH.id_horario = H.id_horario
            WHERE I.id_estudiante = ? AND S.nombre = ? AND I.estado = 'Cursando'
            ORDER BY CASE H.dia WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3 WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 WHEN 'Sábado' THEN 6 WHEN 'Domingo' THEN 7 END, H.hora_inicio;
        `;
        try {
            const db = getDb();
            const horario = await db.all(sql, [idEstudiante, nombreSemestreEscapado]);
            res.json(horario);
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
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
        if (!idEstudiante || !idParalelo || !idMateria || !idSemestreActual) return res.status(400).json({ error: 'Faltan campos.' });
        try {
            const db = getDb(); 
            if (await validationService.isEnrolledInSubject(db, idEstudiante, idMateria, idSemestreActual)) return res.status(409).json({ error: 'Ya estás inscrito en esta materia.' });
            // Eliminamos restricción de solicitud pendiente previa para permitir cambios
            
            if (!await validationService.cumpleRequisitosParaMateria(db, idEstudiante, idMateria)) {
                const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, "Solicitud automática por requisitos");
                return res.status(202).json({ message: 'No cumples requisitos. Solicitud enviada.', id_solicitud: result.lastID });
            }
            if (await validationService.checkScheduleConflict(db, idEstudiante, idParalelo, idSemestreActual)) {
                const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, "Solicitud automática por choque");
                return res.status(202).json({ message: 'Choque de horario. Solicitud enviada.', id_solicitud: result.lastID });
            }
            if (await validationService.isParaleloFull(db, idParalelo)) {
             console.log(`LOG: Paralelo ${idParalelo} lleno. Forzando solicitud...`);
             try {
                const result = await _enviarSolicitudInterna(idEstudiante, idParalelo, "Solicitud automática por cupos llenos");
                return res.status(202).json({ // 202 Accepted
                    message: 'El paralelo está lleno. Se ha enviado una solicitud de sobrecupo.', 
                    id_solicitud: result.lastID 
                });
            } catch (e) {
                 // manejo de error unique...
                 throw e;
            }
        }
            const result = await db.run('INSERT INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)', [idEstudiante, idParalelo, 'Cursando', new Date().toISOString()]);
            res.status(201).json({ message: 'Inscripción exitosa.', id_inscripcion: result.lastID });
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Error de restricción.' });
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    // --- RUTAS DE NOTIFICACIONES ---
    async function getNotificaciones(req, res) {
        const { idEstudiante } = req.params;
        // ¡¡¡SIMULACIÓN!!!
       // await _simularDecisiones();
        
        const sql = `SELECT * FROM Notificaciones WHERE id_estudiante = ? ORDER BY fecha DESC;`;
        try {
            const db = getDb();
            const notificaciones = await db.all(sql, [idEstudiante]);
            res.json(notificaciones);
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }

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

    // --- RUTAS DE ADMIN ---
    async function getSolicitudesPendientes(req, res) {
        const sql = `
            SELECT S.id_solicitud as id, S.id_estudiante, S.id_paralelo, S.motivo, S.fecha_solicitud, 
            E.nombre || ' ' || E.apellido as estudiante, M.nombre as materia, P.nombre_paralelo 
            FROM Solicitudes_Inscripcion AS S 
            JOIN Estudiantes AS E ON S.id_estudiante = E.id_estudiante 
            JOIN Paralelos_Semestre AS P ON S.id_paralelo = P.id_paralelo 
            JOIN Materias AS M ON P.id_materia = M.id_materia 
            WHERE S.estado = 'En Espera' ORDER BY S.fecha_solicitud DESC;`;
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
            await db.run("UPDATE Solicitudes_Inscripcion SET estado = ?, fecha_respuesta = ? WHERE id_solicitud = ?", [accion, new Date().toISOString(), id_solicitud]);
            
            if (accion === 'Aceptada') {
                await db.run('INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (?, ?, ?, ?)', [id_estudiante, id_paralelo, 'Cursando', new Date().toISOString()]);
            }
            
            const titulo = accion === 'Aceptada' ? 'Solicitud Aceptada' : 'Solicitud Rechazada';
            const mensaje = accion === 'Aceptada' ? `Tu inscripción en ${materia} fue aprobada.` : `Tu solicitud para ${materia} fue rechazada.`;
            const tipo = accion === 'Aceptada' ? 'success' : 'error';
            
            await db.run(
                `INSERT INTO Notificaciones (id_estudiante, titulo, mensaje, fecha, leida, tipo, id_paralelo_asociado) VALUES (?, ?, ?, ?, 0, ?, ?)`,
                [id_estudiante, titulo, mensaje, new Date().toISOString(), tipo, id_paralelo]
            );
            
            if (io) {
                io.to(`user_${id_estudiante}`).emit('nueva_notificacion', { titulo, mensaje, tipo, fecha: new Date().toISOString() });
            }
            res.json({ success: true, message: `Solicitud ${accion}` });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function enviarAnuncioGlobal(req, res) {
        const io = req.io;
        const { titulo, mensaje } = req.body;
        const db = getDb();
        try {
            const estudiantes = await db.all("SELECT id_estudiante FROM Estudiantes");
            const fecha = new Date().toISOString();
            await db.run("BEGIN TRANSACTION");
            for (const est of estudiantes) {
                await db.run(`INSERT INTO Notificaciones (id_estudiante, titulo, mensaje, fecha, leida, tipo, id_paralelo_asociado) VALUES (?, ?, ?, ?, 0, 'info', NULL)`, [est.id_estudiante, titulo, mensaje, fecha]);
            }
            await db.run("COMMIT");
            if (io) io.emit('nueva_notificacion', { titulo, mensaje, tipo: 'info', fecha });
            res.json({ success: true, message: `Enviado a ${estudiantes.length} estudiantes.` });
        } catch (error) {
            if (db) await db.run("ROLLBACK");
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    async function getEstadoInscripciones(req, res) {
        try {
            const db = getDb();
            const config = await db.get("SELECT valor FROM Sistema WHERE clave = 'inscripciones_activas'");
            // Si no existe, asumimos true (abierto)
            const activas = config ? config.valor === 'true' : true;
            res.json({ inscripciones_activas: activas });
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener estado.' });
        }
    }

    async function toggleInscripciones(req, res) {
        const io = req.io;
        const db = getDb();
        try {
            // 1. Obtener estado actual
            const config = await db.get("SELECT valor FROM Sistema WHERE clave = 'inscripciones_activas'");
            const estadoActual = config ? config.valor === 'true' : true;
            const nuevoEstado = !estadoActual; // Invertir

            // 2. Actualizar DB
            await db.run("INSERT OR REPLACE INTO Sistema (clave, valor) VALUES ('inscripciones_activas', ?)", [nuevoEstado.toString()]);

            // 3. 🔥 GRITAR POR SOCKET GLOBALMENTE
            if (io) {
                io.emit('cambio_estado_sistema', { inscripciones_activas: nuevoEstado });
            }

            res.json({ success: true, inscripciones_activas: nuevoEstado });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error al cambiar estado.' });
        }
    }

    return {
        getSemestresInscritos, getHistorialPorSemestre, inscribirEstudiante,
        retirarMateria, enviarSolicitud, retirarSolicitud, getHorarioEstudiante,
        getNotificaciones, borrarNotificacion, // Rutas App
        getSolicitudesPendientes, resolverSolicitud, enviarAnuncioGlobal ,
        getEstadoInscripciones, toggleInscripciones// Rutas Admin
    };
};