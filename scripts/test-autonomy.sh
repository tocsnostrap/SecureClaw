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
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASS++))
  else
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAIL++))
  fi
}

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  SecureClaw Autonomy Test Suite${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""

# 1. Health check
echo -e "${CYAN}[1/8] Health Check${NC}"
HEALTH=$(curl -s "$BASE_URL/api/health")
echo "$HEALTH" | grep -q '"agents"'
check "Health endpoint shows agent status"

# 2. Config check
echo -e "\n${CYAN}[2/8] Config Check${NC}"
CONFIG=$(curl -s "$BASE_URL/api/config")
echo "$CONFIG" | grep -q '"orchestrator"'
check "Config shows agent configuration"
echo "$CONFIG" | grep -q '"toolAllowlist"'
check "Config shows tool allowlist"

# 3. List agents
echo -e "\n${CYAN}[3/8] Agent System${NC}"
AGENTS=$(curl -s "$BASE_URL/api/agents")
echo "$AGENTS" | grep -q '"orchestrator"'
check "Orchestrator agent registered"
echo "$AGENTS" | grep -q '"scheduler"'
check "Scheduler agent registered"
echo "$AGENTS" | grep -q '"research"'
check "Research agent registered"
echo "$AGENTS" | grep -q '"device"'
check "Device agent registered"

# 4. Task templates
echo -e "\n${CYAN}[4/8] Task Templates${NC}"
TEMPLATES=$(curl -s "$BASE_URL/api/agents/tasks/templates")
echo "$TEMPLATES" | grep -q '"Daily Morning Briefing"'
check "Morning briefing template exists"
echo "$TEMPLATES" | grep -q '"Hourly News Monitor"'
check "News monitor template exists"

# 5. Create proactive task
echo -e "\n${CYAN}[5/8] Create Proactive Task${NC}"
TASK=$(curl -s -X POST "$BASE_URL/api/agents/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Daily Summary",
    "description": "Search for AI news and summarize results",
    "cronExpression": "0 9 * * *",
    "agent": "research",
    "prompt": "Search for the latest AI news and provide a brief summary"
  }')
TASK_ID=$(echo "$TASK" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "$TASK" | grep -q '"scheduled"' || echo "$TASK" | grep -q '"enabled":true'
check "Proactive task created (ID: $TASK_ID)"

# 6. List tasks
echo -e "\n${CYAN}[6/8] List Active Tasks${NC}"
TASKS=$(curl -s "$BASE_URL/api/agents/tasks")
echo "$TASKS" | grep -q '"Test Daily Summary"'
check "Task appears in active tasks list"

# 7. Toggle and delete task
echo -e "\n${CYAN}[7/8] Task Management${NC}"
if [ -n "$TASK_ID" ]; then
  TOGGLE=$(curl -s -X POST "$BASE_URL/api/agents/tasks/$TASK_ID/toggle" \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}')
  echo "$TOGGLE" | grep -q '"enabled":false'
  check "Task toggle (disable)"

  DELETE=$(curl -s -X DELETE "$BASE_URL/api/agents/tasks/$TASK_ID")
  echo "$DELETE" | grep -q '"deleted":true'
  check "Task deletion"
fi

# 8. Audit log
echo -e "\n${CYAN}[8/8] Audit & Security${NC}"
AUDIT=$(curl -s "$BASE_URL/api/audit")
echo "$AUDIT" | grep -q '"log"'
check "Audit log endpoint returns entries"

STATS=$(curl -s "$BASE_URL/api/audit/stats")
echo "$STATS" | grep -q '"total"'
check "Audit stats available"
echo "$STATS" | grep -q '"byAgent"'
check "Per-agent audit breakdown"

# Summary
echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}Passed: $PASS${NC} | ${RED}Failed: $FAIL${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
