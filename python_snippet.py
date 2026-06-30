# ============================================================
# IP WHITELIST CHECK FOR YOUR PYTHON APP
# ============================================================
#
# Add this AFTER _dlog() is defined.
# Your script already imports requests, sys, and messagebox.
#
# Replace YOUR-NETLIFY-SITE with your actual Netlify site name.
# Example:
# https://my-ip-manager.netlify.app/.netlify/functions/ips?action=check

WHITELIST_CHECK_URL = "https://YOUR-NETLIFY-SITE.netlify.app/.netlify/functions/ips?action=check"

def enforce_ip_whitelist():
    try:
        r = requests.get(
            WHITELIST_CHECK_URL,
            timeout=12,
            headers={"Cache-Control": "no-cache"}
        )

        try:
            data = r.json()
        except Exception:
            data = {}

        allowed = bool(data.get("allowed"))
        detected_ip = data.get("ip", "unknown")
        reason = data.get("reason", "")

        _dlog(
            f"IP whitelist check: status={r.status_code}, "
            f"ip={detected_ip}, allowed={allowed}, reason={reason}"
        )

        if r.status_code != 200 or not allowed:
            try:
                messagebox.showerror(
                    "Access denied",
                    f"This IP is not whitelisted.\nDetected IP: {detected_ip}"
                )
            except Exception:
                pass

            sys.exit(1)

    except Exception as e:
        _dlog(f"IP whitelist check failed: {e}")

        try:
            messagebox.showerror(
                "Access denied",
                "Could not verify IP whitelist. Check internet/server."
            )
        except Exception:
            pass

        sys.exit(1)


# ============================================================
# WHERE TO CALL IT
# ============================================================
#
# In your Python file, find this old section:
#
# # IP whitelist check disabled — any IP can run the software.
#
# Or find the place before the main app UI is fully created.
#
# Add:
#
# _dlog("Checking IP whitelist...")
# enforce_ip_whitelist()
# _dlog("IP whitelist passed.")
#
# Best place:
# call enforce_ip_whitelist() before app.mainloop()
# and before the user can use the software.
