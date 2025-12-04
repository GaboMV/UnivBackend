// controllers/materiaController.js
// (¡¡¡LA PUTA VERSIÓN QUE ELIMINA DUPLICADOS, CARAJO!!!)

const validationService = require('../utils/validationService');

module.exports = function(getDb) {

    // --- FUNCIONES AUXILIARES ---
    async function getHorariosString(idParalelo) {
        const db = getDb();
        const sql = `
            SELECT H.dia, H.hora_inicio, H.hora_fin
            FROM Paralelo_Horario AS PH
            JOIN Horarios AS H ON PH.id_horario = H.id_horario
            WHERE PH.id_paralelo = ?
            ORDER BY 
                CASE H.dia WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3 WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 WHEN 'Sábado' THEN 6 WHEN 'Domingo' THEN 7 END, 
                H.hora_inicio; 
        `;
        const maps = await db.all(sql, [idParalelo]);
        if (maps.length === 0) return "";
        return maps.map(h => `${h.dia} ${h.hora_inicio}-${h.hora_fin}`).join(', ');
    }

    async function getRequisitosString(idMateria) {
        const db = getDb();
        const sql = `
            SELECT M.nombre FROM Requisitos AS R
            JOIN Materias AS M ON R.id_materia_previa = M.id_materia
            WHERE R.id_materia_cursar = ?;
        `;
        const maps = await db.all(sql, [idMateria]);
        if (maps.length === 0) return "";
        const nombres = maps.map(m => m.nombre).join(', ');
        return `Requiere: ${nombres}`;
    }

    // --- RUTAS GET ---
    async function getAllFacultades(req, res) {
        try {
            const db = getDb();
            const facultades = await db.all('SELECT * FROM Facultades');
            res.json(facultades);
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }
    async function searchMaterias(req, res) {
        const { query } = req.params;
        const searchTerm = `%${query}%`;
        try {
            const db = getDb();
            const materias = await db.all('SELECT * FROM Materias WHERE nombre LIKE ? OR codigo LIKE ?', [searchTerm, searchTerm]);
            res.json(materias);
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }
    async function getMateriasByFacultad(req, res) {
        const { idFacultad } = req.params;
        try {
            const db = getDb();
            const materias = await db.all('SELECT * FROM Materias WHERE id_facultad = ?', [idFacultad]);
            res.json(materias);
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }
    async function getMateriaById(req, res) {
        const { idMateria } = req.params;
        try {
            const db = getDb();
            const materia = await db.get('SELECT * FROM Materias WHERE id_materia = ?', [idMateria]);
            if (!materia) return res.status(404).json({ error: 'Materia no encontrada' });
            res.json(materia);
        } catch (error) {
            res.status(500).json({ error: 'Error interno.' });
        }
    }

    // --- RUTA PRINCIPAL DE PARALELOS (CON LA CORRECCIÓN DE DUPLICADOS) ---
    async function getParalelosDetalle(req, res) {
        const { idMateria, idEstudiante, idSemestreActual } = req.params;
        const db = getDb();

        try {
            // Esta consulta puede traer duplicados si hay historial de solicitudes (varias filas en Solicitudes_Inscripcion)
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

            // ¡¡¡AQUÍ ESTÁ LA PUTA MAGIA: DEDUPLICACIÓN!!!
            const paralelosUnicos = {};
            paralelosSimplesRaw.forEach(p => {
                if (!paralelosUnicos[p.id_paralelo]) {
                    // Si no existe, lo guardamos
                    paralelosUnicos[p.id_paralelo] = p;
                } else {
                    // Si ya existe, nos quedamos con el que tenga el estado ACTIVO
                    // (Priorizamos 'Cursando' o 'En Espera' sobre 'Rechazada' o null)
                    const actualEsActivo = paralelosUnicos[p.id_paralelo].estado_inscripcion === 'Cursando' || paralelosUnicos[p.id_paralelo].estado_solicitud === 'En Espera';
                    const nuevoEsActivo = p.estado_inscripcion === 'Cursando' || p.estado_solicitud === 'En Espera';
                    
                    if (!actualEsActivo && nuevoEsActivo) {
                        paralelosUnicos[p.id_paralelo] = p; // Reemplazamos la versión vieja con la activa
                    }
                }
            });

            // Convertimos el objeto de vuelta a lista
            const listaSinDuplicados = Object.values(paralelosUnicos);


            // Validaciones globales para la materia
            const requisitosString = await getRequisitosString(idMateria);
            const cumpleRequisitos = await validationService.cumpleRequisitosParaMateria(db, idEstudiante, idMateria);
            const yaInscritoEnMateria = await validationService.isEnrolledInSubject(db, idEstudiante, idMateria, idSemestreActual);
            const yaTieneSolicitud = await validationService.hasExistingSolicitation(db, idEstudiante, idMateria, idSemestreActual);
            
            const paralelosDetalle = [];

            // Iteramos sobre la lista limpia
            for (const p of listaSinDuplicados) {
                let estadoEstudiante = 'ninguno';
                
                // Definir estado
                if (p.estado_inscripcion === 'Cursando') {
                    estadoEstudiante = 'inscrito';
                } else if (p.estado_solicitud === 'En Espera') {
                    estadoEstudiante = 'solicitado';
                } else if (yaInscritoEnMateria) {
                    estadoEstudiante = 'inscrito_otro'; 
                } else if (yaTieneSolicitud) {
                    estadoEstudiante = 'solicitado_otro';
                }
                
                const hayChoque = await validationService.checkScheduleConflict(db, idEstudiante, p.id_paralelo, idSemestreActual);
                const horariosString = await getHorariosString(p.id_paralelo);

                paralelosDetalle.push({
                    paralelo: p, // Mandamos el objeto crudo, Flutter lo parsea con ParaleloSimple.fromMap
                    estado_calculado: estadoEstudiante,
                    horarios: horariosString,
                    requisitos: requisitosString,
                    cumpleRequisitos: cumpleRequisitos,
                    hayChoque: hayChoque,
                });
            }

            res.json(paralelosDetalle);

        } catch (error) {
            console.error('Error en getParalelosDetalle:', error.message);
            res.status(500).json({ error: 'Error interno.' });
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