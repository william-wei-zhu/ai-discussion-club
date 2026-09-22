'use client';
import { ThemeProvider } from 'next-themes';
import { PublicAnalytics } from '@/components/public-analytics';
import { AuthProvider } from '@/components/auth-provider';
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="system" enableSystem><AuthProvider>{children}<PublicAnalytics /></AuthProvider></ThemeProvider>;
}
