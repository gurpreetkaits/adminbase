import { createContext, useContext, useState, type ReactNode } from 'react';

export interface TableTab {
    id: string;
    name: string;
    isLoading?: boolean;
}

interface TableTabsContextType {
    tabs: TableTab[];
    activeTabId: string | null;
    openTab: (tableName: string) => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string) => void;
    isTabOpen: (tableName: string) => boolean;
}

const TableTabsContext = createContext<TableTabsContextType | null>(null);

export function TableTabsProvider({ children }: { children: ReactNode }) {
    const [tabs, setTabs] = useState<TableTab[]>([]);
    const [activeTabId, setActiveTabId] = useState<string | null>(null);

    const openTab = (tableName: string) => {
        const existingTab = tabs.find((tab) => tab.name === tableName);

        if (existingTab) {
            setActiveTabId(existingTab.id);
            return;
        }

        const newTab: TableTab = {
            id: `tab-${tableName}-${Date.now()}`,
            name: tableName,
            isLoading: true,
        };

        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
    };

    const closeTab = (tabId: string) => {
        const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
        const newTabs = tabs.filter((tab) => tab.id !== tabId);
        setTabs(newTabs);

        if (activeTabId === tabId && newTabs.length > 0) {
            const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
            setActiveTabId(newTabs[newActiveIndex].id);
        } else if (newTabs.length === 0) {
            setActiveTabId(null);
        }
    };

    const setActiveTab = (tabId: string) => {
        setActiveTabId(tabId);
    };

    const isTabOpen = (tableName: string) => {
        return tabs.some((tab) => tab.name === tableName);
    };

    return (
        <TableTabsContext.Provider
            value={{
                tabs,
                activeTabId,
                openTab,
                closeTab,
                setActiveTab,
                isTabOpen,
            }}
        >
            {children}
        </TableTabsContext.Provider>
    );
}

export function useTableTabs() {
    const context = useContext(TableTabsContext);
    if (!context) {
        throw new Error('useTableTabs must be used within a TableTabsProvider');
    }
    return context;
}
