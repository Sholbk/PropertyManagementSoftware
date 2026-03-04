import { NotificationBell } from "./notification-bell";
import { GlobalSearch } from "./global-search";

interface TopBarProps {
  userEmail: string;
  orgName?: string;
}

export function TopBar({ userEmail, orgName }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <div className="flex items-center gap-2 pl-12 lg:pl-0">
        {orgName && <span className="text-sm font-medium text-gray-700">{orgName}</span>}
      </div>
      <div className="flex items-center gap-4">
        <GlobalSearch />
        <NotificationBell />
        <span className="text-sm text-gray-500">{userEmail}</span>
      </div>
    </header>
  );
}
