import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

config.database = {
  path: path.join(__dirname, 'backend', 'products.db')
};

export default config;
