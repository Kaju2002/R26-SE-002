# Weight Sensitivity Analysis — Employer Verification

- **Dataset:** `data/final_realistic_dataset.csv`
- **Rows:** 1514 (Legitimate: 978, Fraudulent: 536)
- **ML probability source:** trained model
- **Decision cutoff:** score ≥ 45% → Legitimate (in this experiment)

- **Chosen product weights:** 40% ML / 30% Registry / 20% Reputation / 10% Website  
- Accuracy **76.5%**, F1 **83.0%**, Fraud recall **54.9%**, FPR **45.1%**

### How to read this
- **Proposed Baseline (40/30/20/10)** is the weight set used in FraudAware.
- Grid-search “best” F1 (60% ML / 0% Registry / 40% Reputation / 0% Website) is **not** used in the app — it removes official registration, which we need for explainability and Sri Lanka trust signals.
- **Registry-Heavy** and **Reputation-Ignored** have the **highest false-positive rates** (~54–57%) — worse for legitimate SMEs.

## Experiment 1 — Predefined weight profiles

| Profile | ML % | Registry % | Reputation % | Website % | Accuracy | Precision | Recall | F1-Score | Fraud Recall | False Positive Rate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Proposed Baseline | 40% | 30% | 20% | 10% | 76.5% | 78.1% | 88.4% | 83.0% | 54.9% | 45.1% |
| ML-Dominant | 70% | 10% | 10% | 10% | 77.8% | 77.3% | 92.9% | 84.4% | 50.2% | 49.8% |
| Registry-Heavy | 20% | 60% | 10% | 10% | 72.9% | 74.7% | 87.9% | 80.8% | 45.5% | 54.5% |
| Equal Weights | 25% | 25% | 25% | 25% | 76.5% | 78.7% | 87.2% | 82.7% | 56.9% | 43.1% |
| Reputation-Ignored | 50% | 40% | 0% | 10% | 75.7% | 75.0% | 93.5% | 83.2% | 43.3% | 56.7% |

## Experiment 2 — Top grid-search results (by F1)

| Weights (ML / Registry / Reputation / Website) | Accuracy | Precision | Recall | F1-Score | Fraud Recall | False Positive Rate |
| --- | --- | --- | --- | --- | --- | --- |
| 0.60 / 0.00 / 0.40 / 0.00 | 86.2% | 93.5% | 84.6% | 88.8% | 89.2% | 10.8% |
| 0.60 / 0.05 / 0.35 / 0.00 | 85.9% | 91.5% | 86.1% | 88.7% | 85.5% | 14.5% |
| 0.65 / 0.00 / 0.35 / 0.00 | 85.5% | 90.8% | 86.2% | 88.5% | 84.1% | 15.9% |
| 0.55 / 0.05 / 0.40 / 0.00 | 85.9% | 93.8% | 83.6% | 88.4% | 89.9% | 10.1% |
| 0.60 / 0.00 / 0.35 / 0.05 | 85.4% | 90.9% | 86.0% | 88.4% | 84.3% | 15.7% |
| 0.55 / 0.00 / 0.35 / 0.10 | 85.3% | 90.9% | 85.8% | 88.3% | 84.3% | 15.7% |
| 0.55 / 0.00 / 0.40 / 0.05 | 85.5% | 93.5% | 83.4% | 88.2% | 89.4% | 10.6% |
| 0.50 / 0.10 / 0.40 / 0.00 | 85.2% | 93.6% | 82.7% | 87.8% | 89.7% | 10.3% |
| 0.50 / 0.05 / 0.40 / 0.05 | 85.2% | 93.9% | 82.4% | 87.8% | 90.3% | 9.7% |
| 0.55 / 0.05 / 0.35 / 0.05 | 84.7% | 90.9% | 84.9% | 87.8% | 84.5% | 15.5% |

Highest F1 often sets **Registry = 0%**. We reject that for the product. We keep **40/30/20/10** because Registry-Heavy and Reputation-Ignored worsen FPR, and zero-registry weights are not acceptable for FraudAware.

## Experiment 3 — Why weights matter (edge case idea)
Changing weights can move the same company between Low / Medium / High risk bands. That shows the weight choice is not cosmetic — it changes user-facing decisions.
