import { Activity, Library, UserCircle, Building2, Briefcase, FolderOpen, Sun, Moon, Settings, LogOut, PanelLeftClose, PanelLeftOpen, BarChart2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { NriLogo } from "@/components/nri-logo";

const navItems = [
  { title: "Live Session", url: "/live", icon: Activity },
  { title: "Sessions", url: "/sessions", icon: Library },
  { title: "Intelligence", url: "/analytics", icon: BarChart2 },
  { title: "Partners", url: "/partners", icon: Building2 },
  { title: "Competencies", url: "/competencies", icon: Briefcase },
  { title: "Reference Library", url: "/reference-library", icon: FolderOpen },
  { title: "Speaker Profile", url: "/voice-training", icon: UserCircle },
  { title: "Settings", url: "/studio-settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-2 border-b border-sidebar-border group-data-[collapsible=icon]:p-1.5">
        <Link href="/welcome" className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 items-center justify-center shrink-0 group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7">
            <NriLogo
              variant={theme === "dark" ? "white" : "color"}
              height={20}
            />
          </div>
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <h2 className="text-sm font-semibold text-sidebar-foreground tracking-tight">NRI North America</h2>
            <p className="text-[10px] text-muted-foreground">OnTopic</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    data-active={location === item.url}
                    className="data-[active=true]:bg-sidebar-accent"
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <Avatar className="h-6 w-6 shrink-0">
              {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={user.firstName || "User"} />}
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-sidebar-foreground truncate flex-1 group-data-[collapsible=icon]:hidden" data-testid="text-user-name">
              {user.firstName || user.email || "User"}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 group-data-[collapsible=icon]:hidden"
              onClick={() => logout()}
              data-testid="button-logout"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleTheme}
            className="h-7 w-7 shrink-0"
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleSidebar}
            className="h-7 w-7 shrink-0"
            data-testid="button-collapse-sidebar"
          >
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
