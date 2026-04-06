'use client';

export default function BackToTopButton() {
  return (
    <button 
      onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
      className="fixed bottom-8 right-8 p-3 bg-white border border-slate-200 rounded-full shadow-lg hover:shadow-xl transition-all text-slate-400 hover:text-blue-600 group hidden md:block"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
    </button>
  );
}
