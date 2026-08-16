import app from '../server.js';
import { registerMusicScaleSaveRoute } from '../services/server/scale/musicScaleSaveRoute.js';

registerMusicScaleSaveRoute(app);

export default function handler(req: any, res: any) {
  return app(req, res);
}

