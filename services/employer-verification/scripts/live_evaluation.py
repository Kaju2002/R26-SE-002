"""Run the LIVE /predict API on a labelled list of real companies and report real results.

Input CSV columns:  company_name, website_url, label     (label = legit | fraud)
Optional column:    note
Usage:
    uvicorn app.main:app --port 8001            (in another terminal)
    python scripts/live_evaluation.py --input data/live_eval_set.csv --repeat 2
Outputs (in --out-dir): live_results.csv (every call), live_summary.txt (tables for the report).
"""
import argparse
import time
from pathlib import Path

import pandas as pd
import requests


def call_api(base_url, name, site, timeout):
    t0 = time.time()
    try:
        r = requests.post(f"{base_url}/predict", json={"company_name": name, "website_url": site or "", "email": ""},
                          timeout=timeout)
        r.raise_for_status()
        j = r.json()
        u = j.get("user_result", {})
        return dict(band=u.get("band") or j.get("risk_level"), score=j.get("risk_score"), score_band=j.get("risk_level"),
                    high_reason=u.get("high_reason"),
                    ml_score=(j.get("score_breakdown") or {}).get("ml_score"),
                    reg_score=(j.get("score_breakdown") or {}).get("registration_score"),
                    rep_score=(j.get("score_breakdown") or {}).get("reputation_score"),
                    web_score=(j.get("score_breakdown") or {}).get("website_score"),
                    website_checked=j.get("website_checked"),
                    auto_site=(j.get("features_used") or {}).get("auto_searched_website"),
                    confidence=j.get("confidence"),
                    thin=u.get("thin_evidence"), registration=j.get("registration_status"),
                    seconds=round(time.time() - t0, 1), error="")
    except Exception as exc:
        return dict(band="ERROR", score=None, score_band=None, high_reason=None, thin=None, registration=None,
                    seconds=round(time.time() - t0, 1), error=str(exc)[:120])


def summarize(df: pd.DataFrame) -> str:
    ok = df[df.band.isin(["Low", "Medium", "High"])].copy()
    ok["label"] = ok["label"].str.lower().str.strip()
    out = []
    out.append(f"Calls: {len(df)}   usable: {len(ok)}   errors: {(df.band == 'ERROR').sum()}")
    tab = pd.crosstab(ok["label"], ok["band"]).reindex(columns=["Low", "Medium", "High"], fill_value=0)
    out += ["", "Band by true label (rows = truth):", tab.to_string()]
    leg, fr = ok[ok.label == "legit"], ok[ok.label == "fraud"]
    if len(fr):
        out.append(f"\nFraud in Low band (missed fraud):        {(fr.band == 'Low').sum()}/{len(fr)}")
        out.append(f"Fraud in High band:                      {(fr.band == 'High').sum()}/{len(fr)}")
        out.append(f"Fraud in Medium band (needs review):     {(fr.band == 'Medium').sum()}/{len(fr)}")
    if len(leg):
        out.append(f"Legit in High band (false alarms):       {(leg.band == 'High').sum()}/{len(leg)}")
        out.append(f"Legit in Medium band (needs review):     {(leg.band == 'Medium').sum()}/{len(leg)}")
        out.append(f"Legit in Low band (correct):             {(leg.band == 'Low').sum()}/{len(leg)}")
    # two-way view: Medium counted as "flagged" (not trusted)
    if len(ok):
        flagged = ok.band != "Low"
        tp = ((ok.label == "fraud") & flagged).sum(); fn = ((ok.label == "fraud") & ~flagged).sum()
        fp = ((ok.label == "legit") & flagged).sum(); tn = ((ok.label == "legit") & ~flagged).sum()
        out.append(f"\nMedium+High treated as 'not trusted': fraud caught {tp}/{tp+fn}, legit wrongly flagged {fp}/{fp+tn}")
        hi = ok.band == "High"
        tp = ((ok.label == "fraud") & hi).sum(); fp = ((ok.label == "legit") & hi).sum()
        out.append(f"High only treated as 'fraud':          fraud caught {tp}/{(ok.label=='fraud').sum()}, legit wrongly flagged {fp}/{(ok.label=='legit').sum()}")
    # per group (type column) - the table the report needs
    if "type" in ok.columns and ok["type"].astype(str).str.strip().ne("").any():
        ok["type"] = ok["type"].astype(str).str.strip().replace("", "unspecified")
        grp = pd.crosstab([ok["label"], ok["type"]], ok["band"]).reindex(columns=["Low", "Medium", "High"], fill_value=0)
        out += ["", "Band by group (label, type):", grp.to_string()]
    # stability across repeated calls
    g = ok.groupby("company_name")["band"].nunique()
    unstable = g[g > 1]
    out.append(f"\nCompanies whose band changed between repeats: {len(unstable)}" + (f" -> {', '.join(unstable.index)}" if len(unstable) else ""))
    out.append(f"Median response time: {df.seconds.median():.1f}s   max: {df.seconds.max():.1f}s")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True, type=Path)
    ap.add_argument("--base-url", default="http://127.0.0.1:8001")
    ap.add_argument("--repeat", type=int, default=1, help="calls per company (checks stability)")
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--delay", type=float, default=0, help="seconds to wait between calls (avoids search rate-limiting on long runs)")
    ap.add_argument("--out-dir", type=Path, default=Path("analysis_output/live"))
    a = ap.parse_args()
    a.out_dir.mkdir(parents=True, exist_ok=True)
    src = pd.read_csv(a.input, encoding="utf-8-sig").fillna("")
    src.columns = [c.strip() for c in src.columns]
    src = src[src["company_name"].astype(str).str.strip() != ""].reset_index(drop=True)
    src["label"] = src["label"].astype(str).str.lower().str.strip()
    bad = src[~src["label"].isin(["legit", "fraud"])]
    if len(bad):
        raise SystemExit("Fix these rows - label must be exactly legit or fraud:\n" + bad[["company_name", "label"]].to_string())
    print(f"{len(src)} companies x {a.repeat} run(s). Results are saved after every call.")
    rows = []
    for i, r in src.iterrows():
        for k in range(a.repeat):
            res = call_api(a.base_url, r["company_name"], r.get("website_url", ""), a.timeout)
            rows.append({**r.to_dict(), "run": k + 1, **res})
            print(f"[{i+1}/{len(src)}] {r['company_name']:35s} run{k+1}: {res['band']:7s} {res['score']}  ({res['seconds']}s)")
            pd.DataFrame(rows).to_csv(a.out_dir / "live_results.csv", index=False)
            if a.delay:
                time.sleep(a.delay)
    df = pd.DataFrame(rows)
    df.to_csv(a.out_dir / "live_results.csv", index=False)
    text = summarize(df)
    (a.out_dir / "live_summary.txt").write_text(text, encoding="utf-8")
    print("\n" + text)


if __name__ == "__main__":
    main()
