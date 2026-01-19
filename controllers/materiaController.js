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

    // --- RUTAS GET BÁSICAS ---
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

    // --- RUTA PRINCIPAL DE PARALELOS (CON CUPOS Y DEDUPLICACIÓN) ---
    async function getParalelosDetalle(req, res) {
        const { idMateria, idEstudiante, idSemestreActual } = req.params;
        const db = getDb();

        try {
            // 1. OBTENER DATOS RAW (Incluye cupo_maximo)
            const sqlParalelos = `
                SELECT 
                    PS.id_paralelo, PS.nombre_paralelo, PS.id_materia, 
                    PS.cupo_maximo, 
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

            // 2. DEDUPLICACIÓN (Limpieza de historial viejo)
            const paralelosUnicos = {};
            paralelosSimplesRaw.forEach(p => {
                if (!paralelosUnicos[p.id_paralelo]) {
                    paralelosUnicos[p.id_paralelo] = p;
                } else {
                    // Priorizamos el estado activo ('Cursando' o 'En Espera') sobre null o rechazado
                    const actualEsActivo = paralelosUnicos[p.id_paralelo].estado_inscripcion === 'Cursando' || paralelosUnicos[p.id_paralelo].estado_solicitud === 'En Espera';
                    const nuevoEsActivo = p.estado_inscripcion === 'Cursando' || p.estado_solicitud === 'En Espera';
                    
                    if (!actualEsActivo && nuevoEsActivo) {
                        paralelosUnicos[p.id_paralelo] = p; 
                    }
                }
            });
            const listaSinDuplicados = Object.values(paralelosUnicos);

            // 3. Validaciones Globales
            const requisitosString = await getRequisitosString(idMateria);
            const cumpleRequisitos = await validationService.cumpleRequisitosParaMateria(db, idEstudiante, idMateria);
            const yaInscritoEnMateria = await validationService.isEnrolledInSubject(db, idEstudiante, idMateria, idSemestreActual);
            const yaTieneSolicitud = await validationService.hasExistingSolicitation(db, idEstudiante, idMateria, idSemestreActual);
            
            const paralelosDetalle = [];

            // 4. Iteración para enriquecer datos (Cupos, Horarios, Estado)
            for (const p of listaSinDuplicados) {
                let estadoEstudiante = 'ninguno';
                
                if (p.estado_inscripcion === 'Cursando') {
                    estadoEstudiante = 'inscrito';
                } else if (p.estado_solicitud === 'En Espera') {
                    estadoEstudiante = 'solicitado';
                } else if (yaInscritoEnMateria) {
                    estadoEstudiante = 'inscrito_otro'; 
                } else if (yaTieneSolicitud) {
                    estadoEstudiante = 'solicitado_otro';
                }
                
                // Validar Choque
                const hayChoque = await validationService.checkScheduleConflict(db, idEstudiante, p.id_paralelo, idSemestreActual);
                
                // Obtener Horarios
                const horariosString = await getHorariosString(p.id_paralelo);

                // ¡¡¡CALCULAR CUPOS!!!
                const conteo = await db.get(
                    "SELECT COUNT(*) as total FROM Inscripciones WHERE id_paralelo = ? AND estado = 'Cursando'",
                    [p.id_paralelo]
                );
                const cuposOcupados = conteo.total;
                // Si es null, asumimos 30. Si viene de la DB, usamos ese.
                const cuposTotales = p.cupo_maximo !== null ? p.cupo_maximo : 30; 
                const estaLleno = cuposOcupados >= cuposTotales;

                paralelosDetalle.push({
                    paralelo: p, 
                    estado_calculado: estadoEstudiante,
                    horarios: horariosString,
                    requisitos: requisitosString,
                    cumpleRequisitos: cumpleRequisitos,
                    hayChoque: hayChoque,
                    // Datos nuevos para el frontend
                    cupos_totales: cuposTotales,
                    cupos_ocupados: cuposOcupados,
                    esta_lleno: estaLleno
                });
            }

            res.json(paralelosDetalle);

        } catch (error) {
            console.error('Error en getParalelosDetalle:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
        // --- NUEVA FUNCIÓN PARA EL HORARIO DEL ESTUDIANTE ---  
    }

      async function getHorarioEstudiante(req, res) {
        const { idEstudiante, nombreSemestre } = req.params;
        const db = getDb();

        try {
            const sql = `
                SELECT 
                    H.dia, 
                    H.hora_inicio, 
                    H.hora_fin,
                    M.nombre AS materia_nombre,
                    M.codigo AS materia_codigo,
                    A.nombre AS aula_nombre,
                    D.nombre AS docente_nombre, 
                    D.apellido AS docente_apellido
                FROM Inscripciones AS I
                JOIN Paralelos_Semestre AS PS ON I.id_paralelo = PS.id_paralelo
                JOIN Materias AS M ON PS.id_materia = M.id_materia
                JOIN Docentes AS D ON PS.id_docente = D.id_docente
                LEFT JOIN Aulas AS A ON PS.id_aula = A.id_aula
                JOIN Paralelo_Horario AS PH ON PS.id_paralelo = PH.id_paralelo
                JOIN Horarios AS H ON PH.id_horario = H.id_horario
                -- JOIN OPCIONAL SI NECESITAS FILTRAR POR NOMBRE DE SEMESTRE
                JOIN Semestres AS S ON PS.id_semestre = S.id_semestre
                WHERE 
                    I.id_estudiante = ? 
                    AND I.estado = 'Cursando' -- Solo lo que está cursando actualmente
                    AND S.nombre = ? -- Compara con el STRING "1-2024" etc.
                ORDER BY 
                    CASE H.dia 
                        WHEN 'Lunes' THEN 1 
                        WHEN 'Martes' THEN 2 
                        WHEN 'Miércoles' THEN 3 
                        WHEN 'Jueves' THEN 4 
                        WHEN 'Viernes' THEN 5 
                        WHEN 'Sábado' THEN 6 
                        ELSE 7 
                    END,
                    H.hora_inicio;
            `;

            // Ejecutamos la consulta
            const horario = await db.all(sql, [idEstudiante, nombreSemestre]);
            
            // Retornamos el JSON directo (Flutter lo espera así)
            res.json(horario);

        } catch (error) {
            console.error('Error en getHorarioEstudiante:', error);
            res.status(500).json({ error: 'Error al obtener el horario.' });
        }
    }

    return {
        getAllFacultades,
        searchMaterias,
        getMateriasByFacultad,
        getParalelosDetalle,
        getMateriaById,
        getHorarioEstudiante
    };
};