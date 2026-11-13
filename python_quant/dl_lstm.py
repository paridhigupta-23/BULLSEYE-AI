"""Optional Deep Learning LSTM template for NIFTY 50 sequence prediction.

Requires TensorFlow/Keras (pip install tensorflow). Raises an explicit
ImportError notice when TensorFlow is absent rather than fabricating metrics.
"""

from typing import Tuple, Any


def check_dl_availability() -> Tuple[bool, str]:
    try:
        import tensorflow as tf  # type: ignore

        return True, f"TensorFlow {tf.__version__} available for LSTM sequence modeling."
    except ImportError:
        return (
            False,
            "TensorFlow is not installed in this environment. Install locally (`pip install tensorflow`) to train the 2-layer LSTM sequence classifier.",
        )


def build_lstm_model(sequence_length: int = 10, n_features: int = 13) -> Any:
    available, message = check_dl_availability()
    if not available:
        raise ImportError(message)

    import tensorflow as tf  # type: ignore

    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(sequence_length, n_features)),
            tf.keras.layers.LSTM(32, return_sequences=True),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.LSTM(16),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    return model
