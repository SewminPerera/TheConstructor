"""
services/vision_services.py
---------------------------
Hybrid pipeline for image blueprint analysis.

Stage 1 — YOLOv8 (opening_model):
    Detect and count doors & windows.
    Collect door pixel sizes → used for pixel-to-metre scale.

Stage 2 — Scale determination:
    Priority: manual input > YOLO doors (SLS 0.84m ref) > default (15m/image width)

Stage 3 — OpenCV wall measurement:
    Adaptive threshold → HoughLinesP → angle filter (H/V ±15°) →
    merge parallel wall-face pairs → sum centerline lengths.

Stage 4 — Quality gate:
    If OpenCV yields <5 segments or <3 m total, fall back to
    the YOLO wall-skeleton method (kept for robustness).
"""
import math
import cv2
import numpy as np

# ── Model loading ─────────────────────────────────────────────────────────────

try:
    from ultralytics import YOLO
    wall_model    = YOLO("wall_model.pt")
    opening_model = YOLO("opening_model.pt")
    print("✅ AI Models Loaded Successfully")
except Exception as e:
    print(f"⚠️  AI Models not found — running without YOLO: {e}")
    wall_model    = None
    opening_model = None


# ── OpenCV helpers ────────────────────────────────────────────────────────────

def _deskew_image(img: np.ndarray) -> np.ndarray:
    """Detect and correct small rotations (1.5°–15°) in scanned blueprints.

    Uses the dominant Hough line angle to straighten the image before wall
    analysis.  Near-zero tilts and large intentional rotations are left alone.
    """
    gray  = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur  = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=80,
                            minLineLength=100, maxLineGap=10)
    if lines is None:
        return img

    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = math.degrees(math.atan2(y2 - y1, x2 - x1))
        # Normalise to nearest H/V axis: −45° … +45°
        while angle > 45:
            angle -= 90
        while angle < -45:
            angle += 90
        angles.append(angle)

    if not angles:
        return img

    median_angle = float(np.median(angles))

    # Correct only clear small tilts — skip near-zero and large rotations
    if abs(median_angle) < 1.5 or abs(median_angle) > 15.0:
        return img

    h, w = img.shape[:2]
    M     = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), median_angle, 1.0)
    # Expand canvas so corners are not clipped
    cos_a = abs(M[0, 0])
    sin_a = abs(M[0, 1])
    new_w = int(h * sin_a + w * cos_a)
    new_h = int(h * cos_a + w * sin_a)
    M[0, 2] += (new_w - w) / 2.0
    M[1, 2] += (new_h - h) / 2.0
    return cv2.warpAffine(img, M, (new_w, new_h),
                          flags=cv2.INTER_LINEAR,
                          borderValue=(255, 255, 255))


