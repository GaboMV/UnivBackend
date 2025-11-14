const express = require('express');
const router = express.Router();

module.exports = (authController) => {
    

    router.post('/login', authController.login);

    return router;
};