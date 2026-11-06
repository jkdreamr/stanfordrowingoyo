export function notImplemented(): Response { return Response.json({ error: { code: 'NOT_IMPLEMENTED', message: 'Backend module is not implemented yet.' } }, { status: 501 }); }
