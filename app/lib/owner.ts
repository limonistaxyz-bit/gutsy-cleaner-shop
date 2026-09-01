import { env } from 'cloudflare:workers';
import { headers } from 'next/headers';
import { verifyOwner } from './security';
export async function isOwner() {
  const values = env as unknown as Record<string, string | undefined>;
  return verifyOwner((await headers()).get('cf-access-jwt-assertion'), {
    team: values.ACCESS_TEAM_DOMAIN, audience: values.ACCESS_AUD, email: values.ADMIN_EMAIL,
  });
}
