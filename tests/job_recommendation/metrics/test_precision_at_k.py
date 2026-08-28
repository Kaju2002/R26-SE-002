"""Metric helpers for panel / viva (Precision@K on recommendation lists)."""

import pytest


def precision_at_k(recommended: list[str], relevant: set[str], k: int) -> float:
    """Fraction of top-k recommendations that are in the ground-truth relevant set."""
    if k <= 0:
        return 0.0
    top_k = recommended[:k]
    if not top_k:
        return 0.0
    hits = sum(1 for job_id in top_k if job_id in relevant)
    return hits / len(top_k)


def recall_at_k(recommended: list[str], relevant: set[str], k: int) -> float:
    if not relevant or k <= 0:
        return 0.0
    top_k = recommended[:k]
    hits = sum(1 for job_id in top_k if job_id in relevant)
    return hits / len(relevant)


def test_precision_at_k_perfect_top2(samples: dict):
  gt = samples["ground_truth"]
  relevant = set(gt["relevant_job_ids"])
  ordered = gt["recommended_order"]

  assert precision_at_k(ordered, relevant, k=2) == 1.0


def test_precision_at_k_partial_top3(samples: dict):
  gt = samples["ground_truth"]
  relevant = set(gt["relevant_job_ids"])
  ordered = gt["recommended_order"]

  assert precision_at_k(ordered, relevant, k=3) == pytest.approx(2 / 3)


def test_recall_at_k_finds_all_relevant(samples: dict):
  gt = samples["ground_truth"]
  relevant = set(gt["relevant_job_ids"])
  ordered = gt["recommended_order"]

  assert recall_at_k(ordered, relevant, k=2) == 1.0


def test_empty_recommendations():
  assert precision_at_k([], {"a"}, k=5) == 0.0
  assert recall_at_k([], {"a"}, k=5) == 0.0
