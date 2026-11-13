import { createBullseyeApp } from '../server.ts';

let appInstance: any = null;

async function getApp() {
  if (!appInstance) {
    appInstance = await createBullseyeApp({ withVite: false });
  }
  return appInstance;
}

export default async function handler(req: any, res: any) {
  try {
    const app = await getApp();

    // Ensure Express router sees the full canonical /api/* path in Vercel Serverless environment
    const matchedPath = req.headers['x-matched-path'] || req.headers['x-invoke-path'];
    if (typeof matchedPath === 'string' && matchedPath.startsWith('/api')) {
      req.url = matchedPath;
    } else if (req.url && !req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }

    return app(req, res);
  } catch (err) {
    console.error('BULLSEYE AI Vercel API error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Serverless handler failed to process request',
        }),
      );
    }
  }
}
