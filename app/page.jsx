import Dashboard from './dashboard';
import { databaseConfigured } from './server.mjs';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <Dashboard database={databaseConfigured} />;
}
