"""Single entrypoint for the final selected TF-IDF + logistic eval flow.

Run from this folder: ``python tfidf_pipeline.py``
(Or: ``python tfidf_cv_threshold_external_eval.py`` / ``python tfidf_save_and_predict.py``.)
"""

from tfidf_cv_threshold_external_eval import main


if __name__ == "__main__":
    main()
