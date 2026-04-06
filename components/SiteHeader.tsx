import Link from 'next/link';
import Image from 'next/image';

export default function SiteHeader() {
  return (
    <Link href="/" className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity shrink-0">
      <div className="w-8 h-8 sm:w-10 sm:h-10 relative flex items-center justify-center bg-white rounded overflow-hidden shrink-0">
        <Image
          src="/logo.png"
          alt="Logo"
          width={40}
          height={40}
          className="object-contain"
        />
      </div>
      <span className="text-sm sm:text-lg font-bold tracking-tight whitespace-nowrap">执法监督法规查</span>
    </Link>
  );
}
