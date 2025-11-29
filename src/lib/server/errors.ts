import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    // Handle SQLite constraint errors
    if (error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { error: 'Username taken' },
        { status: 400 }
      );
    }

    // Handle other known errors
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }

  // Unknown error type
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

export function requireAuth(userId?: number): asserts userId is number {
  if (!userId) {
    throw new ApiError(401, 'Not authenticated');
  }
}

export function validateRequired(value: unknown, fieldName: string): asserts value is string {
  if (!value || typeof value !== 'string') {
    throw new ApiError(400, `Missing or invalid ${fieldName}`);
  }
}
