import { pool } from '../db/pool';

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  registration_number: string;
  password_hash: string;
  session_token: string | null;
  created_at: string;
};

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    'SELECT id, name, email, registration_number, password_hash, session_token, created_at FROM users WHERE email = $1',
    [email]
  );

  return result.rows[0] || null;
}

export async function findUserByRegistrationNumber(
  registrationNumber: string
): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    'SELECT id, name, email, registration_number, password_hash, session_token, created_at FROM users WHERE registration_number = $1',
    [registrationNumber]
  );

  return result.rows[0] || null;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    'SELECT id, name, email, registration_number, password_hash, session_token, created_at FROM users WHERE id = $1',
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
      RETURNING id, name, email, registration_number, password_hash, session_token, created_at
    `,
    [params.name, params.email, params.registrationNumber, params.passwordHash]
  );

  return result.rows[0];
}

export async function updateUserSessionToken(userId: number, sessionToken: string | null): Promise<void> {
  await pool.query(
    `
      UPDATE users
      SET session_token = $2
      WHERE id = $1
    `,
    [userId, sessionToken]
  );
}
