"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center"><div><p className="text-sm font-semibold text-indigo-600">Beacon</p><h1 className="mt-2 text-2xl font-semibold">Something went wrong</h1><button onClick={reset} className="mt-5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Try again</button></div></main>;
}
