import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function getAppUrl(req: NextRequest): string {
  // Use APP_URL if set, otherwise derive from request headers
  if (process.env.APP_URL && process.env.APP_URL !== 'http://localhost:3000') {
    return process.env.APP_URL;
  }
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
  }

  const appUrl = getAppUrl(req);

  // Generate random state to prevent CSRF
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  // Set the state cookie on the redirect response directly
  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  );
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: appUrl.startsWith('https'),
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return response;
}
