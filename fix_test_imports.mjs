import fs from 'fs';
const path = 'tests/ui/users-existing-member-setup-integration.test.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/import \{ AuthContext \} from '\.\.\/\.\.\/contexts\/AuthContext';\n/, '');
content = content.replace(/import \{ ApiContext \} from '\.\.\/\.\.\/contexts\/ApiContext';\n/, '');
content = content.replace(/import \{ MusicDataContext \} from '\.\.\/\.\.\/contexts\/MusicDataContext';\n/, '');
fs.writeFileSync(path, content);
