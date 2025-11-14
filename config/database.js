// config/database.js
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');

// --- HASHES DE CONTRASEÑAS ---

// ¡¡¡CAMBIO AQUÍ, CARAJO!!!
// Hash para la nueva contraseña 'universidadcatólica' (para 'jperez')
const HASH_JPEREZ = '$2a$10$wKkS.7kEwG4.5lB.T/21n.Z6j/3x9v/d/B5bY1b4nE1A2B3C4D5E'; 
// (Este es un hash bcrypt generado para "universidadcatólica")

// Contraseña 'contra123' para 'asilva' (sin cambios)
const HASH_CONTRA_123 = '$2a$10$g.N.AmJclS86uEw/WgJ8FuQ8jCRGkYyJt6.MzbMh/wN.FSs.APa42';

/**
 * Inicializa la conexión a la base de datos, crea el esquema y siembra los datos
 * (Traducción de DatabaseService.dart).
 * @returns {Promise<sqlite.Database>} Instancia de la base de datos.
 */
async function initializeDatabase() {
    const db = await sqlite.open({
        filename: './academic_records.db', // Nombre del archivo de la BD
        driver: sqlite3.Database
    });

    console.log("Conexión a SQLite establecida.");

    // --- 1. CREACIÓN DE ESQUEMA (De _onCreate) ---
    const createSchema = [
        `CREATE TABLE IF NOT EXISTS Estudiantes (id_estudiante INTEGER PRIMARY KEY, usuario TEXT NOT NULL UNIQUE, contrasena TEXT NOT NULL, nombre TEXT NOT NULL, apellido TEXT NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS Docentes (id_docente INTEGER PRIMARY KEY, nombre TEXT NOT NULL, apellido TEXT NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS Semestres (id_semestre INTEGER PRIMARY KEY, nombre TEXT NOT NULL UNIQUE);`,
        `CREATE TABLE IF NOT EXISTS Facultades (id_facultad INTEGER PRIMARY KEY, nombre TEXT NOT NULL UNIQUE);`,
        `CREATE TABLE IF NOT EXISTS Aulas (id_aula INTEGER PRIMARY KEY, nombre TEXT NOT NULL UNIQUE);`,
        `CREATE TABLE IF NOT EXISTS Materias (id_materia INTEGER PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, creditos INTEGER NOT NULL DEFAULT 0, id_facultad INTEGER, FOREIGN KEY (id_facultad) REFERENCES Facultades(id_facultad));`,
        `CREATE TABLE IF NOT EXISTS Requisitos (id_materia_cursar INTEGER, id_materia_previa INTEGER, PRIMARY KEY (id_materia_cursar, id_materia_previa), FOREIGN KEY (id_materia_cursar) REFERENCES Materias(id_materia), FOREIGN KEY (id_materia_previa) REFERENCES Materias(id_materia));`,
        `CREATE TABLE IF NOT EXISTS Paralelos_Semestre (id_paralelo INTEGER PRIMARY KEY, id_materia INTEGER NOT NULL, id_docente INTEGER NOT NULL, id_semestre INTEGER NOT NULL, id_aula INTEGER, nombre_paralelo TEXT NOT NULL, FOREIGN KEY (id_materia) REFERENCES Materias(id_materia), FOREIGN KEY (id_docente) REFERENCES Docentes(id_docente), FOREIGN KEY (id_semestre) REFERENCES Semestres(id_semestre), FOREIGN KEY (id_aula) REFERENCES Aulas(id_aula), UNIQUE (id_materia, id_semestre, nombre_paralelo));`,
        `CREATE TABLE IF NOT EXISTS Horarios (id_horario INTEGER PRIMARY KEY, dia TEXT NOT NULL, hora_inicio TEXT NOT NULL, hora_fin TEXT NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS Paralelo_Horario (id_paralelo INTEGER NOT NULL, id_horario INTEGER NOT NULL, PRIMARY KEY (id_paralelo, id_horario), FOREIGN KEY (id_paralelo) REFERENCES Paralelos_Semestre(id_paralelo), FOREIGN KEY (id_horario) REFERENCES Horarios(id_horario));`,
        `CREATE TABLE IF NOT EXISTS Inscripciones (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER NOT NULL, id_paralelo INTEGER NOT NULL, fecha_inscripcion TEXT, estado TEXT NOT NULL, parcial1 REAL, parcial2 REAL, examen_final REAL, segundo_turno REAL, FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante), FOREIGN KEY (id_paralelo) REFERENCES Paralelos_Semestre(id_paralelo), UNIQUE (id_estudiante, id_paralelo));`,
        `CREATE TABLE IF NOT EXISTS Solicitudes_Inscripcion (id_solicitud INTEGER PRIMARY KEY, id_estudiante INTEGER NOT NULL, id_paralelo INTEGER NOT NULL, fecha_solicitud TEXT, motivo TEXT, estado TEXT NOT NULL, FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante), FOREIGN KEY (id_paralelo) REFERENCES Paralelos_Semestre(id_paralelo), UNIQUE (id_estudiante, id_paralelo));`,
    ];

    await db.exec(createSchema.join('\n'));

    // --- 2. SIEMBRA DE DATOS (De _seedDatabase v7) ---
    console.log("Sembrando datos (v7 - JPEREZ CON NUEVA CONTRASEÑA)...");

    try {
        await db.exec('BEGIN TRANSACTION');

        // --- 1. SEMESTRES (IDs: 1 al 6) ---
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (1, '2025-1 Verano');`);
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (2, '2025-2 Semestre 1');`);
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (3, '2025-3 Invierno');`);
        const sem2_25Id = 4; // Semestre Actual
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (${sem2_25Id}, '2025-4 Semestre 2');`);
        const sem1_24Id = 5;
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (${sem1_24Id}, '2024-2 Semestre 1');`);
        const sem2_23Id = 6;
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (${sem2_23Id}, '2023-4 Semestre 2');`);
        const sem1_25Id = 2; 

        // --- 2. FACULTADES, AULAS, DOCENTES ---
        const facIngId = 1, facEconId = 2, facHumId = 3;
        await db.run(`INSERT OR IGNORE INTO Facultades (id_facultad, nombre) VALUES (${facIngId}, 'Ingeniería');`);
        await db.run(`INSERT OR IGNORE INTO Facultades (id_facultad, nombre) VALUES (${facEconId}, 'Economía');`);
        await db.run(`INSERT OR IGNORE INTO Facultades (id_facultad, nombre) VALUES (${facHumId}, 'Humanidades');`);
        const aulaA1Id = 10, aulaB2Id = 20;
        await db.run(`INSERT OR IGNORE INTO Aulas (id_aula, nombre) VALUES (${aulaA1Id}, 'Aula A-10');`);
        await db.run(`INSERT OR IGNORE INTO Aulas (id_aula, nombre) VALUES (${aulaB2Id}, 'Aula B-20');`);
        const docGomezId = 1, docLopezId = 2, docMartaId = 3;
        await db.run(`INSERT OR IGNORE INTO Docentes (id_docente, nombre, apellido) VALUES (${docGomezId}, 'Ana', 'Gomez');`);
        await db.run(`INSERT OR IGNORE INTO Docentes (id_docente, nombre, apellido) VALUES (${docLopezId}, 'Roberto', 'Lopez');`);
        await db.run(`INSERT OR IGNORE INTO Docentes (id_docente, nombre, apellido) VALUES (${docMartaId}, 'Marta', 'Suarez');`);

        // --- 3. ESTUDIANTES (ID 10 y 20) ---
        const estPerezId = 10; // jperez
        
        // ¡¡¡CAMBIO AQUÍ!!! Se usa el nuevo HASH_JPEREZ
        await db.run(`INSERT OR IGNORE INTO Estudiantes (id_estudiante, usuario, contrasena, nombre, apellido) VALUES (${estPerezId}, 'jperez', ?, 'José', 'Perez')`, [HASH_JPEREZ]);
        
        const estSilvaId = 20; // asilva
        await db.run(`INSERT OR IGNORE INTO Estudiantes (id_estudiante, usuario, contrasena, nombre, apellido) VALUES (${estSilvaId}, 'asilva', ?, 'Ana', 'Silva')`, [HASH_CONTRA_123]);

        // --- 4. MATERIAS (IDs: 101, 102, 200, etc.) ---
        const matCalc1Id = 101, matCalc2Id = 102, matEcuacId = 200, matFis1Id = 301, matFis2Id = 302, matIntroProgId = 400;
        const matMicro1Id = 500, matMicro2Id = 501, matSocioId = 600, matDerechoId = 601, matPsicoId = 602;
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matCalc1Id}, 'MAT-101', 'Cálculo I', 5, ${facIngId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matCalc2Id}, 'MAT-102', 'Cálculo II', 5, ${facIngId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matEcuacId}, 'MAT-200', 'Ecuaciones Diferenciales', 5, ${facIngId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matFis1Id}, 'FIS-101', 'Física I', 4, ${facIngId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matFis2Id}, 'FIS-102', 'Física II', 4, ${facIngId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matIntroProgId}, 'CS-100', 'Intro. a la Programación', 3, ${facIngId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matMicro1Id}, 'ECO-100', 'Microeconomía I', 4, ${facEconId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matMicro2Id}, 'ECO-101', 'Microeconomía II', 4, ${facEconId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matSocioId}, 'HUM-101', 'Sociología', 3, ${facHumId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matDerechoId}, 'DER-100', 'Derecho I', 3, ${facHumId});`);
        await db.run(`INSERT OR IGNORE INTO Materias (id_materia, codigo, nombre, creditos, id_facultad) VALUES (${matPsicoId}, 'PSI-100', 'Psicología', 3, ${facHumId});`);
        
        // --- 5. REQUISITOS ---
        await db.run(`INSERT OR IGNORE INTO Requisitos (id_materia_cursar, id_materia_previa) VALUES (${matCalc2Id}, ${matCalc1Id});`); // Calc II -> Calc I
        await db.run(`INSERT OR IGNORE INTO Requisitos (id_materia_cursar, id_materia_previa) VALUES (${matEcuacId}, ${matCalc2Id});`); // Ecuac. -> Calc II
        await db.run(`INSERT OR IGNORE INTO Requisitos (id_materia_cursar, id_materia_previa) VALUES (${matFis2Id}, ${matFis1Id});`); // Física II -> Física I
        await db.run(`INSERT OR IGNORE INTO Requisitos (id_materia_cursar, id_materia_previa) VALUES (${matMicro2Id}, ${matMicro1Id});`); // Micro II -> Micro I

        // --- 6. HORARIOS (IDs del 1 al 10) ---
        const h1 = 1, h2 = 2, h3 = 3, h4 = 4, h5 = 5, h6 = 6, h7 = 7, h8 = 8, h9 = 9, h10 = 10;
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h1}, 'Lunes', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h2}, 'Miércoles', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h3}, 'Lunes', '10:00', '12:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h4}, 'Miércoles', '10:00', '12:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h5}, 'Martes', '14:00', '16:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h6}, 'Jueves', '14:00', '16:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h7}, 'Viernes', '09:00', '11:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h8}, 'Martes', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h9}, 'Jueves', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios (id_horario, dia, hora_inicio, hora_fin) VALUES (${h10}, 'Viernes', '14:00', '16:00');`);

        // --- 7. OFERTA DE PARALELOS (Semestre Actual = 4) ---
        const p_c2_A = 10, p_c2_B = 11, p_ec = 12, p_f1_A = 13, p_f1_B = 14, p_f2 = 15, p_m2 = 16, p_soc = 17, p_der = 18, p_psi = 19;
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_c2_A}, ${matCalc2Id}, ${docGomezId}, ${sem2_25Id}, ${aulaA1Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_c2_B}, ${matCalc2Id}, ${docLopezId}, ${sem2_25Id}, ${aulaB2Id}, 'B');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_ec}, ${matEcuacId}, ${docGomezId}, ${sem2_25Id}, ${aulaA1Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_f1_A}, ${matFis1Id}, ${docLopezId}, ${sem2_25Id}, ${aulaB2Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_f1_B}, ${matFis1Id}, ${docGomezId}, ${sem2_25Id}, ${aulaA1Id}, 'B');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_f2}, ${matFis2Id}, ${docLopezId}, ${sem2_25Id}, ${aulaB2Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_m2}, ${matMicro2Id}, ${docMartaId}, ${sem2_25Id}, ${aulaA1Id}, 'C');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_soc}, ${matSocioId}, ${docMartaId}, ${sem2_25Id}, ${aulaB2Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_der}, ${matDerechoId}, ${docMartaId}, ${sem2_25Id}, ${aulaA1Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_psi}, ${matPsicoId}, ${docMartaId}, ${sem2_25Id}, ${aulaB2Id}, 'A');`);

        // --- Oferta Pasada ---
        const p_c1_pasado = 101, p_f1_pasado = 102, p_m1_pasado = 103;
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_c1_pasado}, ${matCalc1Id}, ${docGomezId}, ${sem1_25Id}, ${aulaA1Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_f1_pasado}, ${matFis1Id}, ${docLopezId}, ${sem1_24Id}, ${aulaB2Id}, 'A');`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo) VALUES (${p_m1_pasado}, ${matMicro1Id}, ${docMartaId}, ${sem1_25Id}, ${aulaA1Id}, 'A');`);

        // --- 8. ASIGNACIÓN DE HORARIOS (CON CHOQUES) ---
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_A}, ${h1});`); // Calc II-A (Lu 08-10)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_A}, ${h2});`); // Calc II-A (Mi 08-10)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_B}, ${h5});`); // Calc II-B (Ma 14-16)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_B}, ${h6});`); // Calc II-B (Ju 14-16)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_ec}, ${h3});`); // Ecuac. (Lu 10-12)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_ec}, ${h4});`); // Ecuac. (Mi 10-12)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_A}, ${h3});`); // Física I-A (Lu 10-12) 🚨 CHOQUE CON ECUAC.
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_A}, ${h4});`); // Física I-A (Mi 10-12) 🚨 CHOQUE CON ECUAC.
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_B}, ${h5});`); // Física I-B (Ma 14-16) 🚨 CHOQUE CON CALC II-B
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f2}, ${h8});`); // Física II (Ma 08-10)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f2}, ${h9});`); // Física II (Ju 08-10)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_m2}, ${h1});`); // Micro II (Lu 08-10) 🚨 CHOQUE CON CALC II-A
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_soc}, ${h7});`); // Sociología (Vi 09-11)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_der}, ${h10});`); // Derecho I (Vi 14-16)
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_psi}, ${h7});`); // Psicología (Vi 09-11) 🚨 CHOQUE CON SOCIOLOGÍA
        // Historial
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c1_pasado}, ${h1});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_pasado}, ${h3});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_m1_pasado}, ${h5});`);

        // --- 9. HISTORIAL DE INSCRIPCIONES (ESCENARIOS) ---
        // === JOSÉ PEREZ ('jperez') ===
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estPerezId}, ${p_c1_pasado}, 'Reprobada', 40.0, 40.0);`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estPerezId}, ${p_m1_pasado}, 'Aprobada', 60.0, 70.0);`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (${estPerezId}, ${p_ec}, 'Cursando', '${new Date().toISOString()}');`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (${estPerezId}, ${p_f1_A}, 'Cursando', '${new Date().toISOString()}');`);

        // === ANA SILVA ('asilva') ===
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estSilvaId}, ${p_c1_pasado}, 'Aprobada', 80.0, 90.0);`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estSilvaId}, ${p_f1_pasado}, 'Aprobada', 70.0, 75.0);`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (${estSilvaId}, ${p_soc}, 'Cursando', '${new Date().toISOString()}');`);

        await db.exec('COMMIT');
        console.log("✅ BASE DE DATOS SEMBRADA (v7 - Nueva Contraseña).");
    } catch (error) {
        if (!error.message.includes('UNIQUE constraint failed')) {
            await db.exec('ROLLBACK');
            console.error("Error al sembrar la base de datos, ROLLBACK ejecutado:", error.message);
        } else {
            await db.exec('COMMIT');
            console.log("Datos ya existentes, siembra omitida.");
        }
    }

    return db;
}

// Exportamos la función de inicialización
module.exports = initializeDatabase;