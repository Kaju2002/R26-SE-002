import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8FE] px-6">
      <div className="w-full max-w-lg rounded-2xl border border-[#EEF0F8] bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#858BBD]">FraudAware Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#202871]">
          Portal entry points
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#42498A]">
          UI-only setup for now. Backend login wiring comes next.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/recruiter/login"
            className="inline-flex h-12 items-center justify-center rounded-xl bg-[#202871] px-5 text-base font-medium text-white transition hover:opacity-95"
          >
            Recruiter Login
          </Link>
          <Link
            href="/admin/login"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-[#E5E7EE] bg-white px-5 text-base font-medium text-[#202871] transition hover:bg-[#F7F8FE]"
          >
            Super Admin Login
          </Link>
        </div>
      </div>
    </main>
  );
}
