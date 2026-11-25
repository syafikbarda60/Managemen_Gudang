import { getServices, databaseConfigured } from '../../../server.mjs';

function handle(request) {
  if (!databaseConfigured) return Response.json({ message: 'Database belum terhubung.' }, { status: 503 });
  return getServices().auth.handler(request);
}

export { handle as GET, handle as POST };
