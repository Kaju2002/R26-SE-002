"""
Merge all training datasets into one final training dataset.

This script merges:
1. training_dataset.csv (existing training data)
2. fake_training_dataset.csv (new fake job companies)
3. new_dataset_v1_training.csv (new legit employers)

Into: complete_training_dataset.csv
"""

import pandas as pd
import os
from pathlib import Path

FINAL_DIR = Path("data/final")

print("\n" + "="*70)
print("MERGING ALL TRAINING DATASETS")
print("="*70)

# Load all datasets
datasets = {
    "Existing Training": FINAL_DIR / "training_dataset.csv",
    "New Fake Processed": FINAL_DIR / "fake_training_dataset.csv",
    "New Legit Data": FINAL_DIR / "new_dataset_v1_training.csv",
}

dfs = {}
total_rows = 0

print("\n[STEP 1] Loading datasets...\n")
for name, path in datasets.items():
    print(f"  Loading: {path.name}")
    df = pd.read_csv(path)
    dfs[name] = df
    fake_count = (df['label'] == 0).sum()
    legit_count = (df['label'] == 1).sum()
    print(f"    Rows: {len(df)} | Fake: {fake_count} | Legit: {legit_count}")
    total_rows += len(df)

# Merge all datasets
print(f"\n[STEP 2] Merging datasets...\n")
merged_df = pd.concat(list(dfs.values()), ignore_index=True)

print(f"  ✅ Merged successfully!")
print(f"     Total rows: {len(merged_df)}")
print(f"     Total Fake (0): {(merged_df['label']==0).sum()}")
print(f"     Total Legit (1): {(merged_df['label']==1).sum()}")

# Remove duplicates (if any)
print(f"\n[STEP 3] Removing duplicates...\n")
duplicates_before = len(merged_df)
merged_df = merged_df.drop_duplicates(subset=['company_name', 'website_url'], keep='first')
duplicates_removed = duplicates_before - len(merged_df)
print(f"  Duplicates removed: {duplicates_removed}")
print(f"  Final rows: {len(merged_df)}")

# Final statistics
print(f"\n" + "="*70)
print("FINAL DATASET STATISTICS")
print("="*70)

print(f"\nClass Distribution:")
fake_final = (merged_df['label'] == 0).sum()
legit_final = (merged_df['label'] == 1).sum()
print(f"  Fake (0)  : {fake_final:4d} ({fake_final/len(merged_df)*100:.1f}%)")
print(f"  Legit (1) : {legit_final:4d} ({legit_final/len(merged_df)*100:.1f}%)")
print(f"  Total     : {len(merged_df):4d}")

print(f"\nDataset Info:")
print(f"  Columns: {len(merged_df.columns)}")
print(f"  Missing values: {merged_df.isna().sum().sum()}")

# Save merged dataset
output_path = FINAL_DIR / "complete_training_dataset.csv"
merged_df.to_csv(output_path, index=False)

print(f"\n" + "="*70)
print(f"✅ SAVED: {output_path}")
print("="*70)
print(f"\nNext step: Train the model using this dataset")
print(f"  python app/employer_verification_model/final_realistic_model.py")
print()
