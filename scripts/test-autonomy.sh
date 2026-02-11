#!/bin/bash
# SecureClaw Autonomy Test Script
# Tests multi-agent routing, proactive tasks, tool calling, and audit logging

BASE_URL="${1:-http://localhost:5000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'
PASS=0
FAIL=0

check() {
  local result="$1"
  local desc="$2"
  if [ "$result" = "true" ]; then
    echo -e "${GREEN}[PASS]${NC} $desc"
    ((PASS++))
  else
    echo -e "${RED}[FAIL]${NC} $desc"
    ((FAIL++))
  fi
}

contains() {
  echo "$1" | grep -q "$2" && echo "true" || echo "false"
}

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  SecureClaw Autonomy Test Suite${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""

# 1. Health check
echo -e "${CYAN}[1/8] Health Check${NC}"
HEALTH=$(curl -s "$BASE_URL/api/health")
check "$(contains "$HEALTH" "ok")" "Health endpoint returns ok"
check "$(contains "$HEALTH" "configured")" "AI service is configured"

# 2. Config check
echo -e "\n${CYAN}[2/8] Config Check${NC}"
CONFIG=$(curl -s "$BASE_URL/api/config")
check "$(contains "$CONFIG" "SecureClaw")" "Config returns service name"
check "$(contains "$CONFIG" "grok-4")" "Config shows Grok 4 model"

# 3. List agents
echo -e "\n${CYAN}[3/8] Agent System${NC}"
AGENTS=$(curl -s "$BASE_URL/api/agents")
check "$(contains "$AGENTS" "orchestrator")" "Orchestrator agent registered"
check "$(contains "$AGENTS" "scheduler")" "Scheduler agent registered"
check "$(contains "$AGENTS" "research")" "Research agent registered"
check "$(contains "$AGENTS" "device")" "Device agent registered"
check "$(contains "$AGENTS" "web_search")" "Tools are listed for agents"

# 4. Task templates
echo -e "\n${CYAN}[4/8] Task Templates${NC}"
TEMPLATES=$(curl -s "$BASE_URL/api/agents/tasks/templates")
check "$(contains "$TEMPLATES" "Morning Briefing")" "Morning briefing template"
check "$(contains "$TEMPLATES" "News Monitor")" "News monitor template"
check "$(contains "$TEMPLATES" "Twitter")" "X/Twitter search template"

# 5. Create proactive task
echo -e "\n${CYAN}[5/8] Create Proactive Task${NC}"
UNIQUE_NAME="Test-$RANDOM"
TASK=$(curl -s -X POST "$BASE_URL/api/agents/tasks" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$UNIQUE_NAME\",
    \"description\": \"Search for AI news and summarize results\",
    \"cronExpression\": \"0 9 * * *\",
    \"agent\": \"research\",
    \"prompt\": \"Search for the latest AI news and provide a brief summary\"
  }")
TASK_ID=$(echo "$TASK" | sed 's/.*"id":"\([^"]*\)".*/\1/')
check "$(contains "$TASK" "ptask-")" "Proactive task created (ID: $TASK_ID)"
check "$(contains "$TASK" "enabled")" "Task has enabled flag"

# 6. List tasks (check immediately after creation, before any modifications)
echo -e "\n${CYAN}[6/8] List Active Tasks${NC}"
TASKS=$(curl -s "$BASE_URL/api/agents/tasks")
check "$(contains "$TASKS" "$UNIQUE_NAME")" "Task appears in tasks list"
check "$(contains "$TASKS" "research")" "Task agent is correct"

# 7. Toggle and delete task
echo -e "\n${CYAN}[7/8] Task Management${NC}"
if [ -n "$TASK_ID" ]; then
  TOGGLE=$(curl -s -X POST "$BASE_URL/api/agents/tasks/$TASK_ID/toggle" \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}')
  check "$(contains "$TOGGLE" "false")" "Task toggle (disable)"

  DELETE=$(curl -s -X DELETE "$BASE_URL/api/agents/tasks/$TASK_ID")
  check "$(contains "$DELETE" "deleted")" "Task deletion"
fi

# 8. Audit log (check after operations so entries exist)
echo -e "\n${CYAN}[8/8] Audit & Security${NC}"
AUDIT=$(curl -s "$BASE_URL/api/audit")
check "$(contains "$AUDIT" "log")" "Audit log endpoint works"
check "$(contains "$AUDIT" "create_proactive_task")" "Task creation was audited"

STATS=$(curl -s "$BASE_URL/api/audit/stats")
check "$(contains "$STATS" "total")" "Audit stats available"
check "$(contains "$STATS" "byAgent")" "Per-agent audit breakdown"

# Summary
echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL))
echo -e "${GREEN}Passed: $PASS${NC} / $TOTAL | ${RED}Failed: $FAIL${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Autonomy Demo Steps:${NC}"
echo "  1. POST /api/agents/tasks with a cron template to set up recurring AI tasks"
echo "  2. POST /api/agents/tasks/{id}/run to trigger immediate execution"
echo "  3. GET  /api/audit to review all autonomous actions taken"
echo "  4. In the app, tap the brain icon to open the Agent Hub dashboard"
echo ""

if [ $FAIL -gt 0 ]; then
  exit 1
fi