def _detect_walls_opencv(img: np.ndarray, pixel_ratio: float) -> list:
    """
    Detect wall line segments via Hough transform.

    Parameters
    ----------
    img          : BGR image
    pixel_ratio  : metres per pixel (used to set minimum segment length)

    Returns
    -------
    List of (x1, y1, x2, y2, length_px) tuples for candidate wall segments.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Light denoise — preserves thin wall lines
    gray = cv2.GaussianBlur(gray, (3, 3), 0)

    # Auto-detect polarity: dark lines on light bg (normal) vs light on dark
    mean_brightness = float(np.mean(gray))
    thresh_type = cv2.THRESH_BINARY_INV if mean_brightness > 128 else cv2.THRESH_BINARY

    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        thresh_type,
        blockSize=15, C=4,
    )

    # Close small gaps inside walls (door/window breaks) separately for H and V
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 1))
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 7))
    closed_h = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, h_kernel, iterations=2)
    closed_v = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, v_kernel, iterations=2)
    binary = cv2.bitwise_or(closed_h, closed_v)

    # Minimum segment = 5 cm in image pixels; gap tolerance = 1 cm
    min_len_px = max(20, int(0.05 / pixel_ratio))
    max_gap_px = max(5,  int(0.01 / pixel_ratio))

    lines = cv2.HoughLinesP(
        binary,
        rho=1,
        theta=np.pi / 180,
        threshold=40,
        minLineLength=min_len_px,
        maxLineGap=max_gap_px,
    )

    if lines is None:
        return []

    # Keep only structural (axis-aligned) lines: H ±15° or V ±15°
    segments = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))
        is_h = angle < 22 or angle > 158
        is_v = 68 < angle < 112
        if not (is_h or is_v):
            continue
        segments.append((x1, y1, x2, y2, math.hypot(x2 - x1, y2 - y1)))

    return segments


def _merge_wall_edges(segments: list, wall_thickness_px: float) -> list:
    """
    Architectural walls are drawn with two parallel lines (the two wall faces).
    Merge closely-spaced parallel segments into one representative centerline
    to avoid counting each wall twice.

    Two segments are considered "same wall" when:
    - Their angles differ by < 5°
    - Their perpendicular distance is < wall_thickness_px

    The longer segment of each pair is kept.
    """
    if not segments:
        return []

    used   = [False] * len(segments)
    merged = []

    for i in range(len(segments)):
        if used[i]:
            continue
        used[i] = True
        x1i, y1i, x2i, y2i, li = segments[i]
        best = segments[i]

        angle_i = math.atan2(y2i - y1i, x2i - x1i)
        # Unit normal perpendicular to segment i
        nx =  math.sin(angle_i)
        ny = -math.cos(angle_i)
        mx_i = (x1i + x2i) / 2.0
        my_i = (y1i + y2i) / 2.0

        for j in range(i + 1, len(segments)):
            if used[j]:
                continue
            x1j, y1j, x2j, y2j, lj = segments[j]

            # Angle similarity check
            angle_j = math.atan2(y2j - y1j, x2j - x1j)
            da = abs(angle_i - angle_j) % math.pi
            if min(da, math.pi - da) > math.radians(5):
                continue

            # Perpendicular distance between midpoints
            mx_j = (x1j + x2j) / 2.0
            my_j = (y1j + y2j) / 2.0
            perp_dist = abs((mx_j - mx_i) * nx + (my_j - my_i) * ny)

            if perp_dist < wall_thickness_px:
                used[j] = True
                if lj > best[4]:
                    best = segments[j]

        merged.append(best)

    return merged


# ── YOLO skeleton fallback (kept for robustness) ──────────────────────────────

def _prune_skeleton_branches(skel: np.ndarray, max_branch_len: int = 10) -> np.ndarray:
    """
    Remove short spurious branches from a thinned skeleton by iteratively
    removing endpoint pixels (exactly 1 neighbour in 8-connectivity).
    """
    sk = skel.copy()
    for _ in range(max_branch_len):
        neighbours = np.zeros_like(sk, dtype=np.int32)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dy == 0 and dx == 0:
                    continue
                shifted = np.roll(np.roll(sk, dy, axis=0), dx, axis=1)
                if dy == -1:
                    shifted[-1, :] = 0
                elif dy == 1:
                    shifted[0, :] = 0
                if dx == -1:
                    shifted[:, -1] = 0
                elif dx == 1:
                    shifted[:, 0] = 0
                neighbours += (shifted > 0).astype(np.int32)
        endpoints = ((sk > 0) & (neighbours == 1)).astype(np.uint8)
        if cv2.countNonZero(endpoints) == 0:
            break
        sk[endpoints > 0] = 0
    return sk


def _yolo_skeleton_length(img: np.ndarray, wall_boxes: list) -> float:
    """Skeletonise YOLO-detected wall regions and count pixel-length."""
    if img is None or not wall_boxes:
        return 0.0

    roi_mask = np.zeros(img.shape[:2], dtype=np.uint8)
    for (x1, y1, x2, y2) in wall_boxes:
        x1, y1, x2, y2 = map(int, [x1, y1, x2, y2])
        x1, y1 = max(x1, 0), max(y1, 0)
        x2, y2 = min(x2, img.shape[1] - 1), min(y2, img.shape[0] - 1)
        if x2 > x1 and y2 > y1:
            cv2.rectangle(roi_mask, (x1, y1), (x2, y2), 255, -1)

    gray        = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    wall_region = cv2.bitwise_and(gray, gray, mask=roi_mask)
    wall_region = cv2.normalize(wall_region, None, 0, 255, cv2.NORM_MINMAX)

    bw = cv2.adaptiveThreshold(
        wall_region, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 31, 7,
    )
    kernel = np.ones((3, 3), np.uint8)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel, iterations=2)
    bw = cv2.morphologyEx(bw, cv2.MORPH_OPEN,  kernel, iterations=1)

    img_area = img.shape[0] * img.shape[1]
    min_component_area = max(50, int(img_area * 0.00002))
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(bw, connectivity=8)
    cleaned = np.zeros_like(bw)
    for i in range(1, num_labels):
        if stats[i, cv2.CC_STAT_AREA] >= min_component_area:
            cleaned[labels == i] = 255
    bw = cleaned

    # Skeletonize
    skel    = np.zeros_like(bw)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    temp    = bw.copy()
    while True:
        eroded = cv2.erode(temp, element)
        opened = cv2.dilate(eroded, element)
        subset = cv2.subtract(temp, opened)
        skel   = cv2.bitwise_or(skel, subset)
        temp   = eroded
        if cv2.countNonZero(temp) == 0:
            break

    skel = _prune_skeleton_branches(skel, max_branch_len=10)

    sk   = (skel > 0).astype(np.uint8)
    hv   = int(np.sum(sk[:-1, :] & sk[1:, :]))
    hv  += int(np.sum(sk[:, :-1] & sk[:, 1:]))
    diag  = int(np.sum(sk[:-1, :-1] & sk[1:, 1:]))
    diag += int(np.sum(sk[:-1, 1:]  & sk[1:, :-1]))
    return float(hv + diag * math.sqrt(2))


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_with_hybrid(image_path: str, manual_width_m: float = 0.0) -> dict:
    """
    Hybrid pipeline: YOLO for openings/scale + OpenCV for wall geometry.

    Returns a dict with: walls, length_m, doors, windows, scale_source.
    """
    img = cv2.imread(image_path)
    if img is None:
        return {"walls": 0, "length_m": 0, "doors": 0, "windows": 0,
                "scale_source": "Error: could not read image"}

    img = _deskew_image(img)
    img_h, img_w = img.shape[:2]

    # ── Stage 1: YOLO — count openings, collect door pixel sizes ──────────────
    detected_door_sizes = []
    doors_count   = 0
    windows_count = 0

    if opening_model:
        for r in opening_model(image_path, conf=0.25):
            for box in r.boxes:
                name = opening_model.names[int(box.cls[0])].lower()
                x1, y1, x2, y2 = box.xyxy[0]
                side = min(float(x2 - x1), float(y2 - y1))
                if "door" in name:
                    detected_door_sizes.append(side)
                    doors_count += 1
                elif "window" in name:
                    windows_count += 1

    # ── Stage 2: Determine pixel → metre scale ────────────────────────────────
    if manual_width_m and float(manual_width_m) > 0.1:
        pixel_ratio  = float(manual_width_m) / img_w
        scale_source = f"Manual Input ({manual_width_m} m)"
    elif detected_door_sizes:
        vals    = np.array(detected_door_sizes, dtype=np.float32)
        med     = float(np.median(vals))
        good    = vals[(vals > 0.6 * med) & (vals < 1.4 * med)]
        avg_px  = float(np.median(good)) if len(good) else med
        # SLS standard door width = 0.84 m (midpoint of 0.76–0.91 m range)
        pixel_ratio  = 0.84 / avg_px
        scale_source = "YOLO Auto-Scale (door reference 0.84 m)"
    else:
        pixel_ratio  = 15.0 / img_w
        scale_source = "Default Assumption (15 m house width)"

    # ── Stage 3: OpenCV — Hough line wall detection ───────────────────────────
    raw_segments = _detect_walls_opencv(img, pixel_ratio)

    # Typical wall thickness 0.20 m → merge parallel face-pairs within that
    wall_thickness_px = max(10, int(0.20 / pixel_ratio))
    merged = _merge_wall_edges(raw_segments, wall_thickness_px)

    cv_length_m = round(sum(s[4] for s in merged) * pixel_ratio, 2)

    # ── Stage 4: Quality gate — fall back to YOLO skeleton if needed ──────────
    MIN_SEGMENTS = 5
    MIN_LENGTH_M = 3.0

    if len(merged) >= MIN_SEGMENTS and cv_length_m >= MIN_LENGTH_M:
        # OpenCV result is good — use it
        length_m   = cv_length_m
        wall_count = len(merged)
        method     = "Hybrid · YOLO Objects + OpenCV Hough Walls"
    else:
        # Fall back: YOLO wall model + skeleton measurement
        wall_boxes = []
        wall_count = 0
        if wall_model:
            for r in wall_model(image_path, conf=0.35):
                for box in r.boxes:
                    x1, y1, x2, y2 = box.xyxy[0]
                    wall_boxes.append((float(x1), float(y1), float(x2), float(y2)))
                    wall_count += 1

        # Refine scale using YOLO wall extent (if no manual/door scale)
        if wall_boxes and not (manual_width_m and float(manual_width_m) > 0.1):
            wall_min_x    = min(b[0] for b in wall_boxes)
            wall_max_x    = max(b[2] for b in wall_boxes)
            wall_extent_px = wall_max_x - wall_min_x
            if not detected_door_sizes and wall_extent_px > 0.3 * img_w:
                pixel_ratio  = 12.0 / wall_extent_px
                scale_source = "YOLO Auto-Scale (wall extent ~12 m)"

        total_pixels = _yolo_skeleton_length(img, wall_boxes)
        length_m     = round(total_pixels * pixel_ratio, 2)
        method       = "YOLO Skeleton (OpenCV insufficient)"

    return {
        "walls":        wall_count,
        "length_m":     length_m,
        "doors":        doors_count,
        "windows":      windows_count,
        "scale_source": f"{scale_source} · {method}",
    }


# Keep the old name as an alias so nothing else breaks
analyze_with_yolo = analyze_with_hybrid
