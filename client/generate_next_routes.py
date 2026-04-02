import os
routes = [
    'actualites',
    'contact',
    'mentions-legales',
    'unauthorized',
    'login',
    'register',
    'verify-email-pending',
    'forgot-password',
    'verify-email/[token]',
    'reset-password/[token]',
    'favoris',
    'messages',
    'profile',
    'mon-compte',
    'avis/nouveau',
    'altimmo/[[...slug]]',
    'mila-events/[[...slug]]',
    'altcom/[[...slug]]',
    'dashboard/[[...slug]]',
    'mes-biens/[[...slug]]',
]
for route in routes:
    dirpath = os.path.join('app', *route.split('/'))
    os.makedirs(dirpath, exist_ok=True)
    filepath = os.path.join(dirpath, 'page.jsx')
    depth = len(route.split('/'))
    prefix = '../' * (depth + 1) + 'src/App'
    content = f"import App from '{prefix}';\n\nexport default function Page() {{\n  return <App />;\n}}\n"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
print('created', len(routes), 'route wrappers')
