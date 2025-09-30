"use client";

import { Globe } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import DarkModeSwitcher from "@/components/Layout/DarkModeSwitcher/DarkModeSwitcher";
import { useEmbassyStore } from "@/lib/stores/embassyStore";

const getOfficerInitials = (name: string) => {
  return (
    name
      .replace(/\bOfficer\b/gi, "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "EM"
  );
};

interface HeaderProps {
  showBackButton?: boolean;
  onBackClick?: () => void;
  backLabel?: string;
  showAdditionalButtons?: React.ReactNode;
}

export default function Header({
  showBackButton = false,
  onBackClick,
  backLabel = "← Back",
  showAdditionalButtons,
}: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentOfficer, logout } = useEmbassyStore();

  const isEmbassySection = pathname.startsWith("/embassy");

  const handleHomeClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    e.preventDefault();
    if (pathname === "/") {
      window.location.href = "/";
    } else {
      router.push("/");
    }
  };
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            onClick={handleHomeClick}
            className="text-xl font-bold flex items-center hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring focus-visible:ring-primary rounded px-1"
            aria-label="Go to VisaLegatio homepage (reset)"
            title="Go to homepage"
          >
            <Globe className="w-6 h-6 mr-2" />
            <span>VisaLegatio</span>
            {isEmbassySection && (
              <span className="text-primary ml-2 hidden sm:inline">
                | Embassy Portal
              </span>
            )}
          </Link>
          {showBackButton && onBackClick && (
            <button
              onClick={onBackClick}
              className="btn btn-ghost btn-sm ml-4"
            >
              {backLabel}
            </button>
          )}
        </div>
      </div>
      <div className="flex-none flex items-center gap-2">
        {showAdditionalButtons}
        <DarkModeSwitcher />
        {isEmbassySection && currentOfficer && (
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-circle avatar placeholder"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-neutral-content flex items-center justify-center font-semibold uppercase">
                <span>{getOfficerInitials(currentOfficer.name)}</span>
              </div>
            </div>
            <ul
              tabIndex={0}
              className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
            >
              <li>
                <a>Profile</a>
              </li>
              <li>
                <a>Settings</a>
              </li>
              <li>
                <a onClick={logout}>Logout</a>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}