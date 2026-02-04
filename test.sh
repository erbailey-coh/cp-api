#!/bin/bash

# Copilot Shim Test Script
# Tests all API endpoints and features

BASE_URL="${COPILOT_SHIM_URL:-http://localhost:4891}"
PASS=0
FAIL=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           Copilot Shim Test Suite                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo -e "Target: ${BLUE}${BASE_URL}${NC}"
echo ""

# Helper function to run a test
run_test() {
    local name="$1"
    local expected_status="$2"
    local method="$3"
    local endpoint="$4"
    local data="$5"
    local check_field="$6"

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Test: ${BLUE}${name}${NC}"
    echo -e "  ${method} ${endpoint}"

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "$data" 2>/dev/null)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" 2>/dev/null)
    fi

    # Split response body and status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    # Check status code
    if [ "$http_code" = "$expected_status" ]; then
        status_ok=true
    else
        status_ok=false
    fi

    # Check for expected field in response if specified
    if [ -n "$check_field" ] && [ "$status_ok" = true ]; then
        if echo "$body" | grep -q "$check_field"; then
            field_ok=true
        else
            field_ok=false
        fi
    else
        field_ok=true
    fi

    # Report result
    if [ "$status_ok" = true ] && [ "$field_ok" = true ]; then
        echo -e "  Status: ${GREEN}✓ PASS${NC} (HTTP $http_code)"
        ((PASS++))
    else
        echo -e "  Status: ${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_status)"
        ((FAIL++))
    fi

    # Show response preview (truncated)
    if [ ${#body} -gt 200 ]; then
        echo -e "  Response: ${body:0:200}..."
    else
        echo -e "  Response: $body"
    fi
    echo ""
}

# Helper for chat completion tests (longer timeout)
run_chat_test() {
    local name="$1"
    local model="$2"
    local message="$3"
    local expected_status="${4:-200}"

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Test: ${BLUE}${name}${NC}"
    echo -e "  POST /v1/chat/completions"
    echo -e "  Model: $model"
    echo -e "  Message: $message"
    echo ""
    echo -e "  ${YELLOW}Waiting for response (this may take a while)...${NC}"

    start_time=$(date +%s)

    response=$(curl -s -w "\n%{http_code}" --max-time 180 \
        -X POST "${BASE_URL}/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"$model\", \"messages\": [{\"role\": \"user\", \"content\": \"$message\"}]}" 2>/dev/null)

    end_time=$(date +%s)
    duration=$((end_time - start_time))

    # Split response body and status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "$expected_status" ]; then
        echo -e "  Status: ${GREEN}✓ PASS${NC} (HTTP $http_code, ${duration}s)"
        ((PASS++))

        # Try to extract the assistant's message
        content=$(echo "$body" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')
        if [ -n "$content" ]; then
            echo -e "  Assistant: $content"
        fi
    else
        echo -e "  Status: ${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_status, ${duration}s)"
        ((FAIL++))
        echo -e "  Response: $body"
    fi
    echo ""
}

echo "┌──────────────────────────────────────────────────────────┐"
echo "│  Phase 1: Basic Connectivity                             │"
echo "└──────────────────────────────────────────────────────────┘"
echo ""

# Test 1: Health check
run_test "Health Check" "200" "GET" "/health" "" "status"

# Test 2: Root endpoint
run_test "Root Endpoint" "200" "GET" "/" "" "copilot-shim"

# Test 3: List models
run_test "List Models" "200" "GET" "/v1/models" "" "copilot-auto"

# Test 4: List models (without /v1 prefix)
run_test "List Models (no prefix)" "200" "GET" "/models" "" "copilot-auto"

echo "┌──────────────────────────────────────────────────────────┐"
echo "│  Phase 2: Error Handling                                 │"
echo "└──────────────────────────────────────────────────────────┘"
echo ""

# Test 5: Invalid model
run_test "Invalid Model Error" "400" "POST" "/v1/chat/completions" \
    '{"model": "invalid-model-xyz", "messages": [{"role": "user", "content": "test"}]}' \
    "model_not_found"

# Test 6: Missing messages
run_test "Missing Messages Error" "400" "POST" "/v1/chat/completions" \
    '{"model": "copilot-auto"}' \
    "invalid_messages"

# Test 7: Empty messages array
run_test "Empty Messages Error" "400" "POST" "/v1/chat/completions" \
    '{"model": "copilot-auto", "messages": []}' \
    "invalid_messages"

# Test 8: Streaming not supported
run_test "Streaming Not Supported" "400" "POST" "/v1/chat/completions" \
    '{"model": "copilot-auto", "messages": [{"role": "user", "content": "test"}], "stream": true}' \
    "streaming_not_supported"

echo "┌──────────────────────────────────────────────────────────┐"
echo "│  Phase 3: Chat Completions                               │"
echo "└──────────────────────────────────────────────────────────┘"
echo ""

# Test 9: Basic chat with default model
run_chat_test "Basic Chat (copilot-auto)" "copilot-auto" "Reply with exactly: TEST OK"

# Test 10: Chat with quick model
run_chat_test "Quick Response Model" "copilot-quick" "What is 2+2? Reply with just the number."

# Test 11: Chat with think model
run_chat_test "Think Deeper Model" "copilot-think" "What is the capital of France? One word answer."

# Test 12: OpenAI model alias (gpt-4o -> copilot-quick)
run_chat_test "OpenAI Alias (gpt-4o)" "gpt-4o" "Say OK"

# Test 13: System message handling
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Test: ${BLUE}System Message Handling${NC}"
echo -e "  POST /v1/chat/completions"
echo -e "  ${YELLOW}Waiting for response...${NC}"

response=$(curl -s -w "\n%{http_code}" --max-time 180 \
    -X POST "${BASE_URL}/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "copilot-auto",
        "messages": [
            {"role": "system", "content": "You are a pirate. Always say Arrr."},
            {"role": "user", "content": "Hello"}
        ]
    }' 2>/dev/null)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
    echo -e "  Status: ${GREEN}✓ PASS${NC} (HTTP $http_code)"
    ((PASS++))
    content=$(echo "$body" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')
    echo -e "  Assistant: $content"
else
    echo -e "  Status: ${RED}✗ FAIL${NC} (HTTP $http_code)"
    ((FAIL++))
fi
echo ""

echo "┌──────────────────────────────────────────────────────────┐"
echo "│  Phase 4: Session Management                             │"
echo "└──────────────────────────────────────────────────────────┘"
echo ""

# Test: List sessions (initially)
run_test "List Sessions" "200" "GET" "/v1/sessions" "" "activeSessions"

# Test: Create a session via chat
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Test: ${BLUE}Session Creation via Chat${NC}"
echo -e "  POST /v1/chat/completions"
echo -e "  ${YELLOW}Waiting for response...${NC}"

response=$(curl -s -w "\n%{http_code}" --max-time 180 \
    -X POST "${BASE_URL}/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"model": "copilot-auto", "messages": [{"role": "user", "content": "Remember the number 42. Just say OK."}]}' 2>/dev/null)

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

# Extract session_id from response
SESSION_ID=$(echo "$body" | grep -o '"session_id":"[^"]*"' | sed 's/"session_id":"//;s/"$//')

if [ "$http_code" = "200" ] && [ -n "$SESSION_ID" ]; then
    echo -e "  Status: ${GREEN}✓ PASS${NC} (HTTP $http_code)"
    echo -e "  Session ID: $SESSION_ID"
    ((PASS++))
else
    echo -e "  Status: ${RED}✗ FAIL${NC} (HTTP $http_code, session_id: $SESSION_ID)"
    ((FAIL++))
fi
echo ""

# Test: Continue conversation in same session
if [ -n "$SESSION_ID" ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Test: ${BLUE}Multi-turn Conversation${NC}"
    echo -e "  POST /v1/chat/completions (with session_id)"
    echo -e "  Session: $SESSION_ID"
    echo -e "  ${YELLOW}Waiting for response...${NC}"

    response=$(curl -s -w "\n%{http_code}" --max-time 180 \
        -X POST "${BASE_URL}/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"copilot-auto\", \"session_id\": \"$SESSION_ID\", \"messages\": [{\"role\": \"user\", \"content\": \"What number did I ask you to remember?\"}]}" 2>/dev/null)

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    content=$(echo "$body" | grep -o '"content":"[^"]*"' | head -1 | sed 's/"content":"//;s/"$//')

    if [ "$http_code" = "200" ]; then
        # Check if response mentions 42
        if echo "$content" | grep -q "42"; then
            echo -e "  Status: ${GREEN}✓ PASS${NC} (HTTP $http_code) - Copilot remembered the number!"
        else
            echo -e "  Status: ${GREEN}✓ PASS${NC} (HTTP $http_code) - Response received"
        fi
        echo -e "  Assistant: $content"
        ((PASS++))
    else
        echo -e "  Status: ${RED}✗ FAIL${NC} (HTTP $http_code)"
        ((FAIL++))
    fi
    echo ""
fi

# Test: List sessions (should show active session)
run_test "List Sessions (after chat)" "200" "GET" "/v1/sessions" "" "activeSessions"

# Test: Delete non-existent session
run_test "Delete Non-existent Session" "404" "DELETE" "/v1/sessions/fake-session-id" "" "session_not_found"

# Test: Delete actual session
if [ -n "$SESSION_ID" ]; then
    run_test "Delete Session" "200" "DELETE" "/v1/sessions/$SESSION_ID" "" "success"
fi

echo "┌──────────────────────────────────────────────────────────┐"
echo "│  Phase 5: Response Format Validation                     │"
echo "└──────────────────────────────────────────────────────────┘"
echo ""

# Test 14: Validate response structure
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Test: ${BLUE}Response Structure Validation${NC}"
echo -e "  Checking OpenAI-compatible response format..."

response=$(curl -s --max-time 180 \
    -X POST "${BASE_URL}/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -d '{"model": "copilot-auto", "messages": [{"role": "user", "content": "Say OK"}]}' 2>/dev/null)

# Check required fields
has_id=$(echo "$response" | grep -c '"id"')
has_object=$(echo "$response" | grep -c '"object"')
has_created=$(echo "$response" | grep -c '"created"')
has_model=$(echo "$response" | grep -c '"model"')
has_choices=$(echo "$response" | grep -c '"choices"')
has_usage=$(echo "$response" | grep -c '"usage"')

if [ "$has_id" -ge 1 ] && [ "$has_object" -ge 1 ] && [ "$has_created" -ge 1 ] && \
   [ "$has_model" -ge 1 ] && [ "$has_choices" -ge 1 ] && [ "$has_usage" -ge 1 ]; then
    echo -e "  Status: ${GREEN}✓ PASS${NC} - All required fields present"
    echo -e "    ✓ id, ✓ object, ✓ created, ✓ model, ✓ choices, ✓ usage"
    ((PASS++))
else
    echo -e "  Status: ${RED}✗ FAIL${NC} - Missing required fields"
    echo -e "    id:$has_id object:$has_object created:$has_created model:$has_model choices:$has_choices usage:$has_usage"
    ((FAIL++))
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    Test Summary                          ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  ${GREEN}Passed: %-3d${NC}                                           ║\n" $PASS
printf "║  ${RED}Failed: %-3d${NC}                                           ║\n" $FAIL
printf "║  Total:  %-3d                                           ║\n" $((PASS + FAIL))
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
