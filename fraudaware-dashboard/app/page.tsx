import { redirect } from 'next/navigation';

/** Root goes straight to Sign In. */
export default function Home() {
  redirect('/login');
}
