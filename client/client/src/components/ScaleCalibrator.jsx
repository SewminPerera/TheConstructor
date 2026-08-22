import { useState, useRef, useEffect, useCallback } from "react";
import "./ScaleCalibrator.css";

export default function ScaleCalibrator({ previewUrl, onApply, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [realDistance, setRealDistance] = useState("");
  const [imgScale, setImgScale] = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });

  // Load image and draw it onto the canvas
  useEffect(() => {
    if (!previewUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      drawCanvas(img, []);
    };
    img.src = previewUrl;
  }, [previewUrl]);

  const drawCanvas = useCallback(
    (img, pts) => {
      const canvas = canvasRef.current;
      if (!canvas || !img) return;
      const ctx = canvas.getContext("2d");

      const maxW = canvas.parentElement.clientWidth - 32;
      const maxH = 500;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      setImgScale(scale);
      setImgOffset({ x: 0, y: 0 });

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw points and line
      pts.forEach((pt, i) => {
        ctx.beginPath();
        ctx.arc(pt.x * scale, pt.y * scale, 6, 0, Math.PI * 2);
        ctx.fillStyle = i === 0 ? "#F59E0B" : "#10B981";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(pt.x * scale - 12, pt.y * scale);
        ctx.lineTo(pt.x * scale + 12, pt.y * scale);
        ctx.moveTo(pt.x * scale, pt.y * scale - 12);
        ctx.lineTo(pt.x * scale, pt.y * scale + 12);
        ctx.strokeStyle = i === 0 ? "#F59E0B" : "#10B981";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      if (pts.length === 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x * scale, pts[0].y * scale);
        ctx.lineTo(pts[1].x * scale, pts[1].y * scale);
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Show pixel distance
        const pxDist = Math.sqrt(
          (pts[1].x - pts[0].x) ** 2 + (pts[1].y - pts[0].y) ** 2
        );
        const midX = ((pts[0].x + pts[1].x) / 2) * scale;
        const midY = ((pts[0].y + pts[1].y) / 2) * scale - 10;
        ctx.font = "12px DM Sans, sans-serif";
        ctx.fillStyle = "#F59E0B";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(pxDist)} px`, midX, midY);
      }
    },
    []
  );

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / imgScale;
    const y = (e.clientY - rect.top) / imgScale;

    const newPoints = points.length >= 2 ? [{ x, y }] : [...points, { x, y }];
    setPoints(newPoints);
    if (imgRef.current) drawCanvas(imgRef.current, newPoints);
  };

  const pixelDistance =
    points.length === 2
      ? Math.sqrt(
          (points[1].x - points[0].x) ** 2 +
            (points[1].y - points[0].y) ** 2
        )
      : 0;

  const computedRatio =
    pixelDistance > 0 && parseFloat(realDistance) > 0
      ? parseFloat(realDistance) / pixelDistance
      : 0;

  const canApply = computedRatio > 0;

  const handleApply = () => {
    if (canApply) {
      onApply(computedRatio);
    }
  };

  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
        <button className="sc-close" onClick={onClose}>
          &times;
        </button>

        <h2 className="sc-title">Scale Calibration</h2>
        <p className="sc-subtitle">
          Click two points on the blueprint, then enter the real-world distance
          between them.
        </p>

        <div className="sc-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="sc-canvas"
            onClick={handleCanvasClick}
          />
        </div>

        <div className="sc-steps">
          <div className={`sc-step ${points.length >= 1 ? "done" : ""}`}>
            <span className="sc-dot" style={{ background: "#F59E0B" }} />
            Point A {points.length >= 1 && "✓"}
          </div>
          <div className={`sc-step ${points.length >= 2 ? "done" : ""}`}>
            <span className="sc-dot" style={{ background: "#10B981" }} />
            Point B {points.length >= 2 && "✓"}
          </div>
          <div className={`sc-step ${canApply ? "done" : ""}`}>
            <span className="sc-dot" style={{ background: "#6366F1" }} />
            Enter distance
          </div>
        </div>

        {points.length === 2 && (
          <div className="sc-input-row">
            <label className="sc-label">Real-world distance (metres):</label>
            <input
              type="number"
              className="sc-input"
              min="0.1"
              step="0.1"
              value={realDistance}
              onChange={(e) => setRealDistance(e.target.value)}
              placeholder="e.g. 5.0"
              autoFocus
            />
          </div>
        )}

        {canApply && (
          <div className="sc-result">
            Scale: 1 pixel = {(computedRatio * 1000).toFixed(2)} mm
          </div>
        )}

        <div className="sc-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-amber"
            disabled={!canApply}
            onClick={handleApply}
          >
            Apply Calibration
          </button>
        </div>
      </div>
    </div>
  );
}
