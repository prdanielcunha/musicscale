"""P0 #447: GET-only configuration audit; never prints credentials or raw responses."""
import json
import re
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

config = json.loads(Path("firebase-applet-config.json").read_text())
project = config["projectId"]
app_id = config["appId"]
project_number = app_id.split(":")[1]
key = re.search(r"DEFAULT_APPCHECK_SITE_KEY = '([^']+)'", Path("services/firebase.ts").read_text()).group(1)
hosts = ("musicscale.millionsnest.com", "mn-musicscale-555464791734.web.app")
token = subprocess.run(["gcloud", "auth", "print-access-token"], check=True, capture_output=True, text=True).stdout.strip()


def read(url):
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, {}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return "transport_error", {}


report = {"mode": "GET_ONLY", "customer_data_read": False, "cloud_mutations": False}
status, appcheck = read(f"https://firebaseappcheck.googleapis.com/v1/projects/{project_number}/apps/{app_id}/recaptchaEnterpriseConfig")
report["appcheck_config_http_status"] = status
if status == 200:
    report["registered_enterprise_key_matches_bundle_default"] = appcheck.get("siteKey") == key

status, recaptcha = read(f"https://recaptchaenterprise.googleapis.com/v1/projects/{project}/keys/{key}")
report["recaptcha_key_http_status"] = status
if status == 200:
    settings = recaptcha.get("webSettings", {})
    report["key_is_score_based_web"] = settings.get("integrationType") == "SCORE"
    report["domain_validation_enabled"] = not settings.get("allowAllDomains", False)
    domains = settings.get("allowedDomains", [])
    report["recaptcha_domain_allowed"] = {
        host: any(host == domain or host.endswith("." + domain) for domain in domains)
        for host in hosts
    }

status, identity = read(f"https://identitytoolkit.googleapis.com/admin/v2/projects/{project}/config")
report["auth_config_http_status"] = status
if status == 200:
    report["auth_domain_authorized"] = {host: host in identity.get("authorizedDomains", []) for host in hosts}

for api in ("recaptchaenterprise.googleapis.com", "firebaseappcheck.googleapis.com"):
    status, service = read(f"https://serviceusage.googleapis.com/v1/projects/{project_number}/services/{api}")
    report[api] = {"http_status": status}
    if status == 200:
        report[api]["enabled"] = service.get("state") == "ENABLED"

print(json.dumps(report, indent=2, sort_keys=True))
