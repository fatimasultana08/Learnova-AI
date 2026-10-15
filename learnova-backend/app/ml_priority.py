"""
ML Revision-Priority Component
Uses scikit-learn to classify topics (chapters) as High / Medium / Low revision priority.

When insufficient real data exists, falls back to a transparent rule-based classifier
and clearly labels predictions as rule-based.

Features used:
  - quiz_accuracy     (0–1)
  - quiz_attempts     (int)
  - incorrect_ratio   (0–1)
  - days_since_revision (int, 0–999)
  - confidence        (0–100)
  - completion_status (0=not_started, 1=in_progress, 2=completed, 3=needs_revision)

Labels: 0=Low, 1=Medium, 2=High (revision priority)
"""
import logging
import pickle
from pathlib import Path
from typing import List, Dict, Any, Tuple

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MODEL_PATH = Path("./ml_model.pkl").resolve()

STATUS_MAP = {
    "not_started": 0,
    "in_progress": 1,
    "completed": 2,
    "needs_revision": 3,
}


# ---------------------------------------------------------------------------
# Feature extraction
# ---------------------------------------------------------------------------

def extract_features(chapter_data: Dict[str, Any]) -> List[float]:
    """Convert chapter analytics dict to feature vector."""
    quiz_attempts = chapter_data.get("quiz_attempts", 0)
    correct = chapter_data.get("correct_answers", 0)
    incorrect = chapter_data.get("incorrect_answers", 0)
    total_q = correct + incorrect

    quiz_accuracy = (correct / total_q) if total_q > 0 else 0.5
    incorrect_ratio = (incorrect / total_q) if total_q > 0 else 0.5
    days_since_revision = min(chapter_data.get("days_since_revision", 30), 365)
    confidence = chapter_data.get("confidence", 50) / 100.0
    status = STATUS_MAP.get(chapter_data.get("status", "not_started"), 0)

    return [
        quiz_accuracy,
        float(quiz_attempts),
        incorrect_ratio,
        float(days_since_revision),
        confidence,
        float(status),
    ]


# ---------------------------------------------------------------------------
# Rule-based fallback
# ---------------------------------------------------------------------------

def rule_based_priority(features: List[float]) -> Tuple[str, float]:
    """
    Transparent rule-based classifier used when the ML model lacks sufficient data.
    Returns (priority_label, confidence_score).
    """
    quiz_accuracy, attempts, incorrect_ratio, days_since, confidence, status = features

    score = 0.0
    # low quiz accuracy → higher priority
    score += (1 - quiz_accuracy) * 40
    # many days since revision
    score += min(days_since / 365, 1) * 30
    # low confidence
    score += (1 - confidence) * 20
    # needs_revision status
    if status == 3:
        score += 10

    if score >= 55:
        return "High", min(score / 100, 0.95)
    elif score >= 30:
        return "Medium", min(score / 100, 0.95)
    else:
        return "Low", min((100 - score) / 100, 0.95)


# ---------------------------------------------------------------------------
# Sample training data (for demonstration when real data is insufficient)
# ---------------------------------------------------------------------------

def _get_sample_training_data() -> Tuple[np.ndarray, np.ndarray]:
    """
    Returns clearly-identified synthetic training examples.
    Used ONLY when real chapter data is insufficient for ML training.
    """
    # [accuracy, attempts, incorrect_ratio, days_since, confidence, status]
    # Labels: 0=Low, 1=Medium, 2=High
    X = np.array([
        # High priority examples
        [0.3, 5, 0.7, 20, 0.3, 3],  # low accuracy, needs revision
        [0.4, 3, 0.6, 30, 0.4, 1],
        [0.2, 2, 0.8, 45, 0.2, 0],
        [0.35, 4, 0.65, 60, 0.35, 3],
        [0.25, 6, 0.75, 25, 0.3, 1],
        # Medium priority examples
        [0.6, 4, 0.4, 10, 0.6, 2],
        [0.55, 3, 0.45, 15, 0.55, 1],
        [0.65, 5, 0.35, 20, 0.6, 2],
        [0.5, 2, 0.5, 12, 0.5, 1],
        [0.6, 4, 0.4, 18, 0.65, 2],
        # Low priority examples
        [0.85, 5, 0.15, 5, 0.85, 2],
        [0.9, 6, 0.1, 3, 0.9, 2],
        [0.8, 4, 0.2, 7, 0.8, 2],
        [0.88, 7, 0.12, 4, 0.88, 2],
        [0.82, 5, 0.18, 6, 0.85, 2],
    ], dtype=float)
    y = np.array([2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0])
    return X, y


