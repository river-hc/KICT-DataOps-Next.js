import { NextResponse } from 'next/server';
import { findAccount } from '@/lib/account';

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export async function POST(req: Request) {
  const body = (await req.json()) as LoginRequest;

  // 고정 계정 목록(ACCOUNTS) 기준 인증 — 비밀번호를 변경한 계정은 클라이언트에서 override 검증하므로 여기까지 오지 않음
  const account = findAccount(body.username);
  if (account && body.password === account.password) {
    const token = Buffer.from(`${body.username}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      access_token: token,
      token_type: 'bearer',
      username: body.username,
    } as LoginResponse);
  }

  return NextResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
}
