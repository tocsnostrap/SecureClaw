/**
 * SUPER DASHBOARD - Production-Grade Visual Interface
 * 
 * Beautiful, functional multi-page dashboard with real-time updates
 * Showcases ALL AGI capabilities visually
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiUrl } from '@/lib/query-client';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SuperTab = 
  | 'command' 
  | 'apps' 
  | 'permissions' 
  | 'monitor' 
  | 'evolution' 
  | 'multimodal' 
  | 'autonomous';

const SUPER_TABS = [
  { id: 'command', label: 'Command', icon: 'terminal', gradient: ['#00D9A6', '#00B386'] },
  { id: 'apps', label: 'Apps', icon: 'apps', gradient: ['#3B82F6', '#1D4ED8'] },
  { id: 'permissions', label: 'Access', icon: 'key', gradient: ['#8B5CF6', '#6D28D9'] },
  { id: 'monitor', label: 'Monitor', icon: 'pulse', gradient: ['#EF4444', '#DC2626'] },
  { id: 'evolution', label: 'Evolution', icon: 'git-network', gradient: ['#F59E0B', '#D97706'] },
  { id: 'multimodal', label: 'Media', icon: 'images', gradient: ['#10B981', '#059669'] },
  { id: 'autonomous', label: 'Autonomous', icon: 'infinite', gradient: ['#EC4899', '#DB2777'] },
];

export default function SuperDashboard() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<SuperTab>('command');
  const [stats, setStats] = useState<any>(null);
  const [apps, setApps] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [evolutionHistory, setEvolutionHistory] = useState<any[]>([]);
  
  const scrollX = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    loadDashboardData();
    
    // Real-time updates every 5 seconds
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const loadDashboardData = async () => {
    try {
      const baseUrl = getApiUrl();
      
      const [statusRes, appsRes] = await Promise.all([
        fetch(`${baseUrl}api/dashboard/status`),
        fetch(`${baseUrl}api/dashboard/apps`),
      ]);
      
      const statusData = await statusRes.json();
      const appsData = await appsRes.json();
      
      setStatus(statusData);
      setApps(appsData.apps || []);
      
      // Calculate stats
      setStats({
        tools: 19,
        connected: appsData.apps?.filter((a: any) => a.status === 'connected').length || 0,
        uptime: statusData.uptimeFormatted || '0s',
        health: statusData.overall === 'operational' ? 100 : 50,
      });
      
    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  };
  
  const renderContent = () => {
    switch (activeTab) {
      case 'command':
        return <CommandCenter stats={stats} />;
      case 'apps':
        return <AppsPanel apps={apps} />;
      case 'permissions':
        return <PermissionsPanel />;
      case 'monitor':
        return <MonitorPanel status={status} />;
      case 'evolution':
        return <EvolutionPanel history={evolutionHistory} />;
      case 'multimodal':
        return <MultimodalPanel />;
      case 'autonomous':
        return <AutonomousPanel />;
      default:
        return null;
    }
  };
  
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Glassmorphic Header */}
      <BlurView intensity={80} style={styles.header}>
        <LinearGradient
          colors={['rgba(0, 217, 166, 0.1)', 'rgba(0, 217, 166, 0)']}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerTitle}>SecureClaw</Text>
              <Text style={styles.headerSubtitle}>AGI Command Center</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDotPulse} />
              <Text style={styles.statusText}>ONLINE</Text>
            </View>
          </View>
        </LinearGradient>
      </BlurView>
      
      {/* Stats Bar */}
      {stats && (
        <View style={styles.statsBar}>
          <StatCard label="Tools" value={stats.tools} icon="construct" color={Colors.emerald} />
          <StatCard label="Apps" value={stats.connected} icon="link" color="#3B82F6" />
          <StatCard label="Uptime" value={stats.uptime} icon="time" color="#F59E0B" />
          <StatCard label="Health" value={`${stats.health}%`} icon="heart" color="#EF4444" />
        </View>
      )}
      
      {/* Tab Navigator */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContainer}
      >
        {SUPER_TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id as SuperTab)}
              style={styles.superTab}
            >
              {active && (
                <LinearGradient
                  colors={tab.gradient}
                  style={styles.tabGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <View style={[styles.tabContent, active && styles.tabContentActive]}>
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={20}
                  color={active ? '#FFF' : Colors.dark.secondaryText}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      
      {/* Content Area */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {renderContent()}
      </ScrollView>
    </View>
  );
}

// PANEL COMPONENTS

function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CommandCenter({ stats }: { stats: any }) {
  return (
    <View>
      <Text style={styles.panelTitle}>Command Center</Text>
      
      <LinearGradient
        colors={['rgba(0, 217, 166, 0.15)', 'rgba(0, 217, 166, 0.05)']}
        style={styles.heroCard}
      >
        <MaterialCommunityIcons name="robot" size={48} color={Colors.emerald} />
        <Text style={styles.heroTitle}>AGI-Tier Intelligence</Text>
        <Text style={styles.heroText}>Self-evolving • Multimodal • Autonomous</Text>
        
        <View style={styles.capabilityBadges}>
          <CapabilityBadge label="Self-Evolving" color={Colors.emerald} />
          <CapabilityBadge label="19 Tools" color="#3B82F6" />
          <CapabilityBadge label="Real APIs" color="#8B5CF6" />
          <CapabilityBadge label="24/7 Active" color="#F59E0B" />
        </View>
      </LinearGradient>
      
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      
      <ActionCard
        title="Grant App Access"
        desc="Link Instagram, Gmail, Twitter"
        icon="link"
        gradient={['#3B82F6', '#1D4ED8']}
      />
      
      <ActionCard
        title="Search & Scrape"
        desc="Real browser automation"
        icon="search"
        gradient={['#10B981', '#059669']}
      />
      
      <ActionCard
        title="Generate Code"
        desc="Create anything - games, sims, tools"
        icon="code-slash"
        gradient={['#8B5CF6', '#6D28D9']}
      />
      
      <ActionCard
        title="Self-Evolve"
        desc="AI writes new tools for itself"
        icon="git-network"
        gradient={['#F59E0B', '#D97706']}
      />
    </View>
  );
}

function CapabilityBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.capBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
      <Text style={[styles.capText, { color }]}>{label}</Text>
    </View>
  );
}

