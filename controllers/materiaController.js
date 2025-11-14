// controllers/materiaController.js
// (¡¡¡LA PUTA VERSIÓN LIMPIA, CARAJO!!!)

// ¡¡¡IMPORTA EL PUTO SERVICIO NUEVO!!!
const validationService = require('../utils/validationService');

/**
 * Crea los controladores de materia.
 * @param {Function} getDb - Función para obtener la instancia de la BD.
 */
module.exports = function(getDb) {

    // (getHorariosString y getRequisitosString se quedan igual, carajo)
    async function getHorariosString(idParalelo) {
        const db = getDb();
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

    // (getAllFacultades, searchMaterias, getMateriasByFacultad se quedan igual)
    async function getAllFacultades(req, res) { /* ... (código igual) ... */ }
    async function searchMaterias(req, res) { /* ... (código igual) ... */ }
    async function getMateriasByFacultad(req, res) { /* ... (código igual) ... */ }
    async function getMateriaById(req, res) { /* ... (código igual) ... */ }

    // (¡¡¡CIRUGÍA #3!!! Ahora usa el 'validationService')
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

            // ¡¡¡VALIDACIONES (AHORA USAN 'validationService' Y PASAN 'db'!!!)
            const requisitosString = await getRequisitosString(idMateria);
            const cumpleRequisitos = await validationService.cumpleRequisitosParaMateria(db, idEstudiante, idMateria);
            const yaInscritoEnMateria = await validationService.isEnrolledInSubject(db, idEstudiante, idMateria, idSemestreActual);
            const yaTieneSolicitud = await validationService.hasExistingSolicitation(db, idEstudiante, idMateria, idSemestreActual);
            
            const paralelosDetalle = [];
            for (const p of paralelosSimplesRaw) {
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
                
                const hayChoque = await validationService.checkScheduleConflict(db, idEstudiante, p.id_paralelo, idSemestreActual);
                const horariosString = await getHorariosString(p.id_paralelo);

                paralelosDetalle.push({
                    paralelo: p, 
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
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    // ¡¡¡EL PUTO RETURN!!!
    // ¡¡¡YA NO TIENE LA MIERDA QUE CAUSABA EL 'is not defined'!!!
    return {
        getAllFacultades,
        searchMaterias,
        getMateriasByFacultad,
        getParalelosDetalle,
        getMateriaById
    };
};