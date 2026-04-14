import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { upsertGoogleUser } from '@/lib/db';
import { createSession } from '@/lib/auth';

interface GoogleTokenResponse {
  access_token: string;
  error?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
}

function getAppUrl(req: NextRequest): string {
  if (process.env.APP_URL && process.env.APP_URL !== 'http://localhost:3000') {
    return process.env.APP_URL;
  }
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl(req);

  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const oauthError = searchParams.get('error');

  // Read state cookie from request
  const cookieStore = await cookies();
  const savedState = cookieStore.get('oauth_state')?.value;

  const clearStateCookie = (response: NextResponse) => {
    response.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
    return response;
  };

  const failRedirect = (reason: string) =>
    clearStateCookie(NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent(reason)}`));

  // Validate state (CSRF protection)
  if (oauthError) {
    return failRedirect(`google_${oauthError}`);
  }
  if (!code || !state) {
    return failRedirect('missing_params');
  }
  if (!savedState) {
    return failRedirect('no_state_cookie');
  }
  if (state !== savedState) {
    return failRedirect('state_mismatch');
  }

  // Check client secret is configured
  if (!process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET === 'your-google-client-secret') {
    return failRedirect('no_client_secret');
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json() as GoogleTokenResponse;
    if (!tokenRes.ok || tokens.error) {
      return failRedirect(`token_${tokens.error ?? 'exchange_failed'}`);
    }

    // Fetch user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const googleUser = await userRes.json() as GoogleUserInfo;
    if (!userRes.ok || !googleUser.id) {
      return failRedirect('userinfo_failed');
    }

    // Find or create user in DB, then create session
    const user = await upsertGoogleUser(googleUser.id, googleUser.email, googleUser.name);
    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return clearStateCookie(NextResponse.redirect(`${appUrl}/`));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return failRedirect(`exception_${msg}`);
  }
}
