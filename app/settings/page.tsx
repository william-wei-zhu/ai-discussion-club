import Link from 'next/link';
import { ThemeSettings } from '@/components/theme-settings';
export const metadata = { title: 'Settings' };
export default function SettingsPage() {
  return <div className="wrap page-content settings-page"><div className="page-heading"><h1>Make yourself<br /><em>comfortable.</em></h1></div><section className="settings-section"><h2>Appearance</h2><p>Choose a theme, or follow your device’s setting.</p><ThemeSettings/></section><section className="settings-section"><h2>Email & directory</h2><p>Choose which emails you receive and whether to appear in private event directories.</p><Link className="button secondary" href="/preferences">Manage preferences</Link></section><section className="settings-section"><h2>Account</h2><p>You don’t need an account to browse public events. Organizers can manage their account in the admin area.</p><Link className="text-link" href="/admin">Organizer sign in</Link></section></div>;
}