# ---------------------------------------------------------------------------
# Model training
# ---------------------------------------------------------------------------

def train_model(real_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Train revision-priority classifier.
    Uses real chapter analytics if >= 10 samples, otherwise uses labelled sample data.
    Returns evaluation metrics.
    """
    use_sample = len(real_data) < 10
    data_source = "synthetic_sample" if use_sample else "real_chapter_data"

    if use_sample:
        X, y = _get_sample_training_data()
        metrics_note = (
            "Insufficient real data (< 10 chapters with quiz history). "
            "Model trained on clearly-identified synthetic sample data. "
            "Predictions are illustrative only until sufficient real data is collected."
        )
    else:
        X = np.array([extract_features(d) for d in real_data])
        y = np.array([d["label"] for d in real_data])  # 0=Low,1=Med,2=High
        metrics_note = f"Model trained on {len(real_data)} real chapter records."

    # Train/test split (only meaningful with real data)
    if len(X) >= 20:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        evaluate = True
    else:
        X_train, y_train = X, y
        X_test, y_test = X, y
        evaluate = False

    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", RandomForestClassifier(n_estimators=100, random_state=42)),
    ])
    pipeline.fit(X_train, y_train)

    # Persist model
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(pipeline, f)

    # Evaluate
    evaluation: Dict[str, Any] = {
        "data_source": data_source,
        "training_samples": len(X_train),
        "test_samples": len(X_test),
        "metrics_note": metrics_note,
        "train_accuracy": round(pipeline.score(X_train, y_train), 3),
        "evaluated_on_held_out": evaluate,
    }
    if evaluate:
        y_pred = pipeline.predict(X_test)
        report = classification_report(
            y_test, y_pred,
            target_names=["Low", "Medium", "High"],
            output_dict=True,
            zero_division=0,
        )
        evaluation["classification_report"] = report
        evaluation["test_accuracy"] = round(pipeline.score(X_test, y_test), 3)
        cm = confusion_matrix(y_test, y_pred).tolist()
        evaluation["confusion_matrix"] = cm

    return evaluation


# ---------------------------------------------------------------------------
# Prediction
# ---------------------------------------------------------------------------

def load_model() -> Pipeline:
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    raise FileNotFoundError("ML model not trained yet. Call /api/ml/train first.")


def predict_priority(chapter_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Predict revision priority for a single chapter.
    Falls back to rule-based if model unavailable.
    """
    features = extract_features(chapter_data)
    labels = ["Low", "Medium", "High"]

    try:
        model = load_model()
        pred = int(model.predict([features])[0])
        proba = model.predict_proba([features])[0].tolist()
        return {
            "priority": labels[pred],
            "confidence": round(max(proba), 3),
            "probabilities": {labels[i]: round(p, 3) for i, p in enumerate(proba)},
            "method": "ml_model",
        }
    except FileNotFoundError:
        priority, conf = rule_based_priority(features)
        return {
            "priority": priority,
            "confidence": round(conf, 3),
            "probabilities": None,
            "method": "rule_based_fallback",
            "note": "ML model not yet trained. Using transparent rule-based classifier.",
        }


def batch_predict(chapters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    results = []
    for ch in chapters:
        pred = predict_priority(ch)
        pred["chapter_id"] = ch.get("id")
        pred["chapter_title"] = ch.get("title", "")
        results.append(pred)
    return results
