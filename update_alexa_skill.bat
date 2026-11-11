@echo off
rem Sends the Alexa skill's definition (apps\api\alexa_api\skill\skill-package) to Amazon, waits for Amazon to rebuild
rem it, then checks that the rebuilt skill understands the phrases in utterance-checks.json as expected.
rem
rem Run this after changing what people can say to the skill. It needs Node, Python, and the ASK CLI
rem ("npm install -g ask-cli") logged in to the Amazon account that owns the skill ("ask configure").
rem
rem This only changes what Alexa understands. What the skill does about it is in apps\api\alexa_api\src, which
rem update_server.bat deploys. Until that is deployed, the skill apologises for an intent that it doesn't handle yet.
rem
rem Unlike update_server.bat, this doesn't pause at the end, so that it can be run unattended.

cd /d "%~dp0apps\api\alexa_api\skill"

call ask deploy
if errorlevel 1 exit /b 1

python check_utterances.py
