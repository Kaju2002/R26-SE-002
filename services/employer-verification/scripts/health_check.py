"""Pipeline health check: sends a few companies chosen to exercise each part of the component and
prints, for each, what every stage returned (ML, registers, reviews, website) and a PASS/FAIL line.

Run (server must be running):  python scripts/health_check.py [--base-url http://127.0.0.1:8001]
"""
import argparse
import time

import requests

CASES = [
    # (name, website, what this case proves)
    ("Dilmah", "", "large known company: registers + reviews + auto-found website"),
    ("Port City Colombo", "", "registered only via eROC company search"),
    ("Ravi Jewellers (Pvt) Ltd", "", "small private company found through eROC"),
    ("WishQue", "https://www.wishque.com/", "website given by the user: site is read and checked"),
    ("Zqxv Holdings Lanka", "", "company that does not exist: nothing found, must not be 'Low'"),
]


def stage_lines(j):
    ev = j.get("evidence", {}) or {}
    sb = j.get("score_breakdown", {}) or {}
    trace = j.get("registration_trace", []) or []
    out = []
    out.append(f"  ML model        : {sb.get('ml_score')}/40  (confidence {j.get('confidence')})")
    out.append(f"  Registers       : {sb.get('registration_score')}/30  status={j.get('registration_status')}"
               f"  source={j.get('government_registration_source') or '-'}  name={j.get('reg_name') or '-'}"
               f"  no={j.get('reg_number') or '-'}")
    for t in trace:
        if t.get("step") == 0:
            continue
        out.append(f"      step {t.get('step')}: {t.get('source')} -> {t.get('status')}  {str(t.get('detail',''))[:90]}")
    out.append(f"  Reviews/reports : {sb.get('reputation_score')}/20  {'; '.join(ev.get('reputation') or []) or 'none found'}")
    out.append(f"  Website         : {sb.get('website_score')}/10  checked={j.get('website_checked') or 'none'}"
               f"  {'; '.join(ev.get('website') or []) or 'no evidence'}")
    u = j.get("user_result", {})
    out.append(f"  RESULT          : {u.get('band')} ({u.get('label')}) score {j.get('risk_score')}  [{j.get('elapsed_seconds')}s]")
    for c in u.get("checks", []):
        out.append(f"      check '{c['name']}': {c['status']} - {c['detail'][:100]}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://127.0.0.1:8001")
    a = ap.parse_args()
    problems = []
    for name, site, why in CASES:
        print(f"\n=== {name}  ({why})")
        t0 = time.time()
        try:
            r = requests.post(f"{a.base_url}/predict", json={"company_name": name, "website_url": site, "email": ""}, timeout=150)
            r.raise_for_status()
            j = r.json()
        except Exception as exc:
            print("  FAIL: request error:", exc)
            problems.append(f"{name}: request failed")
            continue
        print("\n".join(stage_lines(j)))
        sb = j.get("score_breakdown", {}) or {}
        u = j.get("user_result", {})
        if not sb.get("ml_score"):
            problems.append(f"{name}: ML model returned no score")
        trace_status = [str(t.get("status")) for t in j.get("registration_trace", [])]
        if any(s == "error" for s in trace_status):
            problems.append(f"{name}: a registry returned an error (check token/key/network)")
        if name.startswith("Zqxv") and u.get("band") == "Low":
            problems.append(f"{name}: non-existent company was rated Low")
        if name == "WishQue" and not j.get("website_checked"):
            problems.append(f"{name}: given website was not checked")
        if name in ("Dilmah", "Port City Colombo", "Ravi Jewellers (Pvt) Ltd") and j.get("registration_status") != "registered":
            problems.append(f"{name}: expected 'registered', got {j.get('registration_status')}")
    print("\n" + ("ALL CHECKS PASSED" if not problems else "PROBLEMS:\n- " + "\n- ".join(problems)))


if __name__ == "__main__":
    main()
