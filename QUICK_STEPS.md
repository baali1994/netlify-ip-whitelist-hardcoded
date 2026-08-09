# Quick Steps

1. Supabase → SQL Editor → run:

```sql
create table if not exists ip_whitelist (
  ip text primary key,
  label text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
```

2. Upload this folder to a **private GitHub repo**.

3. Netlify → Add new site → Import from Git → Deploy.

4. Open:

```txt
https://YOUR-SITE.netlify.app/admin.html
```

5. Paste admin token.

6. Click **Add Current IP**.

7. Test:

```txt
https://YOUR-SITE.netlify.app/.netlify/functions/ips?action=check
```

8. Add `python_snippet.py` into your Python app and replace the Netlify URL.