function ActionCard({ title, desc, icon, gradient }: any) {
  return (
    <Pressable style={styles.actionCard}>
      <LinearGradient
        colors={gradient}
        style={styles.actionGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.actionIcon}>
          <Ionicons name={icon} size={24} color="#FFF" />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDesc}>{desc}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
      </LinearGradient>
    </Pressable>
  );
}

function AppsPanel({ apps }: { apps: any[] }) {
  return (
    <View>
      <Text style={styles.panelTitle}>App Integrations</Text>
      
      {apps.map(app => (
        <View key={app.app} style={styles.appCard}>
          <View style={styles.appHeader}>
            <MaterialCommunityIcons 
              name={getAppIcon(app.app)} 
              size={32} 
              color={Colors.emerald} 
            />
            <View style={styles.appInfo}>
              <Text style={styles.appName}>{app.app}</Text>
              <Text style={styles.appStatus}>
                {app.status === 'connected' ? '✅ Connected' : '⚪ Not Connected'}
              </Text>
            </View>
          </View>
          <Text style={styles.appFeatures}>
            {app.features.join(' • ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

function PermissionsPanel() {
  return (
    <View>
      <Text style={styles.panelTitle}>Access Control</Text>
      <Text style={styles.panelText}>Manage app permissions and credentials</Text>
    </View>
  );
}

function MonitorPanel({ status }: { status: any }) {
  return (
    <View>
      <Text style={styles.panelTitle}>System Monitor</Text>
      
      {status?.checks?.map((check: any) => (
        <View key={check.service} style={styles.checkCard}>
          <View style={styles.checkRow}>
            <Text style={styles.checkName}>{check.service}</Text>
            <View style={[
              styles.checkBadge,
              { backgroundColor: check.status === 'healthy' ? '#10B981' : '#EF4444' }
            ]}>
              <Text style={styles.checkBadgeText}>{check.status}</Text>
            </View>
          </View>
          <Text style={styles.checkLatency}>{check.latency}ms</Text>
        </View>
      ))}
    </View>
  );
}

function EvolutionPanel({ history }: { history: any[] }) {
  return (
    <View>
      <Text style={styles.panelTitle}>Self-Evolution</Text>
      
      <LinearGradient
        colors={['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)']}
        style={styles.evolutionCard}
      >
        <MaterialCommunityIcons name="dna" size={40} color="#F59E0B" />
        <Text style={styles.evolutionTitle}>AI Can Write Its Own Tools</Text>
        <Text style={styles.evolutionText}>
          Say: "Self-evolve to add PDF parsing capability"
        </Text>
      </LinearGradient>
      
      <Text style={styles.sectionTitle}>Evolution History</Text>
      {history.length === 0 ? (
        <Text style={styles.emptyText}>No self-evolutions yet</Text>
      ) : (
        history.map((item, i) => (
          <Text key={i} style={styles.historyItem}>
            ✓ {item.capability} - {new Date(item.timestamp).toLocaleString()}
          </Text>
        ))
      )}
    </View>
  );
}

function MultimodalPanel() {
  return (
    <View>
      <Text style={styles.panelTitle}>Multimodal AI</Text>
      
      <View style={styles.multiGrid}>
        <MultiCard icon="image" label="Image Gen" color="#10B981" />
        <MultiCard icon="mic" label="Voice" color="#3B82F6" />
        <MultiCard icon="videocam" label="Video" color="#8B5CF6" />
        <MultiCard icon="analytics" label="Visualize" color="#F59E0B" />
      </View>
      
      <Text style={styles.infoText}>
        Create images, voice, videos, and data visualizations
      </Text>
    </View>
  );
}

function MultiCard({ icon, label, color }: any) {
  return (
    <View style={[styles.multiCard, { borderColor: color + '40' }]}>
      <Ionicons name={icon} size={32} color={color} />
      <Text style={styles.multiLabel}>{label}</Text>
    </View>
  );
}

function AutonomousPanel() {
  return (
    <View>
      <Text style={styles.panelTitle}>Autonomous Operation</Text>
      
      <View style={styles.autonomousCard}>
        <View style={styles.loopIndicator}>
          <Animated.View style={styles.pulseRing} />
          <MaterialCommunityIcons name="infinity" size={32} color={Colors.emerald} />
        </View>
        <Text style={styles.autonomousTitle}>24/7 Background Loops</Text>
        <Text style={styles.autonomousText}>
          • Learning every 4h{'\n'}
          • Monitoring every 5min{'\n'}
          • Predicting every 30min{'\n'}
          • Evolving every 24h
        </Text>
      </View>
    </View>
  );
}

function getAppIcon(app: string): keyof typeof MaterialCommunityIcons.glyphMap {
  const icons: Record<string, any> = {
    instagram: 'instagram',
    email: 'email',
    twitter: 'twitter',
    calendar: 'calendar',
  };
  return icons[app] || 'application';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerGradient: {
    padding: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.emerald,
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 217, 166, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 166, 0.3)',
  },
  statusDotPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.emerald,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.emerald,
  },
  statsBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    textTransform: 'uppercase',
  },
  tabScroll: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  tabContainer: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  superTab: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabContentActive: {
    // Active styling handled by gradient
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.secondaryText,
  },
  tabTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  panelTitle: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  panelText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginBottom: 20,
  },
  heroCard: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 166, 0.2)',
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.dark.text,
    marginTop: 16,
  },
  heroText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginTop: 4,
  },
  capabilityBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
    justifyContent: 'center',
  },
  capBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  capText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_600SemiBold',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    marginTop: 24,
    marginBottom: 12,
  },
  actionCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#FFF',
    marginBottom: 2,
  },
  actionDesc: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  appCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  appInfo: {
    flex: 1,
  },
  appName: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  appStatus: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
  },
  appFeatures: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.emerald,
  },
  checkCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  checkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  checkName: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
    textTransform: 'capitalize',
  },
  checkBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  checkBadgeText: {
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  checkLatency: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.emerald,
  },
  evolutionCard: {
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  evolutionTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.dark.text,
    marginTop: 12,
    textAlign: 'center',
  },
  evolutionText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginTop: 8,
    textAlign: 'center',
  },
  historyItem: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    textAlign: 'center',
    marginTop: 20,
  },
  multiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  multiCard: {
    width: (SCREEN_WIDTH - 56) / 2,
    aspectRatio: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  multiLabel: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    color: Colors.dark.text,
  },
  infoText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    textAlign: 'center',
    lineHeight: 20,
  },
  autonomousCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  loopIndicator: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  pulseRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.emerald,
    opacity: 0.3,
  },
  autonomousTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  autonomousText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_400Regular',
    color: Colors.dark.secondaryText,
    lineHeight: 22,
    textAlign: 'center',
  },
});
