import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://altitude-vision.onrender.com/api';

const { handlers } = NextAuth({
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== 'google') return true;
      try {
        // Le backend vérifie lui-même l'idToken auprès de Google
        // (google-auth-library) — on ne lui envoie plus de champs
        // reconstruits côté client (email/name/googleId).
        const res = await fetch(`${API_URL}/auth/google`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ idToken: account.id_token }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async jwt({ token, account }) {
      if (account?.provider === 'google') {
        try {
          const res  = await fetch(`${API_URL}/auth/google-token`, {
            method:  'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-nextauth-secret': process.env.NEXTAUTH_API_SECRET || '',
            },
            body:    JSON.stringify({ email: token.email }),
          });
          const data = await res.json();
          token.accessToken = data.token;
          token.userId      = data.userId;
          token.role        = data.role || 'Client';
        } catch (e) {
          console.error('❌ [NextAuth] google-token error:', e);
        }
      }
      return token;
    },

    async session({ session, token }) {
      session.accessToken  = token.accessToken;
      session.user.id      = token.userId;
      session.user.role    = token.role || 'Client';
      return session;
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
});

export const { GET, POST } = handlers;
