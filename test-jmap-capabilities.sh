#!/bin/bash

# Test script to reproduce JMAP 400 error with calendarEvents capability
# This reproduces the error the app was seeing:
# "Unknown capability: urn:ietf:params:jmap:calendarEvents"

# Replace with your actual JMAP server and credentials
JMAP_SERVER="${JMAP_SERVER:-https://webmail.wellintime.com}"
USERNAME="${JMAP_USERNAME:-}"
PASSWORD="${JMAP_PASSWORD:-}"

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: JMAP_USERNAME=user JMAP_PASSWORD=pass $0"
  exit 1
fi

# Encode credentials
AUTH=$(echo -n "$USERNAME:$PASSWORD" | base64)

echo "=== Step 1: Get JMAP Session ==="
SESSION_RESPONSE=$(curl -s -H "Authorization: Basic $AUTH" \
  -H "Accept: application/json" \
  "$JMAP_SERVER/jmap/session")

echo "$SESSION_RESPONSE" | jq '.'

API_URL=$(echo "$SESSION_RESPONSE" | jq -r '.apiUrl')
ACCOUNT_ID=$(echo "$SESSION_RESPONSE" | jq -r '.primaryAccounts["urn:ietf:params:jmap:mail"]')

echo ""
echo "API URL: $API_URL"
echo "Account ID: $ACCOUNT_ID"

echo ""
echo "=== Step 2: Test request WITH calendarEvents capability (should fail) ==="
curl -s -X POST "$API_URL" \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"using\": [
      \"urn:ietf:params:jmap:core\",
      \"urn:ietf:params:jmap:mail\",
      \"urn:ietf:params:jmap:calendarEvents\"
    ],
    \"methodCalls\": [
      [\"CalendarEvent/get\", {\"accountId\": \"$ACCOUNT_ID\", \"ids\": null}, \"0\"]
    ]
  }" | jq '.'

echo ""
echo "=== Step 3: Test request WITHOUT calendarEvents capability (should work if server supports other methods) ==="
curl -s -X POST "$API_URL" \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"using\": [
      \"urn:ietf:params:jmap:core\",
      \"urn:ietf:params:jmap:mail\"
    ],
    \"methodCalls\": [
      [\"Mailbox/get\", {\"accountId\": \"$ACCOUNT_ID\", \"ids\": null}, \"0\"]
    ]
  }" | jq '.'

echo ""
echo "=== Done ==="
