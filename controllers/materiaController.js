module.exports = function(getDb, validationHelpers) {

    // --- FUNCIONES AUXILIARES (Traducción de MateriaRepository) ---

    /**
     * Obtiene los horarios formateados como string.
     * Emula: MateriaRepository.getHorariosString
     */
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
        
        // Formato: "Lunes 08:00-10:00, Miércoles 08:00-10:00"
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

    /**
     * GET /api/materia/facultades
     * Emula: MateriaRepository.getAllFacultades
     */
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

    /**
     * GET /api/materia/search/:query
     * Emula: MateriaRepository.searchMaterias
     */
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

    /**
     * GET /api/materia/by-facultad/:idFacultad
     * Emula: MateriaRepository.getMateriasByFacultad
     */
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
            // Emula: MateriaRepository.getParalelosConEstado
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

            // 2. Procesar y enriquecer (Emula ParaleloSimple.fromMap y ParaleloDetalleCompleto)
            
            // Obtenemos los requisitos UNA SOLA VEZ
            const requisitosString = await getRequisitosString(idMateria);
            // Verificamos si cumple requisitos UNA SOLA VEZ
            const cumpleRequisitos = await validationHelpers.cumpleRequisitosParaMateria(idEstudiante, idMateria);

            const paralelosDetalle = [];

            for (const p of paralelosSimplesRaw) {
                // Lógica de ParaleloSimple.fromMap para 'estadoEstudiante'
                let estadoEstudiante = 'ninguno'; // 0
                if (p.estado_inscripcion) {
                    if (p.estado_inscripcion === 'Cursando') {
                        estadoEstudiante = 'inscrito'; // 1
                    }
                    // FIX 1: 'Retirada' se trata como 'ninguno'
                } else if (p.estado_solicitud) {
                    if (p.estado_solicitud === 'En Espera') {
                        estadoEstudiante = 'solicitado'; // 2
                    }
                }

                // Ensamblamos el ParaleloSimple (adaptado a JS)
                const paraleloSimple = {
                    idParalelo: p.id_paralelo,
                    nombreParalelo: p.nombre_paralelo,
                    docenteNombre: p.docente_nombre,
                    docenteApellido: p.docente_apellido,
                    aula: p.aula_nombre || 'Sin aula',
                    idMateria: p.id_materia,
                    creditos: p.creditos,
                    estadoEstudiante: estadoEstudiante, // Usamos string en lugar de enum
                };

                // 3. Obtener horarios (Emula MateriaRepository.getHorariosString)
                const horariosString = await getHorariosString(p.id_paralelo);

                // 4. Ensamblar DTO Final (ParaleloDetalleCompleto)
                paralelosDetalle.push({
                    paralelo: paraleloSimple,
                    horarios: horariosString,
                    requisitos: requisitosString,
                    cumpleRequisitos: cumpleRequisitos,
                    // La lógica de 'textoBoton' y 'lecturaTts' se deja al cliente (Flutter)
                    // que ya tiene esa lógica implementada en el DTO.
                });
            }

            res.json(paralelosDetalle);

        } catch (error) {
            console.error('Error en getParalelosDetalle:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    return {
        getAllFacultades,
        searchMaterias,
        getMateriasByFacultad,
        getParalelosDetalle
    };
};