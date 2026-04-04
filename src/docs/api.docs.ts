export const apiDocs = {
  name: 'AlgoArena Backend API',
  version: '1.0.0',
  basePath: '/api',
  endpoints: [
    {
      method: 'GET',
      path: '/health',
      description: 'Health check endpoint',
      requestBody: null,
      response: {
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    },
    {
      method: 'POST',
      path: '/api/auth/signup',
      description: 'Create a user account and return JWT',
      requestBody: {
        name: 'Jane Doe',
        email: 'jane@example.com',
        registrationNumber: '12345678',
        password: 'secret123',
      },
      response: {
        message: 'User created successfully',
        token: 'jwt-token',
        user: {
          id: 1,
          name: 'Jane Doe',
          email: 'jane@example.com',
          registrationNumber: '12345678',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    },
    {
      method: 'POST',
      path: '/api/auth/signin',
      description: 'Sign in by email or registrationNumber and return JWT',
      requestBodyVariants: [
        {
          email: 'jane@example.com',
          password: 'secret123',
        },
        {
          registrationNumber: '12345678',
          password: 'secret123',
        },
      ],
      response: {
        message: 'Sign in successful',
        token: 'jwt-token',
      },
    },
    {
      method: 'GET',
      path: '/api/auth/me',
      description: 'Get current user profile using Authorization: Bearer <token>',
      requestBody: null,
      response: {
        user: {
          id: 1,
          name: 'Jane Doe',
          email: 'jane@example.com',
          registrationNumber: '12345678',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    },
    {
      method: 'GET',
      path: '/api/docs',
      description: 'Live API documentation in JSON format',
      requestBody: null,
      response: {
        name: 'AlgoArena Backend API',
        version: '1.0.0',
      },
    },
  ],
};