import { pool } from '../db/pool';

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  registration_number: string;
  password_hash: string;
  created_at: string;
};

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    'SELECT id, name, email, registration_number, password_hash, created_at FROM users WHERE email = $1',
    [email]
  );

  return result.rows[0] || null;
}

export async function findUserByRegistrationNumber(
  registrationNumber: string
): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    'SELECT id, name, email, registration_number, password_hash, created_at FROM users WHERE registration_number = $1',
    [registrationNumber]
  );

  return result.rows[0] || null;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    'SELECT id, name, email, registration_number, password_hash, created_at FROM users WHERE id = $1',
    [id]
  );

  return result.rows[0] || null;
}

export async function createUser(params: {
  name: string;
  email: string;
  registrationNumber: string;
  passwordHash: string;
}): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `
      INSERT INTO users (name, email, registration_number, password_hash)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, registration_number, password_hash, created_at
    `,
    [params.name, params.email, params.registrationNumber, params.passwordHash]
  );

  return result.rows[0];
}
