"""
threshold_analysis.py - held-out evidence for fusion weights AND risk-band thresholds.

Run from the employer-verification folder:
    python notebooks/threshold_analysis.py
    (optional) python notebooks/threshold_analysis.py --csv data/final_realistic_dataset.csv

Protocol (no leakage):
  1. Domain-grouped split 60/20/20 -> train / validation / test
  2. Random Forest retrained on TRAIN only (same hyper-parameters as the product model)
  3. Weights and thresholds are chosen on VALIDATION only
  4. Everything is frozen, then reported once on TEST
Sub-scores (registry / reputation / website) reuse app.weight_sensitivity_analysis so the
numbers stay consistent with the PP2 sensitivity study.
"""
import argparse, os, sys, warnings
from pathlib import Path
warnings.filterwarnings("ignore")
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import numpy as np, pandas as pd
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit
from app.weight_sensitivity_analysis import (
    _derive_registry_score, _derive_reputation_score, _derive_website_score)

SEED = 42
FEATURES = ['has_https', 'is_http_only', 'subdomain_count', 'is_registered', 'has_about',
            'has_contact', 'has_privacy_policy', 'has_terms', 'has_payment_risk',
            'has_urgency_language', 'content_score', 'has_glassdoor', 'has_indeed',
            'has_trustpilot']
BASE_W = (0.40, 0.30, 0.20, 0.10)
PROFILES = {
    "Proposed baseline": BASE_W, "ML-dominant": (0.70, 0.10, 0.10, 0.10),
    "Registry-heavy": (0.20, 0.60, 0.10, 0.10), "Equal weights": (0.25, 0.25, 0.25, 0.25),
    "Reputation-ignored": (0.50, 0.40, 0.00, 0.10)}
FRAUD_RECALL_TARGET, LEGIT_PREC_TARGET = 0.90, 0.90
COST_RATIOS = (3, 5, 10)
THRESHOLDS = list(range(20, 85, 5))

ap = argparse.ArgumentParser()
ap.add_argument("--csv", default=str(ROOT / "data" / "final_realistic_dataset.csv"))
ap.add_argument("--out", default=str(ROOT / "outputs" / "threshold"))
a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(a.csv)
fraud = (df["label"] == 0).astype(int).values            # 1 = fraudulent
dom = (df["website_url"].fillna(df["company_name"]).astype(str).str.lower()
       .str.replace(r"^https?://(www\.)?", "", regex=True).str.split("/").str[0])
tr, tmp = next(GroupShuffleSplit(1, test_size=.4, random_state=SEED).split(df, fraud, dom))
v, t = next(GroupShuffleSplit(1, test_size=.5, random_state=SEED).split(df.iloc[tmp], fraud[tmp], dom.iloc[tmp]))
va, te = tmp[v], tmp[t]
print(f"rows={len(df)}  train={len(tr)} val={len(va)} test={len(te)}  "
      f"(fraud: {fraud[tr].sum()}/{fraud[va].sum()}/{fraud[te].sum()})")

rf = RandomForestClassifier(n_estimators=200, max_depth=8, min_samples_split=16, min_samples_leaf=8,
                            max_features="sqrt", class_weight="balanced", random_state=SEED)
rf.fit(df.iloc[tr][FEATURES].fillna(0), df["label"].iloc[tr])
P = rf.predict_proba(df[FEATURES].fillna(0))[:, 1]                   # P(legitimate)
R = np.column_stack([P, _derive_registry_score(df), _derive_reputation_score(df), _derive_website_score(df)])
score = lambda w: 100 * R @ np.array(w)

def wilson(k, n, z=1.96):
    if n == 0: return (np.nan, np.nan)
    p = k / n; d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d; h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return round(c - h, 3), round(c + h, 3)

def cls_metrics(ix, s, cut=45):
    # NOTE: FPR here = legitimate employers wrongly flagged risky / all legitimate.
    # (The old weight_sensitivity_analysis.py "False Positive Rate" was fraud approved / all fraud = 1 - Fraud Recall.)
    pred_legit = s[ix] >= cut; f = fraud[ix] == 1
    tp = (pred_legit & ~f).sum(); fp = (pred_legit & f).sum(); fn = (~pred_legit & ~f).sum(); tn = (~pred_legit & f).sum()
    prec, rec = tp / max(tp + fp, 1), tp / max(tp + fn, 1)
    return dict(Accuracy=(tp + tn) / len(ix), Precision=prec, Recall=rec,
                F1=2 * prec * rec / max(prec + rec, 1e-9), FraudRecall=tn / max(tn + fp, 1),
                FPR=fn / max(fn + tp, 1))

# ---------------- Part A: weights ----------------
rows = []
for name, w in PROFILES.items():
    for split, ix in (("validation", va), ("test", te)):
        rows.append(dict(profile=name, weights="/".join(f"{x:.2f}" for x in w), split=split, **cls_metrics(ix, score(w))))
grid, g = [], np.arange(0, 1.0001, .05)
for w1 in g:
    for w2 in g:
        for w3 in g:
            w4 = 1 - w1 - w2 - w3
            if w4 < -1e-9: continue
            w = (w1, w2, w3, max(w4, 0)); grid.append((w, cls_metrics(va, score(w))["F1"]))
