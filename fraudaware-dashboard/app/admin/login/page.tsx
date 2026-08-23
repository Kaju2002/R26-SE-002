import { redirect } from 'next/navigation';

/** Canonical Sign In is /login */
export default function AdminLoginPage() {
  redirect('/login');
}
