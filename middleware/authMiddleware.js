// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    // 1. Busca el token en los headers
    const authHeader = req.headers['authorization']; // <-- 'Authorization'
    
    // El header debe ser "Bearer TU_PUTO_TOKEN_LARGO"
    // Así que separamos el "Bearer" del token
    const token = authHeader && authHeader.split(' ')[1];

    // 2. Si no hay token, ¡a la mierda!
    if (token == null) {
        return res.status(401).json({ error: 'No autorizado. Token de mierda no provisto.' });
    }

    // 3. Verifica el puto token
    jwt.verify(token, process.env.JWT_SECRET, (err, estudiantePayload) => {
        if (err) {
            // El token es falso o expiró
            return res.status(403).json({ error: 'Token inválido o expirado. ¡Jódete!' });
        }

        // ¡El token es bueno, carajo!
        // Guardamos los datos del estudiante (el 'payload') en el request
        // para que el siguiente controlador (ej: getHistorial) lo pueda usar.
        req.estudiante = estudiantePayload; 
        
        // Sigue adelante, carajo
        next(); 
    });
}

module.exports = authMiddleware;