import { NextResponse } from 'next/server';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

// Default credentials (in production, use environment variables)
const DEFAULT_USERNAME = process.env.NEXT_PUBLIC_AUTH_USERNAME || 'admin';
const DEFAULT_PASSWORD = process.env.NEXT_PUBLIC_AUTH_PASSWORD || 'admin123';

export async function POST(req: Request) {
  const body = (await req.json()) as LoginRequest;

  // Simple authentication (for development/demo purposes)
  if (body.username === DEFAULT_USERNAME && body.password === DEFAULT_PASSWORD) {
    const token = Buffer.from(`${body.username}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      access_token: token,
      token_type: 'bearer',
      username: body.username,
    } as LoginResponse);
  }

  return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
}
