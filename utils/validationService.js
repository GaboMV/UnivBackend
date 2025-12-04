// utils/validationService.js
async function tieneMateriaAprobada(db, idEstudiante, idMateriaPrevia) {
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
async function cumpleRequisitosParaMateria(db, idEstudiante, idMateriaACursar) {
    const requisitos = await db.all(
        'SELECT id_materia_previa FROM Requisitos WHERE id_materia_cursar = ?',
        [idMateriaACursar]
    );
    if (requisitos.length === 0) return true; 
    for (const req of requisitos) {
        if (!await tieneMateriaAprobada(db, idEstudiante, req.id_materia_previa)) {
            return false;
        }
    }
    return true;
}
async function isEnrolledInSubject(db, idEstudiante, idMateria, idSemestreActual) {
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
async function checkScheduleConflict(db, idEstudiante, idParaleloNuevo, idSemestreActual) {
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
async function hasExistingSolicitation(db, idEstudiante, idMateria, idSemestreActual) {
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
async function isParaleloFull(db, idParalelo) {
    // 1. Obtener cupo máximo
    const paralelo = await db.get(
        "SELECT cupo_maximo FROM Paralelos_Semestre WHERE id_paralelo = ?", 
        [idParalelo]
    );
    if (!paralelo) return true; // Si no existe, asume que está lleno para no cagarla.

    // 2. Contar inscritos
    const conteo = await db.get(
        "SELECT COUNT(*) as total FROM Inscripciones WHERE id_paralelo = ? AND estado = 'Cursando'",
        [idParalelo]
    );
    
    // 3. Comparar
    return conteo.total >= paralelo.cupo_maximo;
}
module.exports = {
    tieneMateriaAprobada,
    cumpleRequisitosParaMateria,
    isEnrolledInSubject,
    checkScheduleConflict,
    hasExistingSolicitation ,
    isParaleloFull// <-- ¡LA PUTA CLAVE QUE FALTABA!
};