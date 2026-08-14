## Set of URLs, instructions and helper text for the workshop


### Getting OpenRouter keys

### Provider configuration

Choose Custom in order to use the OpenRouter.

Base url - https://openrouter.ai/api/v1




### Soul configuration

You can ask Lakshmi to be very terse. For eg;


You MUST reply in only 4 words maximum, unless the user asks you advice. Whenever the user is simply giving you some info, your response should be something like "Noted."


### Google OAuth setup

1. Open Google cloud console https://console.cloud.google.com/

2. Select Project --> New Project

3. Project Name can be "Sutradhaar". Keep a note of the project id that it gives you back, for eg; "sutradhaar-505503"

4. No Organization, and click "Create"

5. After it is created, navigate to the project, navigation menu, APIs and Services

6. Click Credentials, Configure Consent screen


7. Enable sheets api 

https://console.developers.google.com/apis/api/sheets.googleapis.com/

Drive API 
https://console.developers.google.com/apis/api/drive.googleapis.com

Enable GMail API as well

8. Now create OAuthClient, Desktop app, Download json

9. Fix: GCP console → APIs & Services → OAuth consent screen → Test users → Add users → your email. Save. Retry same URL (or rerun the setup command for a fresh one).

https://console.cloud.google.com/auth/audience

Add test user

10. docker compose run --rm -p 8765:8765 gateway python -m gateway.mcp_servers.gmail_auth_setup

docker compose run --rm -p 8765:8765 gateway python -m gateway.mcp_servers.sheets_auth_setup

11. Auth complete., You may close..

12. Restart gateway docker compose restart gateway