best_all = max(grid, key=lambda x: x[1])[0]
nz = max((x for x in grid if min(x[0]) >= 0.05 - 1e-9), key=lambda x: x[1])[0]   # every source keeps >=5%
cands = [("Grid best (validation)", best_all)]
if tuple(round(x, 2) for x in nz) != tuple(round(x, 2) for x in best_all):
    cands.append(("Grid best, all sources >=5%", nz))
for name, w in cands:
    for split, ix in (("validation", va), ("test", te)):
        rows.append(dict(profile=name, weights="/".join(f"{x:.2f}" for x in w), split=split, **cls_metrics(ix, score(w))))
wt = pd.DataFrame(rows); wt.to_csv(out / "weight_profiles_val_test.csv", index=False)
pd.set_option("display.width", 200)
print("\nPART A - weight profiles on held-out TEST (cut-off 45)")
print(wt[wt.split == "test"].drop(columns="split").round(3).to_string(index=False))

# ---------------- Part B: thresholds (baseline weights) ----------------
s = score(BASE_W)
def sweep(ix):
    r = []
    for th in THRESHOLDS:
        fl = s[ix] < th; f = fraud[ix] == 1
        tp, fp, fn, tn = (fl & f).sum(), (fl & ~f).sum(), (~fl & f).sum(), (~fl & ~f).sum()
        r.append(dict(threshold=th, fraud_recall=tp / max(tp + fn, 1), FPR=fp / max(fp + tn, 1),
                      legit_precision_at_or_above=tn / max(tn + fn, 1),
                      **{f"cost_{k}to1": k * fn + fp for k in COST_RATIOS}))
    return pd.DataFrame(r)
sv = sweep(va); sv.to_csv(out / "threshold_sweep_validation.csv", index=False)
print("\nPART B - threshold sweep on VALIDATION (flag as risky if score < threshold)")
print(sv.round(3).to_string(index=False))
ok = sv[sv.fraud_recall >= FRAUD_RECALL_TARGET]
t_hm = int(ok.threshold.min()) if len(ok) else int(sv.loc[sv.fraud_recall.idxmax(), "threshold"])
ok2 = sv[(sv.legit_precision_at_or_above >= LEGIT_PREC_TARGET) & (sv.threshold > t_hm)]
t_ml = int(ok2.threshold.min()) if len(ok2) else int(sv.threshold.max())
cost_opt = {k: int(sv.loc[sv[f"cost_{k}to1"].idxmin(), "threshold"]) for k in COST_RATIOS}
print(f"\ncost-optimal threshold by FN:FP ratio: {cost_opt}")
print(f"validation-selected boundaries: High < {t_hm} <= Medium < {t_ml} <= Low")

fig, ax = plt.subplots(1, 2, figsize=(10, 3.8))
ax[0].plot(sv.threshold, sv.fraud_recall, "o-", label="Fraud recall")
ax[0].plot(sv.threshold, sv.FPR, "s-", label="False-positive rate")
ax[0].plot(sv.threshold, sv.legit_precision_at_or_above, "^-", label="Legit. precision (score >= t)")
ax[0].axhline(.9, color="grey", ls=":"); ax[0].set_xlabel("Score threshold t"); ax[0].legend(fontsize=7)
for k in COST_RATIOS: ax[1].plot(sv.threshold, sv[f"cost_{k}to1"], "o-", label=f"FN:FP = {k}:1")
ax[1].set_xlabel("Score threshold t"); ax[1].set_ylabel("Expected cost"); ax[1].legend(fontsize=7)
plt.tight_layout(); plt.savefig(out / "threshold_curves.png", dpi=300); plt.close()
plt.figure(figsize=(5, 3.4))
plt.hist(s[fraud == 0], bins=30, alpha=.6, label="Legitimate"); plt.hist(s[fraud == 1], bins=30, alpha=.6, label="Fraudulent")
for x in (45, 70): plt.axvline(x, color="k", ls="--")
plt.xlabel("Legitimacy score"); plt.ylabel("Employers"); plt.legend(); plt.tight_layout()
plt.savefig(out / "score_distribution.png", dpi=300); plt.close()

# ---------------- Part C: frozen evaluation on TEST ----------------
def bands(ix, hm, ml, name):
    b = np.where(s[ix] < hm, "High", np.where(s[ix] < ml, "Medium", "Low")); f = fraud[ix] == 1
    d = {k: (int(((b == k) & ~f).sum()), int(((b == k) & f).sum())) for k in ("High", "Medium", "Low")}
    nf, nl = int(f.sum()), int((~f).sum())
    row = dict(rule=name, **{f"{k}_legit/fraud": f"{v[0]}/{v[1]}" for k, v in d.items()},
               fraud_in_High=f"{d['High'][1]}/{nf}", High_CI=wilson(d['High'][1], nf),
               fraud_in_Low=f"{d['Low'][1]}/{sum(d['Low'])}", legit_in_Low=f"{d['Low'][0]}/{nl}",
               legit_in_Medium=f"{d['Medium'][0]}/{nl}")
    return row
bt = pd.DataFrame([bands(te, 45, 70, "original 45/70"), bands(te, t_hm, t_ml, f"validation-selected {t_hm}/{t_ml}")])
bt.to_csv(out / "risk_band_distribution_test.csv", index=False)
print("\nPART C - TEST set (frozen rules, evaluated once), entries are legit/fraud")
print(bt.T.to_string(header=False))
print(f"\nSaved to {out}")