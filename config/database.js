const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');

const HASH_CONTRA_123 = '$2a$12$Jkp/Hs6GRVKgLNmDHGOaeOP9iIfTasavDZwh6zQrT57yDAjwER1m6';
const HASH_JPEREZ = HASH_CONTRA_123;
async function initializeDatabase() {
    const db = await sqlite.open({
        filename: './academic_records.db', 
        driver: sqlite3.Database
    });

    console.log("Conexión a SQLite establecida.");

    const createSchema = [
        `CREATE TABLE IF NOT EXISTS Estudiantes (id_estudiante INTEGER PRIMARY KEY, usuario TEXT NOT NULL UNIQUE, contrasena TEXT NOT NULL, nombre TEXT NOT NULL, apellido TEXT NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS Docentes (id_docente INTEGER PRIMARY KEY, nombre TEXT NOT NULL, apellido TEXT NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS Semestres (id_semestre INTEGER PRIMARY KEY, nombre TEXT NOT NULL UNIQUE);`,
        `CREATE TABLE IF NOT EXISTS Facultades (id_facultad INTEGER PRIMARY KEY, nombre TEXT NOT NULL UNIQUE);`,
        `CREATE TABLE IF NOT EXISTS Aulas (id_aula INTEGER PRIMARY KEY, nombre TEXT NOT NULL UNIQUE);`,
        `CREATE TABLE IF NOT EXISTS Materias (id_materia INTEGER PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, creditos INTEGER NOT NULL DEFAULT 0, id_facultad INTEGER, FOREIGN KEY (id_facultad) REFERENCES Facultades(id_facultad));`,
        `CREATE TABLE IF NOT EXISTS Requisitos (id_materia_cursar INTEGER, id_materia_previa INTEGER, PRIMARY KEY (id_materia_cursar, id_materia_previa), FOREIGN KEY (id_materia_cursar) REFERENCES Materias(id_materia), FOREIGN KEY (id_materia_previa) REFERENCES Materias(id_materia));`,
        
        // ¡¡¡MODIFICADO: AÑADIDO cupo_maximo!!!
        `CREATE TABLE IF NOT EXISTS Paralelos_Semestre (id_paralelo INTEGER PRIMARY KEY, id_materia INTEGER NOT NULL, id_docente INTEGER NOT NULL, id_semestre INTEGER NOT NULL, id_aula INTEGER, nombre_paralelo TEXT NOT NULL, cupo_maximo INTEGER DEFAULT 30, FOREIGN KEY (id_materia) REFERENCES Materias(id_materia), FOREIGN KEY (id_docente) REFERENCES Docentes(id_docente), FOREIGN KEY (id_semestre) REFERENCES Semestres(id_semestre), FOREIGN KEY (id_aula) REFERENCES Aulas(id_aula), UNIQUE (id_materia, id_semestre, nombre_paralelo));`,
        
        `CREATE TABLE IF NOT EXISTS Horarios (id_horario INTEGER PRIMARY KEY, dia TEXT NOT NULL, hora_inicio TEXT NOT NULL, hora_fin TEXT NOT NULL);`,
        `CREATE TABLE IF NOT EXISTS Paralelo_Horario (id_paralelo INTEGER NOT NULL, id_horario INTEGER NOT NULL, PRIMARY KEY (id_paralelo, id_horario), FOREIGN KEY (id_paralelo) REFERENCES Paralelos_Semestre(id_paralelo), FOREIGN KEY (id_horario) REFERENCES Horarios(id_horario));`,
        `CREATE TABLE IF NOT EXISTS Inscripciones (id_inscripcion INTEGER PRIMARY KEY, id_estudiante INTEGER NOT NULL, id_paralelo INTEGER NOT NULL, fecha_inscripcion TEXT, estado TEXT NOT NULL, parcial1 REAL, parcial2 REAL, examen_final REAL, segundo_turno REAL, FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante), FOREIGN KEY (id_paralelo) REFERENCES Paralelos_Semestre(id_paralelo), UNIQUE (id_estudiante, id_paralelo));`,
        `CREATE TABLE IF NOT EXISTS Solicitudes_Inscripcion (id_solicitud INTEGER PRIMARY KEY, id_estudiante INTEGER NOT NULL, id_paralelo INTEGER NOT NULL, fecha_solicitud TEXT, fecha_respuesta TEXT, motivo TEXT, estado TEXT NOT NULL, id_docente_revisor INTEGER, FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante), FOREIGN KEY (id_paralelo) REFERENCES Paralelos_Semestre(id_paralelo), FOREIGN KEY (id_docente_revisor) REFERENCES Docentes(id_docente));`,
        `CREATE TABLE IF NOT EXISTS Notificaciones (id_notificacion INTEGER PRIMARY KEY, id_estudiante INTEGER NOT NULL, titulo TEXT NOT NULL, mensaje TEXT NOT NULL, fecha TEXT NOT NULL, leida INTEGER DEFAULT 0, tipo TEXT, id_paralelo_asociado INTEGER, FOREIGN KEY (id_estudiante) REFERENCES Estudiantes(id_estudiante));`
    ];

    await db.exec(createSchema.join('\n'));

    console.log("Sembrando datos (v8 - CON CUPOS)...");

    try {
        await db.exec('BEGIN TRANSACTION');

        // (Semestres, Facultades, Aulas, Docentes, Estudiantes, Materias, Requisitos, Horarios SE QUEDAN IGUAL)
        // ... COPIA ESA MIERDA DEL ARCHIVO ANTERIOR SI LA BORRASTE, O DIME Y TE LA PEGO.
        // (Para ahorrar espacio asumo que copias las secciones 1 a 6 del archivo anterior aquí)
        // ... 
        // Pongo aquí lo esencial para que funcione si copias todo:
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (1, '2025-1 Verano');`);
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (2, '2025-2 Semestre 1');`);
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (3, '2025-3 Invierno');`);
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (4, '2025-4 Semestre 2');`);
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (5, '2024-2 Semestre 1');`);
        await db.run(`INSERT OR IGNORE INTO Semestres (id_semestre, nombre) VALUES (6, '2023-4 Semestre 2');`);
        const facIngId = 1, facEconId = 2, facHumId = 3;
        await db.run(`INSERT OR IGNORE INTO Facultades (id_facultad, nombre) VALUES (1, 'Ingeniería');`);
        await db.run(`INSERT OR IGNORE INTO Facultades (id_facultad, nombre) VALUES (2, 'Economía');`);
        await db.run(`INSERT OR IGNORE INTO Facultades (id_facultad, nombre) VALUES (3, 'Humanidades');`);
        await db.run(`INSERT OR IGNORE INTO Aulas (id_aula, nombre) VALUES (10, 'Aula A-10');`);
        await db.run(`INSERT OR IGNORE INTO Aulas (id_aula, nombre) VALUES (20, 'Aula B-20');`);
        await db.run(`INSERT OR IGNORE INTO Docentes (id_docente, nombre, apellido) VALUES (1, 'Ana', 'Gomez');`);
        await db.run(`INSERT OR IGNORE INTO Docentes (id_docente, nombre, apellido) VALUES (2, 'Roberto', 'Lopez');`);
        await db.run(`INSERT OR IGNORE INTO Docentes (id_docente, nombre, apellido) VALUES (3, 'Marta', 'Suarez');`);
        await db.run(`INSERT OR IGNORE INTO Estudiantes (id_estudiante, usuario, contrasena, nombre, apellido) VALUES (10, 'jperez', ?, 'José', 'Perez')`, [HASH_JPEREZ]);
        await db.run(`INSERT OR IGNORE INTO Estudiantes (id_estudiante, usuario, contrasena, nombre, apellido) VALUES (20, 'asilva', ?, 'Ana', 'Silva')`, [HASH_CONTRA_123]);
        const matCalc1Id=101, matCalc2Id=102, matEcuacId=200, matFis1Id=301, matFis2Id=302, matIntroProgId=400, matMicro1Id=500, matMicro2Id=501, matSocioId=600, matDerechoId=601, matPsicoId=602;
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (101, 'MAT-101', 'Cálculo I', 5, 1);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (102, 'MAT-102', 'Cálculo II', 5, 1);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (200, 'MAT-200', 'Ecuaciones Diferenciales', 5, 1);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (301, 'FIS-101', 'Física I', 4, 1);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (302, 'FIS-102', 'Física II', 4, 1);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (400, 'CS-100', 'Intro. a la Programación', 3, 1);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (500, 'ECO-100', 'Microeconomía I', 4, 2);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (501, 'ECO-101', 'Microeconomía II', 4, 2);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (600, 'HUM-101', 'Sociología', 3, 3);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (601, 'DER-100', 'Derecho I', 3, 3);`);
        await db.run(`INSERT OR IGNORE INTO Materias VALUES (602, 'PSI-100', 'Psicología', 3, 3);`);
        await db.run(`INSERT OR IGNORE INTO Requisitos VALUES (102, 101);`);
        await db.run(`INSERT OR IGNORE INTO Requisitos VALUES (200, 102);`);
        await db.run(`INSERT OR IGNORE INTO Requisitos VALUES (302, 301);`);
        await db.run(`INSERT OR IGNORE INTO Requisitos VALUES (501, 500);`);
        const h1=1, h2=2, h3=3, h4=4, h5=5, h6=6, h7=7, h8=8, h9=9, h10=10;
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (1, 'Lunes', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (2, 'Miércoles', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (3, 'Lunes', '10:00', '12:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (4, 'Miércoles', '10:00', '12:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (5, 'Martes', '14:00', '16:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (6, 'Jueves', '14:00', '16:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (7, 'Viernes', '09:00', '11:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (8, 'Martes', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (9, 'Jueves', '08:00', '10:00');`);
        await db.run(`INSERT OR IGNORE INTO Horarios VALUES (10, 'Viernes', '14:00', '16:00');`);


        // --- 7. OFERTA DE PARALELOS (¡¡¡AQUÍ PONEMOS LOS CUPOS!!!) ---
        const p_c2_A = 10, p_c2_B = 11, p_ec = 12, p_f1_A = 13, p_f1_B = 14, p_f2 = 15, p_m2 = 16, p_soc = 17, p_der = 18, p_psi = 19;
        const docGomezId = 1, docLopezId = 2, docMartaId = 3;
        const sem2_25Id = 4;

        // Paralelos normales (30 cupos)
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_c2_A}, 102, ${docGomezId}, ${sem2_25Id}, 10, 'A', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_c2_B}, 102, ${docLopezId}, ${sem2_25Id}, 20, 'B', 30);`);
        
        // ¡¡¡PARALELOS CON POCOS CUPOS (Para que pruebes el error)!!!
        // Ecuaciones Diferenciales: Solo 1 puto cupo (Y jperez ya se va a inscribir en el paso 9, así que se llenará)
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_ec}, 200, ${docGomezId}, ${sem2_25Id}, 10, 'A', 1);`);
        
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_f1_A}, 301, ${docLopezId}, ${sem2_25Id}, 20, 'A', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_f1_B}, 301, ${docGomezId}, ${sem2_25Id}, 10, 'B', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_f2}, 302, ${docLopezId}, ${sem2_25Id}, 20, 'A', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_m2}, 501, ${docMartaId}, ${sem2_25Id}, 10, 'C', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_soc}, 600, ${docMartaId}, ${sem2_25Id}, 20, 'A', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_der}, 601, ${docMartaId}, ${sem2_25Id}, 10, 'A', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_psi}, 602, ${docMartaId}, ${sem2_25Id}, 20, 'A', 30);`);

        // (Oferta pasada, horarios, inscripciones se quedan igual. Asegúrate de copiarlos)
        // ...
        // Añado lo mínimo para que no explote si copias:
        const p_c1_pasado = 101, p_f1_pasado = 102, p_m1_pasado = 103;
        const sem1_25Id = 2, sem1_24Id = 5;
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_c1_pasado}, 101, ${docGomezId}, ${sem1_25Id}, 10, 'A', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_f1_pasado}, 301, ${docLopezId}, ${sem1_24Id}, 20, 'A', 30);`);
        await db.run(`INSERT OR IGNORE INTO Paralelos_Semestre (id_paralelo, id_materia, id_docente, id_semestre, id_aula, nombre_paralelo, cupo_maximo) VALUES (${p_m1_pasado}, 500, ${docMartaId}, ${sem1_25Id}, 10, 'A', 30);`);

        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_A}, ${h1});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_A}, ${h2});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_B}, ${h5});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c2_B}, ${h6});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_ec}, ${h3});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_ec}, ${h4});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_A}, ${h3});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_A}, ${h4});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_B}, ${h5});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f2}, ${h8});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f2}, ${h9});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_m2}, ${h1});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_soc}, ${h7});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_der}, ${h10});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_psi}, ${h7});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_c1_pasado}, ${h1});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_f1_pasado}, ${h3});`);
        await db.run(`INSERT OR IGNORE INTO Paralelo_Horario (id_paralelo, id_horario) VALUES (${p_m1_pasado}, ${h5});`);

        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estPerezId}, ${p_c1_pasado}, 'Reprobada', 40.0, 40.0);`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estPerezId}, ${p_m1_pasado}, 'Aprobada', 60.0, 70.0);`);
        // NOTA: Al inscribir a JPerez en 'p_ec' (Ecuaciones), como el cupo es 1, ¡LA CLASE SE LLENA!
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (${estPerezId}, ${p_ec}, 'Cursando', '${new Date().toISOString()}');`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (${estPerezId}, ${p_f1_A}, 'Cursando', '${new Date().toISOString()}');`);

        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estSilvaId}, ${p_c1_pasado}, 'Aprobada', 80.0, 90.0);`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, parcial1, examen_final) VALUES (${estSilvaId}, ${p_f1_pasado}, 'Aprobada', 70.0, 75.0);`);
        await db.run(`INSERT OR IGNORE INTO Inscripciones (id_estudiante, id_paralelo, estado, fecha_inscripcion) VALUES (${estSilvaId}, ${p_soc}, 'Cursando', '${new Date().toISOString()}');`);

        await db.exec('COMMIT');
        console.log("✅ BASE DE DATOS SEMBRADA (v8 - CON CUPOS).");
    } catch (error) {
        if (!error.message.includes('UNIQUE constraint failed')) {
            await db.exec('ROLLBACK');
            console.error("Error ROLLBACK:", error.message);
        } else {
            await db.exec('COMMIT');
        }
    }
    return db;
}

module.exports = initializeDatabase;