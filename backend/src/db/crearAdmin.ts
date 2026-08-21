import 'dotenv/config';
import bcrypt from 'bcrypt';
import readline from 'node:readline/promises';
import { pool, query, queryOne } from './pool.js';

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const nombre = await rl.question('Nombre completo: ');
  const email = await rl.question('Correo: ');
  const iniciales = await rl.question('Iniciales (2-4 letras): ');
  const password = await rl.question('Contraseña: ');

  rl.close();

  if (password.length < 8) {
    console.error('La contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);

  try {
    const usuario = await queryOne(
      `INSERT INTO users (full_name, email, password_hash, initials, role)
       VALUES ($1, $2, $3, $4, 'administrador')
       RETURNING id, full_name, email, initials, role`,
      [nombre.trim(), email.trim().toLowerCase(), hash, iniciales.trim().toUpperCase()]
    );
    console.log('Administrador creado:', usuario);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();