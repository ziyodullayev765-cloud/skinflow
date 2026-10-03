#!/usr/bin/env bash
set -e
B=${B:-http://localhost:3001}
TOKEN=$(curl -s -X POST $B/api/auth/guest | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).token))')
H="Authorization: Bearer $TOKEN"
curl -s $B/api/me -H "$H" | head -c 300; echo
curl -s $B/api/cases -H "$H" | head -c 300; echo
curl -s -X POST $B/api/cases/1/open -H "$H" | head -c 400; echo
curl -s -X POST $B/api/cases/1/open -H "$H" | head -c 200; echo
curl -s $B/api/missions -H "$H" | head -c 400; echo
curl -s -X POST $B/api/daily-reward -H "$H"; echo
curl -s -X POST $B/api/daily-reward -H "$H"; echo
curl -s $B/api/profile -H "$H" | head -c 300; echo
