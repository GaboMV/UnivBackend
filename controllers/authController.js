// controllers/authController.js
const bcrypt = require('bcryptjs');

/**
 * Crea los controladores de autenticación.
 * @param {Function} getDb - Función para obtener la instancia de la BD.
 */
module.exports = function(getDb) {
    
    /**
     * POST /api/auth/login
     * Autentica a un estudiante.
     */
    async function login(req, res) {
        const { usuario, contrasena } = req.body;
        if (!usuario || !contrasena) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
        }

        try {
            const db = getDb();
            const estudiante = await db.get(
                'SELECT * FROM Estudiantes WHERE usuario = ?', 
                [usuario]
            );

            // --- ¡¡¡DEBUG, CARAJO!!! ---
            console.log("================== DEBUG LOGIN ==================");
            if (!estudiante) {
                console.log(`Error: Usuario '${usuario}' NO ENCONTRADO en la DB.`);
                console.log("===============================================");
                return res.status(401).json({ error: 'Credenciales inválidas.' });
            }
            console.log(`Usuario '${usuario}' ENCONTRADO.`);
            console.log(`Comparando HASH de la DB: [${estudiante.contrasena}]`);
            console.log(`Contra Texto Plano de Postman: [${contrasena}]`);
            // --- FIN DEBUG ---

            const isMatch = await bcrypt.compare(contrasena, estudiante.contrasena);

            if (!isMatch) {
                console.log("Resultado: ¡LOS HASHES NO COINCIDEN! (401)");
                console.log("===============================================");
                return res.status(401).json({ error: 'Credenciales inválidas.' });
            }

            // Éxito
            console.log("Resultado: ¡LOGIN EXITOSO! (200)");
            console.log("===============================================");
            const { contrasena: _, ...estudianteSinContrasena } = estudiante;
            
            res.json({
                message: 'Autenticación exitosa.',
                estudiante: estudianteSinContrasena
            });

        } catch (error) {
            console.error('Error en el login:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    return {
        login
    };
};