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
        if (!res.ok) return false;
        const data = await res.json();
        // Attaché à `account` pour être relu dans le callback jwt
        // (même requête de sign-in, même référence d'objet).
        account.isNewUser    = data.isNewUser ?? false;
        account.backendToken = data.token;
        account.backendUser  = data.data?.user;
        return true;
      } catch {
        return false;
      }
    },

    async jwt({ token, account }) {
      const now = Math.floor(Date.now() / 1000);

      if (account?.provider === 'google') {
        if (account.backendToken) {
          // Réponse déjà récupérée dans signIn — pas de second appel réseau.
          token.accessToken = account.backendToken;
          token.userId      = account.backendUser?._id;
          token.role        = account.backendUser?.role || 'Client';
          token.isNewUser   = account.isNewUser ?? false;
          token.roleCheckedAt = now;
        } else {
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
            token.roleCheckedAt = now;
          } catch (e) {
            console.error('❌ [NextAuth] google-token error:', e);
          }
        }
      }

      // À chaque refresh (account absent), recharge le rôle depuis le backend
      // pour éviter qu'un rôle mis en cache dans le JWT NextAuth reste périmé
      // après un changement de rôle côté admin. Plafonné à un appel / 5 min
      // (token.roleCheckedAt, posé aussi lors de la connexion initiale
      // ci-dessus pour éviter un refetch immédiat juste après le login).
      if (!account && token.accessToken) {
        const lastCheck = token.roleCheckedAt || 0;
        const FIVE_MINUTES = 5 * 60;

        if (now - lastCheck > FIVE_MINUTES) {
          try {
            const res = await fetch(`${API_URL}/auth/google-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-nextauth-secret': process.env.NEXTAUTH_API_SECRET || '',
              },
              body: JSON.stringify({ email: token.email }),
            });
            if (res.ok) {
              const data = await res.json();
              token.role          = data.role   || token.role;
              token.userId        = data.userId || token.userId;
              token.roleCheckedAt = now;
            }
          } catch {}
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.accessToken     = token.accessToken;
      session.user.id         = token.userId;
      session.user.role       = token.role || 'Client';
      session.user.isNewUser  = token.isNewUser ?? false;
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
