const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Usa una clave por defecto si no existe la variable de entorno (para evitar errores tontos)
const JWT_SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_de_desarrollo';

module.exports = function(getDb) {
    
    async function login(req, res) {
        const { usuario, contrasena } = req.body;
        
        console.log(`🔍 INTENTO DE LOGIN: Usuario [${usuario}] con pass [${contrasena}]`);

        if (!usuario || !contrasena) {
            return res.status(400).json({ error: 'Usuario y contraseña son requeridos.' });
        }

        try {
            const db = getDb();
            const estudiante = await db.get(
                'SELECT * FROM Estudiantes WHERE usuario = ?', 
                [usuario]
            );

            if (!estudiante) {
                console.log("❌ Usuario no encontrado en BD.");
                return res.status(401).json({ error: 'Credenciales inválidas (Usuario).' });
            }

            console.log(`✅ Usuario encontrado: ${estudiante.usuario}`);
            console.log(`🔐 Hash en BD: ${estudiante.contrasena}`);

            // Comparar contraseña
            const isMatch = await bcrypt.compare(contrasena, estudiante.contrasena);
            
            console.log(`🧐 Resultado bcrypt.compare: ${isMatch}`);

            if (!isMatch) {
                console.log("❌ Contraseña incorrecta.");
                return res.status(401).json({ error: 'Credenciales inválidas (Password).' });
            }

            // Generar Token
            const payload = {
                id: estudiante.id_estudiante,
                usuario: estudiante.usuario,
                nombre: estudiante.nombre
            };

            const token = jwt.sign(
                payload, 
                JWT_SECRET, 
                { expiresIn: '24h' }    
            );

            console.log("🚀 Login exitoso. Token generado.");

            // Quitamos la contraseña del objeto antes de enviarlo
            const { contrasena: _, ...estudianteSinContrasena } = estudiante;
            
            res.json({
                message: 'Autenticación exitosa.',
                token: token,
                estudiante: estudianteSinContrasena
            });

        } catch (error) {
            console.error('🔥 Error FATAL en el login:', error.message);
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }

    return {
        login
    };
};