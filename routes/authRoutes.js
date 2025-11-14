// routes/authRoutes.js
const express = require('express');
const router = express.Router();

module.exports = (authController) => {
    
    /**
     * @route POST /api/auth/login
     * @desc Autentica a un estudiante
     * @access Public
     */
    router.post('/login', authController.login);

    return router;
};