const bcrypt = require('bcryptjs');

const password = 'contraseña123'; // 👈 Pon aquí la contraseña que quieres hashear

async function hashPassword() {
    console.log(`Generando hash para: "${password}"...`);
    
    // Generamos el Salt (la "semilla" aleatoria)
    const salt = await bcrypt.genSalt(10);
    
    // Creamos el Hash
    const hash = await bcrypt.hash(password, salt);
    
    console.log('\n✅ TU HASH GENERADO ES:');
    console.log(hash);
    console.log('\nCopia este hash y pégalo en tu archivo de base de datos (config/database.js o seed.js)');
}

hashPassword();