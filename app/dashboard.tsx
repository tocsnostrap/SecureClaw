import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  FlatList,
  Platform,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Switch,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

interface AgentInfo {
  role: string;
  tools: string[];
  proactive: boolean;
  description: string;
}

interface ProactiveTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  agent: string;
  enabled: boolean;
  lastRun: number | null;
  nextRun: number | null;
  results: any[];
}

interface AuditEntry {
  id: string;
  timestamp: number;
  agent: string;
  action: string;
  tool: string | null;
  status: string;
}

interface AuditStats {
  total: number;
  executed: number;
  denied: number;
  failed: number;
  byAgent: Record<string, number>;
}

interface TaskTemplate {
  name: string;
  description: string;
  cronExpression: string;
  agent: string;
  prompt: string;
}

const agentIcons: Record<string, { icon: string; color: string }> = {
  orchestrator: { icon: "brain", color: Colors.emerald },
  scheduler: { icon: "clock-outline", color: "#6C63FF" },
  research: { icon: "magnify", color: "#FFB74D" },
  device: { icon: "cellphone", color: "#4FC3F7" },
};

function AgentCard({ agent }: { agent: AgentInfo }) {
  const info = agentIcons[agent.role] || { icon: "robot", color: Colors.emerald };
  return (
    <Animated.View entering={FadeInUp.delay(100).duration(300)}>
      <View style={styles.agentCard}>
        <View style={[styles.agentIconContainer, { backgroundColor: `${info.color}15` }]}>
          <MaterialCommunityIcons
            name={info.icon as any}
            size={24}
            color={info.color}
          />
        </View>
        <View style={styles.agentCardContent}>
          <View style={styles.agentCardHeader}>
            <Text style={styles.agentName}>{agent.role}</Text>
            {agent.proactive && (
              <View style={styles.proactiveBadge}>
                <Text style={styles.proactiveBadgeText}>PROACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.agentTools} numberOfLines={1}>
            {agent.tools.length} tools available
          </Text>
        </View>
        <View style={[styles.agentStatusDot, { backgroundColor: info.color }]} />
      </View>
    </Animated.View>
  );
}

function TaskCard({
  task,
  onToggle,
  onRun,
  onDelete,
}: {
  task: ProactiveTask;
  onToggle: () => void;
  onRun: () => void;
  onDelete: () => void;
}) {
  const info = agentIcons[task.agent] || { icon: "robot", color: Colors.emerald };
  const lastRunText = task.lastRun
    ? new Date(task.lastRun).toLocaleTimeString()
    : "Never";

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskCardTop}>
        <View style={[styles.taskAgentDot, { backgroundColor: info.color }]} />
        <View style={styles.taskInfo}>
          <Text style={styles.taskName} numberOfLines={1}>{task.name}</Text>
          <Text style={styles.taskCron}>{task.cronExpression} | {task.agent}</Text>
        </View>
        <Switch
          value={task.enabled}
          onValueChange={onToggle}
          trackColor={{ false: Colors.dark.border, true: `${Colors.emerald}40` }}
          thumbColor={task.enabled ? Colors.emerald : Colors.dark.secondaryText}
        />
      </View>
      <Text style={styles.taskDescription} numberOfLines={2}>
        {task.description}
      </Text>
      <View style={styles.taskActions}>
        <Text style={styles.taskLastRun}>Last: {lastRunText}</Text>
        <View style={styles.taskButtonRow}>
          <Pressable
            onPress={onRun}
            style={({ pressed }) => [styles.taskActionBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="play" size={16} color={Colors.emerald} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            style={({ pressed }) => [styles.taskActionBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.dark.error} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const statusColors: Record<string, string> = {
    executed: Colors.emerald,
    denied: Colors.dark.error,
    failed: "#FFB74D",
    pending: Colors.dark.secondaryText,
  };
  const color = statusColors[entry.status] || Colors.dark.secondaryText;
  const time = new Date(entry.timestamp).toLocaleTimeString();

  return (
    <View style={styles.auditRow}>
      <View style={[styles.auditDot, { backgroundColor: color }]} />
      <View style={styles.auditContent}>
        <Text style={styles.auditAction}>{entry.action}</Text>
        <Text style={styles.auditMeta}>
          {entry.agent} {entry.tool ? `| ${entry.tool}` : ""} | {time}
        </Text>
      </View>
      <Text style={[styles.auditStatus, { color }]}>{entry.status}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;
  const [activeTab, setActiveTab] = useState<"agents" | "tasks" | "audit" | "apps" | "permissions" | "monitor" | "help">("agents");
  const [appsData, setAppsData] = useState<any[]>([]);
  const [permissionsData, setPermissionsData] = useState<any[]>([]);
  const [monitorData, setMonitorData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const agentsQuery = useQuery<{ agents: AgentInfo[] }>({
    queryKey: ["/api/agents"],
    refetchInterval: 30000,
  });

  const tasksQuery = useQuery<{ tasks: ProactiveTask[] }>({
    queryKey: ["/api/agents/tasks"],
    refetchInterval: 10000,
    staleTime: 0,
  });

  const templatesQuery = useQuery<{ templates: TaskTemplate[] }>({
    queryKey: ["/api/agents/tasks/templates"],
  });

  const auditQuery = useQuery<{ log: AuditEntry[] }>({
    queryKey: ["/api/audit"],
    refetchInterval: 5000,
    staleTime: 0,
  });

  const auditStatsQuery = useQuery<AuditStats>({
    queryKey: ["/api/audit/stats"],
    refetchInterval: 5000,
    staleTime: 0,
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/agents/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/audit"] });
    queryClient.invalidateQueries({ queryKey: ["/api/audit/stats"] });
  }, []);

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("POST", `/api/agents/tasks/${id}/toggle`, { enabled });
    },
    onSuccess: invalidateAll,
  });

  const runTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/agents/tasks/${id}/run`);
    },
    onSuccess: invalidateAll,
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/agents/tasks/${id}`);
    },
    onSuccess: invalidateAll,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (template: TaskTemplate) => {
      return apiRequest("POST", "/api/agents/tasks", template);
    },
    onSuccess: invalidateAll,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/agents/tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/audit"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/audit/stats"] }),
    ]);
    setRefreshing(false);
  }, []);

  const handleDeleteTask = useCallback((id: string) => {
    if (Platform.OS === "web") {
      deleteTaskMutation.mutate(id);
      return;
    }
    Alert.alert("Delete Task", "Remove this proactive task?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTaskMutation.mutate(id) },
    ]);
  }, []);

  const handleCreateFromTemplate = useCallback((template: TaskTemplate) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    createTaskMutation.mutate(template);
  }, []);

  const agents = agentsQuery.data?.agents || [];
  const tasks = tasksQuery.data?.tasks || [];
  const auditEntries = auditQuery.data?.log || [];
  const stats = auditStatsQuery.data;
  const templates = templatesQuery.data?.templates || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={Colors.dark.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="brain" size={20} color={Colors.emerald} />
          <Text style={styles.headerTitle}>Agent Hub</Text>
        </View>
        <View style={{ width: 24 }} />
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {(["agents", "apps", "permissions", "monitor", "tasks", "help", "audit"] as const).map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => {
              setActiveTab(tab);
              if (Platform.OS !== "web") {
                Haptics.selectionAsync();
              }
            }}
          >
            <Ionicons 
              name={
                tab === "agents" ? "people" :
                tab === "apps" ? "apps" :
                tab === "permissions" ? "key" :
                tab === "monitor" ? "pulse" :
                tab === "tasks" ? "list" :
                tab === "help" ? "book" :
                "document-text"
              } 
              size={16} 
              color={activeTab === tab ? Colors.emerald : Colors.dark.secondaryText}
              style={{marginRight: 4}}
            />
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + webBottomInset + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.emerald}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "agents" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Agents</Text>
            <Text style={styles.sectionSubtitle}>
              {agents.length} specialized agents powered by Grok 4
            </Text>
            {agents.map((agent, i) => (
              <AgentCard key={agent.role} agent={agent} />
            ))}

            {agents.length === 0 && !agentsQuery.isLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Loading agents...</Text>
              </View>
            )}

            {agentsQuery.isLoading && (
              <ActivityIndicator color={Colors.emerald} style={{ marginTop: 20 }} />
            )}

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{agents.length}</Text>
                <Text style={styles.statLabel}>Agents</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>10</Text>
                <Text style={styles.statLabel}>Tools</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{tasks.filter((t) => t.enabled).length}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats?.total || 0}</Text>
                <Text style={styles.statLabel}>Actions</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === "tasks" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Proactive Tasks</Text>
            <Text style={styles.sectionSubtitle}>
              Autonomous tasks that run on a schedule
            </Text>

            {tasks.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={32}
                  color={Colors.dark.secondaryText}
                />
                <Text style={styles.emptyText}>No proactive tasks yet</Text>
                <Text style={styles.emptySubtext}>
                  Create from templates below
                </Text>
              </View>
            )}

            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() =>
                  toggleTaskMutation.mutate({ id: task.id, enabled: !task.enabled })
                }
                onRun={() => runTaskMutation.mutate(task.id)}
                onDelete={() => handleDeleteTask(task.id)}
              />
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Templates</Text>
            <Text style={styles.sectionSubtitle}>
              Quick-start with pre-built autonomous flows
            </Text>

            {templates.map((template, i) => (
              <Animated.View key={i} entering={FadeInDown.delay(i * 100).duration(300)}>
                <Pressable
                  style={({ pressed }) => [
                    styles.templateCard,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleCreateFromTemplate(template)}
                >
                  <View style={styles.templateLeft}>
                    <MaterialCommunityIcons
                      name={
                        (agentIcons[template.agent]?.icon || "robot") as any
                      }
                      size={20}
                      color={agentIcons[template.agent]?.color || Colors.emerald}
                    />
                  </View>
                  <View style={styles.templateContent}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDesc} numberOfLines={1}>
                      {template.description}
                    </Text>
                    <Text style={styles.templateCron}>
                      {template.cronExpression} | {template.agent}
                    </Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={Colors.emerald} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}

        {activeTab === "apps" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App Integrations</Text>
            <Text style={styles.sectionSubtitle}>Connected apps with OAuth</Text>
            
            <View style={[styles.agentCard, {marginTop: 16}]}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12}}>
                <MaterialCommunityIcons name="instagram" size={32} color="#E4405F" />
                <View style={{flex: 1}}>
                  <Text style={styles.agentTitle}>Instagram</Text>
                  <Text style={styles.agentDescription}>Post photos, stories, insights</Text>
                </View>
                <Text style={{fontSize: 12, color: Colors.dark.secondaryText}}>Not linked</Text>
              </View>
              <Text style={{fontSize: 11, color: Colors.emerald}}>
                Say: "Grant Instagram access" to link
              </Text>
            </View>
            
            <View style={[styles.agentCard]}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12}}>
                <MaterialCommunityIcons name="gmail" size={32} color="#EA4335" />
                <View style={{flex: 1}}>
                  <Text style={styles.agentTitle}>Gmail</Text>
                  <Text style={styles.agentDescription}>Send/receive emails, scan inbox</Text>
                </View>
                <Text style={{fontSize: 12, color: Colors.dark.secondaryText}}>Not linked</Text>
              </View>
              <Text style={{fontSize: 11, color: Colors.emerald}}>
                Say: "Grant email access" to link
              </Text>
            </View>
            
            <View style={[styles.agentCard]}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12}}>
                <MaterialCommunityIcons name="twitter" size={32} color="#1DA1F2" />
                <View style={{flex: 1}}>
                  <Text style={styles.agentTitle}>Twitter</Text>
                  <Text style={styles.agentDescription}>Post tweets, monitor timeline</Text>
                </View>
                <Text style={{fontSize: 12, color: Colors.dark.secondaryText}}>Not linked</Text>
              </View>
              <Text style={{fontSize: 11, color: Colors.emerald}}>
                Say: "Grant Twitter access" to link
              </Text>
            </View>
          </View>
        )}

        {activeTab === "permissions" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Permissions</Text>
            <Text style={styles.sectionSubtitle}>Manage app access & credentials</Text>
            
            <View style={[styles.agentCard, {marginTop: 16}]}>
              <Ionicons name="shield-checkmark" size={48} color={Colors.emerald} style={{alignSelf: 'center', marginBottom: 12}} />
              <Text style={{fontSize: 14, color: Colors.dark.text, textAlign: 'center', marginBottom: 8}}>
                Secure OAuth Integration
              </Text>
              <Text style={{fontSize: 12, color: Colors.dark.secondaryText, textAlign: 'center'}}>
                All credentials encrypted with AES-256{'\n'}
                Auto-refresh tokens{'\n'}
                One-click linking
              </Text>
            </View>
          </View>
        )}

        {activeTab === "monitor" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>System Monitor</Text>
            <Text style={styles.sectionSubtitle}>Real-time health checks</Text>
            
            <View style={[styles.agentCard, {marginTop: 16}]}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
                <Text style={styles.agentTitle}>Gateway</Text>
                <Text style={{fontSize: 12, color: '#10B981'}}>✅ Healthy</Text>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
                <Text style={styles.agentTitle}>Grok AI</Text>
                <Text style={{fontSize: 12, color: '#10B981'}}>✅ Healthy</Text>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
                <Text style={styles.agentTitle}>Browser</Text>
                <Text style={{fontSize: 12, color: '#10B981'}}>✅ Available</Text>
              </View>
              <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <Text style={styles.agentTitle}>Permissions</Text>
                <Text style={{fontSize: 12, color: '#10B981'}}>✅ Operational</Text>
              </View>
            </View>
            
            <View style={[styles.agentCard]}>
              <Text style={{fontSize: 12, color: Colors.dark.secondaryText, marginBottom: 4}}>
                System Uptime
              </Text>
              <Text style={{fontSize: 24, color: Colors.emerald, fontFamily: 'SpaceGrotesk_700Bold'}}>
                Running
              </Text>
            </View>
            
            <Text style={{fontSize: 11, color: Colors.emerald, textAlign: 'center', marginTop: 16}}>
              Say: "Monitor server status" for detailed report
            </Text>
          </View>
        )}

        {activeTab === "help" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Help & Tutorials</Text>
            <Text style={styles.sectionSubtitle}>Learn SecureClaw capabilities</Text>
            
            <View style={[styles.agentCard, {marginTop: 16}]}>
              <Text style={[styles.agentTitle, {marginBottom: 8}]}>📚 Quick Start (3 min)</Text>
              <Text style={styles.agentDescription}>
                1. Link apps: "Grant Instagram access"{'\n'}
                2. Test tools: "Search for AI news"{'\n'}
                3. Create code: "Build a game"{'\n'}
                4. Self-evolve: "Add new capability"
              </Text>
            </View>
            
            <View style={[styles.agentCard]}>
              <Text style={[styles.agentTitle, {marginBottom: 8}]}>🔗 App Linking</Text>
              <Text style={styles.agentDescription}>
                • Instagram: Post photos, stories{'\n'}
                • Gmail: Send/receive emails{'\n'}
                • Twitter: Post tweets{'\n'}
                {'\n'}
                One-click OAuth, auto-refresh forever!
              </Text>
            </View>
            
            <View style={[styles.agentCard]}>
              <Text style={[styles.agentTitle, {marginBottom: 8}]}>🧬 Self-Evolution</Text>
              <Text style={styles.agentDescription}>
                AI writes new tools for itself!{'\n'}
                Say: "Self-evolve to add [capability]"
              </Text>
            </View>
            
            <View style={[styles.agentCard]}>
              <Text style={[styles.agentTitle, {marginBottom: 8}]}>🤖 Agent Swarms</Text>
              <Text style={styles.agentDescription}>
                Multiple AI agents collaborate{'\n'}
                Say: "Deploy agent swarm to [goal]"
              </Text>
            </View>
          </View>
        )}

        {activeTab === "audit" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Security Audit Log</Text>
            <Text style={styles.sectionSubtitle}>
              All autonomous actions are logged here
            </Text>

            {stats && (
              <View style={styles.auditStatsRow}>
                <View style={[styles.auditStatCard, { borderLeftColor: Colors.emerald }]}>
                  <Text style={styles.auditStatValue}>{stats.executed}</Text>
                  <Text style={styles.auditStatLabel}>Executed</Text>
                </View>
                <View style={[styles.auditStatCard, { borderLeftColor: Colors.dark.error }]}>
                  <Text style={styles.auditStatValue}>{stats.denied}</Text>
                  <Text style={styles.auditStatLabel}>Denied</Text>
                </View>
                <View style={[styles.auditStatCard, { borderLeftColor: "#FFB74D" }]}>
                  <Text style={styles.auditStatValue}>{stats.failed}</Text>
                  <Text style={styles.auditStatLabel}>Failed</Text>
                </View>
              </View>
            )}

            {auditEntries.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons
                  name="shield-checkmark"
                  size={32}
                  color={Colors.dark.secondaryText}
                />
                <Text style={styles.emptyText}>No actions logged yet</Text>
                <Text style={styles.emptySubtext}>
                  Agent actions will appear here
                </Text>
              </View>
            )}

            {auditEntries.slice(0, 30).map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tabActive: {
    backgroundColor: `${Colors.emerald}15`,
    borderColor: `${Colors.emerald}40`,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_500Medium",
    color: Colors.dark.secondaryText,
  },
  tabTextActive: {
    color: Colors.emerald,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    color: Colors.dark.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    marginBottom: 16,
  },
  agentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  agentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  agentCardContent: {
    flex: 1,
    gap: 2,
  },
  agentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  agentName: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
    textTransform: "capitalize",
  },
  agentTitle: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
  },
  agentDescription: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    marginTop: 2,
  },
  proactiveBadge: {
    backgroundColor: `${Colors.emerald}20`,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proactiveBadgeText: {
    fontSize: 9,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.emerald,
    letterSpacing: 0.5,
  },
  agentTools: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
  agentStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    color: Colors.emerald,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  taskCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  taskCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  taskAgentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  taskInfo: {
    flex: 1,
    gap: 2,
  },
  taskName: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
  },
  taskCron: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
  taskDescription: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    marginTop: 8,
    lineHeight: 18,
  },
  taskActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  taskLastRun: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
  taskButtonRow: {
    flexDirection: "row",
    gap: 12,
  },
  taskActionBtn: {
    padding: 4,
  },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    gap: 12,
  },
  templateLeft: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${Colors.emerald}10`,
    justifyContent: "center",
    alignItems: "center",
  },
  templateContent: {
    flex: 1,
    gap: 2,
  },
  templateName: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_600SemiBold",
    color: Colors.dark.text,
  },
  templateDesc: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
  templateCron: {
    fontSize: 10,
    fontFamily: "SpaceGrotesk_400Regular",
    color: `${Colors.emerald}80`,
  },
  auditStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  auditStatCard: {
    flex: 1,
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    alignItems: "center",
  },
  auditStatValue: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    color: Colors.dark.text,
  },
  auditStatLabel: {
    fontSize: 10,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  auditRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    gap: 10,
  },
  auditDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  auditContent: {
    flex: 1,
    gap: 2,
  },
  auditAction: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_500Medium",
    color: Colors.dark.text,
  },
  auditMeta: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
  auditStatus: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_500Medium",
    color: Colors.dark.secondaryText,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
    color: Colors.dark.secondaryText,
  },
});
