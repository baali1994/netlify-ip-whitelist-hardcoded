NETLIFY + SUPABASE IP WHITELIST MANAGER
======================================

This is the HARD-CODED version.

You do NOT need to add Netlify environment variables.

Your Supabase URL, Supabase secret key, and admin token are already placed inside:

  netlify/functions/ips.mjs

IMPORTANT SECURITY NOTE
-----------------------

This is easy, but not the safest method.

The Supabase secret key is inside server-side Netlify Function code.
That is okay only if your GitHub repository is PRIVATE.

Do NOT put the Supabase secret key inside:
- public/admin.html
- frontend JavaScript
- your Python app

Also, the admin token used here is the value you provided. Later, it is better to replace it with a long random password.


FILES
-----

package.json
netlify.toml
netlify/functions/ips.mjs
public/admin.html
python_snippet.py


STEP 1 — CREATE SUPABASE TABLE
------------------------------

Open Supabase.

Go to:

  SQL Editor -> New query

Paste and run:

create table if not exists ip_whitelist (
  ip text primary key,
  label text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);


STEP 2 — DEPLOY TO NETLIFY
--------------------------

Easy method:

1. Extract this ZIP.
2. Upload the whole folder to a PRIVATE GitHub repo.
3. Open Netlify.
4. Add new site -> Import from Git.
5. Select the repo.
6. Deploy.

Netlify will automatically use:

  netlify.toml

which says:

  publish = "public"
  functions = "netlify/functions"


STEP 3 — OPEN ADMIN PANEL
-------------------------

After deploy, open:

  https://YOUR-SITE.netlify.app/admin.html

Paste your admin token into the admin token box.

The admin token is already hardcoded in the server-side function.

You can also open:

  https://YOUR-SITE.netlify.app/admin.html?token=sb_publishable_zW_eXePChSo8yaTw4aJ8Lg_IUHe9bZK

But pasting the token in the page is cleaner than putting it in the URL.


STEP 4 — TEST IP DETECTION
--------------------------

Open:

  https://YOUR-SITE.netlify.app/.netlify/functions/ips?action=whoami

You should see:

  { "ip": "YOUR_PUBLIC_IP" }


STEP 5 — ADD YOUR CURRENT IP
----------------------------

Open admin panel:

  https://YOUR-SITE.netlify.app/admin.html

Click:

  Detect My IP

Then:

  Add Current IP

Then click:

  Refresh List

Your IP should appear as active.


STEP 6 — TEST WHITELIST CHECK
-----------------------------

Open:

  https://YOUR-SITE.netlify.app/.netlify/functions/ips?action=check

If your IP is active in Supabase, you should see:

  { "allowed": true, "ip": "YOUR_PUBLIC_IP" }

If your IP is not active, you should see:

  { "allowed": false, "ip": "YOUR_PUBLIC_IP" }


STEP 7 — CONNECT PYTHON APP
---------------------------

Open:

  python_snippet.py

Copy the function into your Python file.

Change this line:

  WHITELIST_CHECK_URL = "https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions/ips?action=check"

to your real Netlify URL.

Example:

  WHITELIST_CHECK_URL = "https://my-ip-manager.netlify.app/.netlify/functions/ips?action=check"

Then call:

  enforce_ip_whitelist()

before the user can use the app.


HOW ADMIN PANEL WORKS
---------------------

Add Current IP:
  Adds the IP Netlify detects from your browser.

Add Manual IP:
  Lets you enter any IP manually.

Disable:
  Keeps the IP in the database but blocks it.

Enable:
  Allows it again.

Delete:
  Removes the IP completely.


FINAL FLOW
----------

Python app starts
  -> calls Netlify check URL
  -> Netlify detects public IP
  -> Netlify checks Supabase ip_whitelist table
  -> if active=true, app opens
  -> if not found or disabled, app closes


TROUBLESHOOTING
---------------

Problem:
  Admin page says Unauthorized.

Fix:
  Admin token is wrong. Paste the same token hardcoded in ips.mjs.


Problem:
  check endpoint says allowed=false.

Fix:
  Add the current IP from the admin panel.


Problem:
  Python app blocks you even after adding IP.

Fix:
  Open whoami endpoint and compare the IP with the IP inside the admin list.
  If different, add the IP shown by whoami.


Problem:
  Netlify deploy fails.

Fix:
  Make sure package.json exists and includes @supabase/supabase-js.
