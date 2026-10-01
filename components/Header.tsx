import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import Search from './Search';

const STAMP = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata',
});

export default async function Header() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <div className="top">
      <div className="brandrow">
        <Link href="/" className="brand">
          Sidana <span>Ops Console</span>
        </Link>
        <nav className="nav">
          <Link href="/ask">Ask</Link>
          <Link href="/changes">What changed</Link>
        </nav>
        <div className="stamp">{STAMP.format(new Date())}</div>
        <div className="who">
          <span>{data.user?.email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn-plain" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>
      <Search />
    </div>
  );
}
