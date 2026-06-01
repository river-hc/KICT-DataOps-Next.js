import argparse
import json
import math
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config-path", required=True)
    args = parser.parse_args()

    config_path = Path(args.config_path)
    config = json.loads(config_path.read_text(encoding="utf-8"))

    job_id = config["job_id"]
    params = config.get("parameters", {})
    epochs = int(params.get("epochs", 5))
    lr = float(params.get("learning_rate", 0.001))
    output_dir = Path(config["output_dir"])
    result_path = Path(config["result_path"])

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[INFO] multi.py started. job_id={job_id}")
    print(f"[INFO] epochs={epochs}, learning_rate={lr}")

    loss = 1.2
    accuracy = 0.0

    for epoch in range(1, epochs + 1):
        time.sleep(1)
        loss = loss * math.exp(-lr * 4) + 0.04 * (1 - epoch / epochs)
        accuracy = 1 - loss * 0.75
        rmse = math.sqrt(max(loss, 0))
        print(f"[INFO] Epoch {epoch}/{epochs} - loss={loss:.4f}, accuracy={accuracy:.4f}")

    model_path = output_dir / "model.pt"
    model_path.write_text("dummy multi model weights", encoding="utf-8")

    predict_path = output_dir / "predict.csv"
    predict_path.write_text("id,prediction\n1,0.88\n2,0.91\n3,0.79\n", encoding="utf-8")

    loss_plot_path = output_dir / "loss_plot.png"
    loss_plot_path.write_bytes(b"")

    result = {
        "status": "COMPLETED",
        "run_name": config.get("experiment_name", "multi-run"),
        "version": "v1",
        "metrics": {
            "loss": round(loss, 4),
            "accuracy": round(accuracy, 4),
            "rmse": round(rmse, 4),
        },
        "artifacts": [
            {"type": "model", "name": "model.pt", "path": str(model_path)},
            {"type": "prediction", "name": "predict.csv", "path": str(predict_path)},
            {"type": "plot", "name": "loss_plot.png", "path": str(loss_plot_path)},
        ],
    }
    result_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print("[INFO] training completed")


if __name__ == "__main__":
    main()
