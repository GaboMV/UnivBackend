
module.exports = function(getDb, validationHelpers) {

   
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


    async function getParalelosDetalle(req, res) {
        const { idMateria, idEstudiante, idSemestreActual } = req.params;
        const db = getDb();

        try {
           
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
         
                let estadoEstudiante = 'ninguno'; // 0
                if (p.estado_inscripcion) {
                    if (p.estado_inscripcion === 'Cursando') {
                        estadoEstudiante = 'inscrito'; // 1
                    }
                  
                } else if (p.estado_solicitud) {
                    if (p.estado_solicitud === 'En Espera') {
                        estadoEstudiante = 'solicitado'; // 2
                    }
                }

              
                const paraleloSimple = {
                    idParalelo: p.id_paralelo,
                    nombreParalelo: p.nombre_paralelo,
                    docenteNombre: p.docente_nombre,
                    docenteApellido: p.docente_apellido,
                    aula: p.aula_nombre || 'Sin aula',
                    idMateria: p.id_materia,
                    creditos: p.creditos,
                    estadoEstudiante: estadoEstudiante, 
                };

               
                const horariosString = await getHorariosString(p.id_paralelo);

     
                paralelosDetalle.push({
                    paralelo: paraleloSimple,
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