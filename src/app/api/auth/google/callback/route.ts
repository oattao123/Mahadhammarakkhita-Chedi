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

export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json({ error: 'APP_URL not configured' }, { status: 500 });
  }

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

  const failRedirect = () =>
    clearStateCookie(NextResponse.redirect(`${appUrl}/login?error=oauth`));

  // Validate state (CSRF protection)
  if (oauthError || !code || !state || !savedState || state !== savedState) {
    return failRedirect();
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json() as GoogleTokenResponse;
    if (!tokenRes.ok || tokens.error) {
      throw new Error(tokens.error ?? 'Token exchange failed');
    }

    // Fetch user info from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    const googleUser = await userRes.json() as GoogleUserInfo;
    if (!userRes.ok || !googleUser.id) {
      throw new Error('Failed to fetch Google user info');
    }

    // Find or create user in DB, then create session
    const user = upsertGoogleUser(googleUser.id, googleUser.email, googleUser.name);
    await createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });

    return clearStateCookie(NextResponse.redirect(`${appUrl}/`));
  } catch {
    return failRedirect();
  }
}
