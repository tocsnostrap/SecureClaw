/**
 * MULTI-TAB DASHBOARD - Production UI
 * 
 * Full dashboard with tabs: Overview, Apps, Permissions, Monitor, Tasks, Wiki, Settings
 * Real-time updates via WebSocket
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

type TabType = 'overview' | 'apps' | 'permissions' | 'monitor' | 'tasks' | 'wiki' | 'settings';

interface TabConfig {
  id: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: 'grid', color: Colors.emerald },
  { id: 'apps', label: 'Apps', icon: 'apps', color: '#3B82F6' },
  { id: 'permissions', label: 'Permissions', icon: 'key', color: '#8B5CF6' },
  { id: 'monitor', label: 'Monitor', icon: 'pulse', color: '#EF4444' },
  { id: 'tasks', label: 'Tasks', icon: 'list', color: '#F59E0B' },
  { id: 'wiki', label: 'Wiki', icon: 'book', color: '#10B981' },
  { id: 'settings', label: 'Settings', icon: 'settings', color: '#6B7280' },
];

export default function DashboardMulti() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // State for each tab
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [credits, setCredits] = useState<any>(null);
  
  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab]);
  
  const loadTabData = async (tab: TabType) => {
    setLoading(true);
    
    try {
      const baseUrl = getApiUrl();
      
      switch (tab) {
        case 'overview':
          await Promise.all([
            fetchSystemStatus(),
            fetchApps(),
            fetchCredits(),
          ]);
          break;
          
        case 'apps':
          await fetchApps();
          break;
          
        case 'permissions':
          await fetchPermissions();
          break;
          
        case 'monitor':
          await fetchSystemStatus();
          break;
          
        case 'tasks':
          await fetchTasks();
          break;
          
        case 'wiki':
          // Wiki data is static, loaded on demand
          break;
      }
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSystemStatus = async () => {
    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}api/dashboard/status`);
    const data = await response.json();
    setSystemStatus(data);
  };
  
  const fetchApps = async () => {
    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}api/dashboard/apps`);
    const data = await response.json();
    setApps(data.apps || []);
  };
  
  const fetchPermissions = async () => {
    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}api/dashboard/permissions?userId=default_user`);
    const data = await response.json();
    setPermissions(data.permissions || []);
  };
  
  const fetchTasks = async () => {
    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}api/agents/tasks`);
    const data = await response.json();
    setTasks(data.tasks || []);
  };
  
  const fetchCredits = async () => {
    const baseUrl = getApiUrl();
    const response = await fetch(`${baseUrl}api/dashboard/credits?userId=default_user`);
    const data = await response.json();
    setCredits(data.credits);
  };
  
  const onRefresh = async () => {
    setRefreshing(true);
    await loadTabData(activeTab);
    setRefreshing(false);
  };
  
  const renderTabContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.emerald} />
        </View>
      );
    }
    
    switch (activeTab) {
      case 'overview':
        return <OverviewTab status={systemStatus} apps={apps} credits={credits} />;
      case 'apps':
        return <AppsTab apps={apps} />;
      case 'permissions':
        return <PermissionsTab permissions={permissions} />;
      case 'monitor':
        return <MonitorTab status={systemStatus} />;
      case 'tasks':
        return <TasksTab tasks={tasks} />;
      case 'wiki':
        return <WikiTab />;
      case 'settings':
        return <SettingsTab credits={credits} />;
      default:
        return null;
    }
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SecureClaw Dashboard</Text>
        <View style={styles.statusDot} />
      </View>
      
      {/* Tab Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {TABS.map(tab => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[
              styles.tab,
              activeTab === tab.id && styles.tabActive,
            ]}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? tab.color : Colors.dark.secondaryText}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && { color: tab.color },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      
      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.emerald} />
        }
      >
        {renderTabContent()}
      </ScrollView>
    </View>
  );
}

// TAB COMPONENTS

function OverviewTab({ status, apps, credits }: any) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>System Overview</Text>
      
      {status && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Status</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: status.overall === 'operational' ? '#10B981' : '#EF4444' }
            ]}>
              <Text style={styles.statusBadgeText}>
                {status.overall}
              </Text>
            </View>
          </View>
          <Text style={styles.cardText}>Uptime: {status.uptimeFormatted}</Text>
        </View>
      )}
      
      {apps && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connected Apps</Text>
          <Text style={styles.cardText}>{apps.filter((a: any) => a.status === 'connected').length} / {apps.length} connected</Text>
        </View>
      )}
      
      {credits && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Credits</Text>
          <Text style={styles.cardText}>{credits.balance} / {credits.balance + credits.usedThisMonth}</Text>
          <Text style={styles.cardSubtext}>Plan: {credits.plan}</Text>
        </View>
      )}
    </View>
  );
}

function AppsTab({ apps }: { apps: any[] }) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>App Integrations</Text>
      
      {apps.map((app: any) => (
        <View key={app.app} style={styles.appCard}>
          <View style={styles.appHeader}>
            <Text style={styles.appName}>{app.app}</Text>
            <View style={[
              styles.appStatus,
              { backgroundColor: app.status === 'connected' ? '#10B981' : '#6B7280' }
            ]}>
              <Text style={styles.appStatusText}>{app.status}</Text>
            </View>
          </View>
          <Text style={styles.appFeatures}>
            Features: {app.features.join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PermissionsTab({ permissions }: { permissions: any[] }) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Granted Permissions</Text>
      
      {permissions.length === 0 ? (
        <Text style={styles.emptyText}>No permissions granted yet</Text>
      ) : (
        permissions.map((perm: any, index: number) => (
          <View key={index} style={styles.permCard}>
            <Text style={styles.permApp}>{perm.app}</Text>
            <Text style={styles.permScopes}>Scopes: {perm.scopes.join(', ')}</Text>
            <Text style={styles.permDate}>
              Granted: {new Date(perm.grantedAt).toLocaleDateString()}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function MonitorTab({ status }: { status: any }) {
  if (!status) return <ActivityIndicator />;
  
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>System Monitor</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Uptime: {status.uptimeFormatted}</Text>
        <Text style={styles.cardSubtext}>Overall: {status.overall}</Text>
      </View>
      
      {status.checks?.map((check: any) => (
        <View key={check.service} style={styles.checkCard}>
          <View style={styles.checkHeader}>
            <Text style={styles.checkService}>{check.service}</Text>
            <View style={[
              styles.checkStatus,
              { backgroundColor: check.status === 'healthy' ? '#10B981' : '#EF4444' }
            ]}>
              <Text style={styles.checkStatusText}>{check.status}</Text>
            </View>
          </View>
          <Text style={styles.checkMessage}>{check.message}</Text>
          <Text style={styles.checkLatency}>Latency: {check.latency}ms</Text>
        </View>
      ))}
    </View>
  );
}

function TasksTab({ tasks }: { tasks: any[] }) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Proactive Tasks</Text>
      
      {tasks.length === 0 ? (
        <Text style={styles.emptyText}>No scheduled tasks</Text>
      ) : (
        tasks.map((task: any) => (
          <View key={task.id} style={styles.taskCard}>
            <Text style={styles.taskName}>{task.name}</Text>
            <Text style={styles.taskDesc}>{task.description}</Text>
            <Text style={styles.taskCron}>Schedule: {task.cronExpression}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function WikiTab() {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Help & Tutorials</Text>
      
      <View style={styles.wikiCard}>
        <Text style={styles.wikiTitle}>📚 Quick Start</Text>
        <Text style={styles.wikiText}>Say: "Help with Instagram" to get started</Text>
      </View>
      
      <View style={styles.wikiCard}>
        <Text style={styles.wikiTitle}>🔗 Link Apps</Text>
        <Text style={styles.wikiText}>Say: "Grant Instagram access"</Text>
      </View>
      
      <View style={styles.wikiCard}>
        <Text style={styles.wikiTitle}>🌐 Browser</Text>
        <Text style={styles.wikiText}>Say: "Search for AI news"</Text>
      </View>
    </View>
  );
}

function SettingsTab({ credits }: { credits: any }) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Settings</Text>
      
      {credits && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Credits</Text>
          <Text style={styles.creditBalance}>{credits.balance}</Text>
          <Text style={styles.cardSubtext}>Plan: {credits.plan}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.emerald,
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tabBarContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.dark.card,
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_500Medium',
    color: Colors.dark.secondaryText,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
  },
  cardText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginTop: 4,
  },
  cardSubtext: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  appCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  appHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    textTransform: 'capitalize',
  },
  appStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  appStatusText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#FFF',
  },
  appFeatures: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
  },
  permCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  permApp: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  permScopes: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.emerald,
    marginBottom: 2,
  },
  permDate: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
  },
  checkCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  checkService: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    textTransform: 'capitalize',
  },
  checkStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  checkStatusText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#FFF',
  },
  checkMessage: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginBottom: 4,
  },
  checkLatency: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.emerald,
  },
  taskCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  taskName: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  taskDesc: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginBottom: 4,
  },
  taskCron: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.emerald,
  },
  wikiCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  wikiTitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  wikiText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    textAlign: 'center',
    marginTop: 40,
  },
  creditBalance: {
    fontSize: 32,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.emerald,
    marginVertical: 8,
  },
});
