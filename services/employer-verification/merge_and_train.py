"""
Merge new datasets with existing training dataset and retrain model.

This script:
1. Merges fake_dataset.csv + new_dataset_v1_training.csv
2. Combines with existing training_dataset.csv
3. Saves merged dataset
4. Trains the model with full dataset

Usage:
    python merge_and_train.py
"""

import pandas as pd
import os
from pathlib import Path

# Paths
DATA_DIR = Path("data")
FINAL_DIR = DATA_DIR / "final"
FAKE_CSV = DATA_DIR / "fake_dataset.csv"
NEW_LEGIT_CSV = FINAL_DIR / "new_dataset_v1_training.csv"
EXISTING_TRAINING = FINAL_DIR / "training_dataset.csv"
MERGED_OUTPUT = FINAL_DIR / "merged_full_training_dataset.csv"

print("\n" + "="*70)
print("STEP 1: LOAD DATASETS")
print("="*70)

# Load datasets
print(f"\n[1] Loading fake dataset from: {FAKE_CSV}")
fake_df = pd.read_csv(FAKE_CSV)
print(f"    Rows: {len(fake_df)} | Columns: {fake_df.columns.tolist()[:4]}...")

print(f"\n[2] Loading new legit dataset from: {NEW_LEGIT_CSV}")
legit_df = pd.read_csv(NEW_LEGIT_CSV)
print(f"    Rows: {len(legit_df)} | Columns: {legit_df.columns.tolist()[:4]}...")

print(f"\n[3] Loading existing training dataset from: {EXISTING_TRAINING}")
existing_df = pd.read_csv(EXISTING_TRAINING)
print(f"    Rows: {len(existing_df)} | Columns: {existing_df.columns.tolist()[:4]}...")

# ========================================================================
print("\n" + "="*70)
print("STEP 2: PREPARE NEW DATA FOR MERGE")
print("="*70)

# Drop unnecessary columns from fake_dataset
fake_cols_to_keep = ['company_name', 'website_url', 'label']
print(f"\n[2a] Cleaning fake dataset...")
print(f"     Original columns: {fake_df.columns.tolist()}")
fake_df_clean = fake_df[fake_cols_to_keep].copy()
fake_df_clean['label'] = 0  # Ensure label is 0 for fake
print(f"     Kept columns: {fake_cols_to_keep}")
print(f"     Fake rows with label=0: {(fake_df_clean['label']==0).sum()}")

# Legit dataset already has all features
legit_df_clean = legit_df.copy()
legit_df_clean['label'] = 1  # Ensure label is 1 for legit
print(f"\n[2b] Cleaning legit dataset...")
print(f"     Total columns: {len(legit_df_clean.columns)}")
print(f"     Legit rows with label=1: {(legit_df_clean['label']==1).sum()}")

# Get all columns from existing training dataset
existing_cols = existing_df.columns.tolist()
print(f"\n[2c] Target column structure from existing training_dataset:")
print(f"     Total columns: {len(existing_cols)}")
print(f"     Columns: {existing_cols}")

# ========================================================================
print("\n" + "="*70)
print("STEP 3: MERGE DATASETS")
print("="*70)

# Combine fake + new legit datasets
print(f"\n[3a] Combining fake + new legit datasets...")
new_combined = pd.concat([fake_df_clean, legit_df_clean], ignore_index=True)
print(f"     Combined rows: {len(new_combined)}")
print(f"     Fake (0): {(new_combined['label']==0).sum()}")
print(f"     Legit (1): {(new_combined['label']==1).sum()}")

# Merge with existing training dataset
print(f"\n[3b] Merging with existing training dataset...")

# Align columns: use only columns that exist in both
common_cols = [c for c in existing_cols if c in new_combined.columns]
print(f"     Common columns: {len(common_cols)}/{len(existing_cols)}")

# Add missing columns to new_combined (fill with 0 or appropriate defaults)
missing_cols = [c for c in existing_cols if c not in new_combined.columns]
if missing_cols:
    print(f"     Missing columns in new data: {missing_cols[:5]}...")
    for col in missing_cols:
        new_combined[col] = 0  # Default fill value
        
# Select only columns from existing_cols
new_combined_aligned = new_combined[existing_cols].copy()

# Concatenate with existing dataset
full_df = pd.concat([existing_df, new_combined_aligned], ignore_index=True)
print(f"     Full merged dataset rows: {len(full_df)}")
print(f"     Total Fake (0): {(full_df['label']==0).sum()}")
print(f"     Total Legit (1): {(full_df['label']==1).sum()}")

# ========================================================================
print("\n" + "="*70)
print("STEP 4: SAVE MERGED DATASET")
print("="*70)

os.makedirs(FINAL_DIR, exist_ok=True)
full_df.to_csv(MERGED_OUTPUT, index=False)
print(f"\n✅ Saved merged dataset → {MERGED_OUTPUT}")
print(f"   Total rows: {len(full_df)}")
print(f"   Columns: {len(full_df.columns)}")

# ========================================================================
print("\n" + "="*70)
print("STEP 5: DATASET STATISTICS")
print("="*70)

print(f"\nClass Distribution:")
print(f"  Fake (label=0)   : {(full_df['label']==0).sum():4d} ({(full_df['label']==0).sum()/len(full_df)*100:.1f}%)")
print(f"  Legit (label=1)  : {(full_df['label']==1).sum():4d} ({(full_df['label']==1).sum()/len(full_df)*100:.1f}%)")
print(f"  Total            : {len(full_df):4d}")

print(f"\nMissing values per column (top 10):")
missing = full_df.isna().sum()
missing_sorted = missing[missing > 0].sort_values(ascending=False)
if len(missing_sorted) > 0:
    print(missing_sorted.head(10).to_string())
else:
    print("  None!")

print("\n" + "="*70)
print("✅ MERGE COMPLETE - Ready to train!")
print("="*70)
print("\nNext step:")
print("  python app/employer_verification_model/final_realistic_model.py")
print("\n")
