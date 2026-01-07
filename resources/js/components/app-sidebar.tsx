import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { ProjectSwitcher } from '@/components/project-switcher';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { index as tablesIndex } from '@/actions/App/Http/Controllers/TableController';
import { type NavItem, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Database, Table2 } from 'lucide-react';

const mainNavItems: NavItem[] = [
    {
        title: 'Tables',
        href: tablesIndex(),
        icon: Database,
    },
];

export function AppSidebar() {
    const { currentProject, url } = usePage<SharedData>().props;
    const pinnedTables = currentProject?.pinned_tables ?? [];

    const handlePinnedTableClick = (
        e: React.MouseEvent,
        tableName: string,
    ) => {
        e.preventDefault();

        // Check if we're already on the tables page
        const isOnTablesPage =
            window.location.pathname === '/tables' ||
            window.location.pathname.startsWith('/tables');

        if (isOnTablesPage) {
            // Preserve state to keep existing tabs open
            router.get(
                tablesIndex().url,
                { tab: tableName },
                { preserveState: true, preserveScroll: true },
            );
        } else {
            // Navigate to tables page with the tab parameter
            router.visit(`${tablesIndex().url}?tab=${encodeURIComponent(tableName)}`);
        }
    };

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <ProjectSwitcher />
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />

                {pinnedTables.length > 0 && (
                    <SidebarGroup className="mt-4">
                        <SidebarGroupLabel>Pinned Tables</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {pinnedTables.map((tableName) => (
                                    <SidebarMenuItem key={tableName}>
                                        <SidebarMenuButton asChild>
                                            <a
                                                href={`${tablesIndex().url}?tab=${encodeURIComponent(tableName)}`}
                                                onClick={(e) =>
                                                    handlePinnedTableClick(
                                                        e,
                                                        tableName,
                                                    )
                                                }
                                            >
                                                <Table2 className="size-4" />
                                                <span>{tableName}</span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
