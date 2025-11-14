
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 


module.exports = function(getDb) {
    

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

      

            if (!estudiante) {
                return res.status(401).json({ error: 'Credenciales inválidas.' });
            }

            const isMatch = await bcrypt.compare(contrasena, estudiante.contrasena);

            if (!isMatch) {
                return res.status(401).json({ error: 'Credenciales inválidas.' });
            }

          
            const payload = {
                id: estudiante.id_estudiante,
                usuario: estudiante.usuario,
                nombre: estudiante.nombre
            };

           
            const token = jwt.sign(
                payload, 
                process.env.JWT_SECRET, 
                { expiresIn: '1h' }     
            );

      
            const { contrasena: _, ...estudianteSinContrasena } = estudiante;
            
            res.json({
                message: 'Autenticación exitosa.',
                token: token,
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