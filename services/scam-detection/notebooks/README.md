# Scam Detection — Research Notebooks

Run these scripts **in numbered order**. Each one consumes the output of the previous.

## Setup (once)

```bash
cd services/scam-detection
pip install -r notebooks/requirements.txt
```

## Pipeline

### `01_data_cleaning.py`
- **Input:**  `data/raw/communication_dataset.csv`, `data/raw/realdata_1.csv`
- **Output:** `data/cleaned/cleaned_synthetic.csv`, `data/cleaned/cleaned_real.csv`
- **Runtime:** ~5 seconds
- **What it does:** Fixes encoding, collapses 56 messy tactic labels into 4 clean
  binary columns, normalizes platform/speaker, makes synthetic + real datasets share
  one schema so they can be combined for training.

### `02_data_augmentation.py`
- **Input:**  `data/cleaned/cleaned_real.csv`
- **Output:** `data/augmented/augmented_real.csv` (105 originals + ~315 augmented)
- **Runtime:** 15-25 minutes (uses free Google Translate)
- **What it does:** Multiplies each real sample 4× via back-translation through
  Sinhala, Tamil, and French. Augmented samples preserve the same label and
  tactic — only wording changes. **Always review `samples_for_review.txt`
  after running** to confirm quality.

## Coming next (will be added)

- `03_baseline_tfidf.py` — TF-IDF + Logistic Regression baseline
- `04_distilbert_finetune.ipynb` — Fine-tune DistilBERT on combined dataset
- `05_evaluate_on_real.ipynb` — Final evaluation on held-out real test set

## Important rules

1. **Never run scripts out of order** — later steps assume earlier outputs exist.
2. **The `data/` folder is gitignored** — datasets stay local, not in git.
3. **Re-run `01_data_cleaning.py` whenever raw data changes.** Re-run
   `02_data_augmentation.py` only when you collect more real samples; it's slow.
