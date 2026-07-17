import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/profile?twitter=error`)
  }

  const cookieStore = await cookies()
  const storedState = cookieStore.get('twitter_state')?.value
  const codeVerifier = cookieStore.get('twitter_code_verifier')?.value

  if (state !== storedState || !codeVerifier) {
    return NextResponse.redirect(`${appUrl}/profile?twitter=error`)
  }

  const wallet = Buffer.from(state, 'base64url').toString()

  try {
    // Exchange code for access token (confidential client = Basic auth)
    const credentials = Buffer.from(
      `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
    ).toString('base64')

    const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${appUrl}/api/auth/twitter/callback`,
        code_verifier: codeVerifier,
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/profile?twitter=error`)
    }

    // Get Twitter user info
    const userRes = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const { data: twitterUser } = await userRes.json()

    // Save to Supabase
    await supabaseAdmin.from('social_connections').upsert({
      wallet_address: wallet.toLowerCase(),
      twitter_id: twitterUser.id,
      twitter_handle: twitterUser.username,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'wallet_address' })

    const response = NextResponse.redirect(`${appUrl}/profile?twitter=connected`)
    response.cookies.delete('twitter_state')
    response.cookies.delete('twitter_code_verifier')
    return response
  } catch (err) {
    console.error('Twitter callback error:', err)
    return NextResponse.redirect(`${appUrl}/profile?twitter=error`)
  }
}
