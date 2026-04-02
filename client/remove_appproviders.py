from pathlib import Path
import re

root = Path('client/app')
modified = []
for path in sorted(root.rglob('*.jsx')):
    text = path.read_text(encoding='utf-8')
    if 'import AppProviders' not in text or '<AppProviders>' not in text:
        continue
    orig = text
    text = re.sub(r'^\s*import\s+AppProviders\s+from\s+[^;]+;[ \t]*\r?\n', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[ \t]*<AppProviders>[ \t]*\r?\n', '', text, flags=re.MULTILINE)
    text = re.sub(r'^[ \t]*</AppProviders>[ \t]*\r?\n', '', text, flags=re.MULTILINE)
    text = re.sub(r'(\r?\n){3,}', '\n\n', text)
    if text != orig:
        path.write_text(text, encoding='utf-8', newline='\n')
        modified.append(str(path))

print('modified', len(modified))
for p in modified:
    print(p)
