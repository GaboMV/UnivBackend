
require('dotenv').config(); 
const express = require('express');
const cors = require('cors');
const initializeDatabase = require('./config/database');

const authMiddleware = require('./middleware/authMiddleware'); 



async function main() {
    try {
        
        const authRoutes = createAuthRoutes(authController); 
        
        const registroRoutes = createRegistroRoutes(registroController, authMiddleware); 
        const materiaRoutes = createMateriaRoutes(materiaController, authMiddleware);   


        app.use('/api/auth', authRoutes);

        app.use('/api/registro', registroRoutes);
        app.use('/api/materia', materiaRoutes);

    } catch (error) {
 
    }
}
main();