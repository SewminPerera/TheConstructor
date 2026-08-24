import math
import cv2
import numpy as np


try:
    from ultralytics import YOLO
    wall_model    = YOLO("wall_model.pt")
    opening_model = YOLO("opening_model.pt")
    print(" AI Models Loaded Successfully")
except Exception as e:
    print(f"⚠️  AI Models not found — running without YOLO: {e}")
    wall_model    = None
    opening_model = None


# Validation helpers 

def _is_likely_photo(img: np.ndarray) -> dict:

    h, w = img.shape[:2]

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mean_sat = float(np.mean(hsv[:, :, 1]))

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
    hist = hist / hist.sum()  # normalise
  
    significant_bins = int(np.sum(hist > 0.005))

   
    edges = cv2.Canny(gray, 50, 150)
    edge_density = float(np.sum(edges > 0)) / (h * w)

    
    photo_score = 0
    reasons = []
    if mean_sat > 50:
        photo_score += 1
        reasons.append(f"high colour saturation ({mean_sat:.0f})")
    if significant_bins > 120:
        photo_score += 1
        reasons.append(f"smooth histogram ({significant_bins} bins)")
    if edge_density > 0.15:
        photo_score += 1
        reasons.append(f"high edge density ({edge_density:.2%})")

    if photo_score >= 2:
        return {"is_photo": True, "reason": "; ".join(reasons)}
    return {"is_photo": False, "reason": ""}


def _validate_image(img: np.ndarray) -> dict | None:

    if img is None:
        return {"error": "invalid_image", "message": "Could not read image file."}

    h, w = img.shape[:2]
    if h < 200 or w < 200:
        return {
            "error": "low_resolution",
            "message": f"Image is too small ({w}×{h}px). Please use at least 800×600px for accurate results.",
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    std_dev = float(np.std(gray))
    if std_dev < 10:
        return {
            "error": "low_contrast",
            "message": "Image appears blank or very low contrast. Please check the scan quality.",
        }

    return None




def _deskew_image(img: np.ndarray) -> np.ndarray:
   
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
        while angle > 45:
            angle -= 90
        while angle < -45:
            angle += 90
        angles.append(angle)

    if not angles:
        return img

    median_angle = float(np.median(angles))

    if abs(median_angle) < 1.5 or abs(median_angle) > 15.0:
        return img

    h, w = img.shape[:2]
    M     = cv2.getRotationMatrix2D((w / 2.0, h / 2.0), median_angle, 1.0)
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

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]

  
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mean_sat = float(np.mean(hsv[:, :, 1]))
    is_colored = mean_sat > 25  # colored floor fills

    if is_colored:
   
        _, dark_mask = cv2.threshold(gray, 80, 255, cv2.THRESH_BINARY_INV)

        
        kernel_open = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_OPEN, kernel_open, iterations=1)

      
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 1))
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 9))
        closed_h = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, h_kernel, iterations=2)
        closed_v = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, v_kernel, iterations=2)
        binary = cv2.bitwise_or(closed_h, closed_v)
        wall_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, wall_kernel, iterations=1)

        min_len_px = max(40, int(0.5 / pixel_ratio))   
        max_gap_px = max(5, int(0.02 / pixel_ratio))
        hough_threshold = 60
    else:
        # Clean line drawing  
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        mean_brightness = float(np.mean(gray))
        thresh_type = cv2.THRESH_BINARY_INV if mean_brightness > 128 else cv2.THRESH_BINARY

        binary = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            thresh_type,
            blockSize=15, C=4,
        )

        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 1))
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 7))
        closed_h = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, h_kernel, iterations=2)
        closed_v = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, v_kernel, iterations=2)
        binary = cv2.bitwise_or(closed_h, closed_v)

        min_len_px = max(20, int(0.05 / pixel_ratio))
        max_gap_px = max(5,  int(0.01 / pixel_ratio))
        hough_threshold = 40

    lines = cv2.HoughLinesP(
        binary, rho=1, theta=np.pi / 180, threshold=hough_threshold,
        minLineLength=min_len_px, maxLineGap=max_gap_px,
    )

    if lines is None:
        return []

    segments = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        angle = abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))
        is_h = angle < 15 or angle > 165    
        is_v = 75 < angle < 105
        if not (is_h or is_v):
            continue
        length = math.hypot(x2 - x1, y2 - y1)
        # Skip very short segments 
        if length < min_len_px * 0.8:
            continue
        segments.append((x1, y1, x2, y2, length))

    return segments


def _merge_wall_edges(segments: list, wall_thickness_px: float) -> list:

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
        nx =  math.sin(angle_i)
        ny = -math.cos(angle_i)
        mx_i = (x1i + x2i) / 2.0
        my_i = (y1i + y2i) / 2.0

        for j in range(i + 1, len(segments)):
            if used[j]:
                continue
            x1j, y1j, x2j, y2j, lj = segments[j]

            angle_j = math.atan2(y2j - y1j, x2j - x1j)
            da = abs(angle_i - angle_j) % math.pi
            if min(da, math.pi - da) > math.radians(5):
                continue

            mx_j = (x1j + x2j) / 2.0
            my_j = (y1j + y2j) / 2.0
            perp_dist = abs((mx_j - mx_i) * nx + (my_j - my_i) * ny)

            if perp_dist < wall_thickness_px:
                used[j] = True
                if lj > best[4]:
                    best = segments[j]

        merged.append(best)

    return merged


# YOLO skeleton fallback 

def _prune_skeleton_branches(skel: np.ndarray, max_branch_len: int = 10) -> np.ndarray:
  
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


#Room detection 

def _detect_rooms(img: np.ndarray, pixel_ratio: float) -> dict:

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape[:2]

    # Detect colored blueprint 
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mean_sat = float(np.mean(hsv[:, :, 1]))
    is_colored = mean_sat > 25

    if is_colored:
       
        _, binary = cv2.threshold(gray, 80, 255, cv2.THRESH_BINARY_INV)
        
        wall_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        binary = cv2.dilate(binary, wall_kernel, iterations=2)
        
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))
        closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=3)
    else:
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        mean_brightness = float(np.mean(gray))
        thresh_type = cv2.THRESH_BINARY_INV if mean_brightness > 128 else cv2.THRESH_BINARY
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            thresh_type, blockSize=15, C=4,
        )
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
        closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=3)

   
    inverted = cv2.bitwise_not(closed)

    contours, _ = cv2.findContours(inverted, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    m2_per_px2 = pixel_ratio * pixel_ratio
    img_area_m2 = h * w * m2_per_px2

    rooms = []
    for cnt in contours:
        area_px = cv2.contourArea(cnt)
        area_m2 = area_px * m2_per_px2

        if area_m2 < 4.0 or area_m2 > 500.0:
            continue
        if area_m2 > img_area_m2 * 0.6:
            continue

       
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        if hull_area > 0 and area_px / hull_area < 0.5:
            continue  

     
        x, y, rw, rh = cv2.boundingRect(cnt)
        aspect = max(rw, rh) / (min(rw, rh) + 1)
        if aspect > 6:
            continue  

        rooms.append(round(area_m2, 2))

    rooms.sort(reverse=True)


    filtered = []
    for area in rooms:
        is_dup = False
        for existing in filtered:
            if abs(area - existing) / (existing + 0.01) < 0.15:  
                is_dup = True
                break
        if not is_dup:
            filtered.append(area)
    rooms = filtered

   
    if len(rooms) > 15:
        rooms = rooms[:15]

    return {
        "room_count": len(rooms),
        "total_floor_area_m2": round(sum(rooms), 2),
        "areas": rooms,
    }


# Confidence scoring 

def _compute_confidence(
    scale_method: str,
    wall_count: int,
    raw_segment_count: int,
    merged_segment_count: int,
    length_m: float,
    doors_count: int,
    windows_count: int,
) -> dict:

  
    if "calibration" in scale_method.lower() or "dxf" in scale_method.lower():
        scale_score = 40
    elif "manual" in scale_method.lower():
        scale_score = 38
    elif "door reference" in scale_method.lower():
        scale_score = 22
    elif "wall extent" in scale_method.lower():
        scale_score = 12
    else:  
        scale_score = 5

   
    seg_score = 0
    if merged_segment_count >= 8:
        seg_score = 30
    elif merged_segment_count >= 5:
        seg_score = 22
    elif merged_segment_count >= 3:
        seg_score = 15
    elif merged_segment_count >= 1:
        seg_score = 8

    
    if raw_segment_count > 0 and merged_segment_count > 0:
        merge_ratio = merged_segment_count / raw_segment_count
        if 0.3 <= merge_ratio <= 0.6:  
            seg_score = min(30, seg_score + 5)

   
    det_score = 0
    
    if 5.0 <= length_m <= 200.0:
        det_score += 12
    elif 2.0 <= length_m <= 300.0:
        det_score += 6

   
    if wall_count >= 4:
        det_score += 8
    elif wall_count >= 2:
        det_score += 4

    
    if doors_count >= 1:
        det_score += 5
    if windows_count >= 1:
        det_score += 5

    total = scale_score + seg_score + det_score
    total = max(0, min(100, total))

    if total >= 75:
        label = "High"
    elif total >= 55:
        label = "Good"
    elif total >= 35:
        label = "Medium"
    else:
        label = "Low"

    return {
        "score": total,
        "label": label,
        "factors": {
            "scale_source": scale_score,
            "segment_quality": seg_score,
            "detection_consistency": det_score,
        },
    }


# Public API 

def analyze_with_hybrid(
    image_path: str,
    manual_width_m: float = 0.0,
    pixel_ratio: float = None,
) -> dict:
  
    img = cv2.imread(image_path)

   
    validation_error = _validate_image(img)
    if validation_error:
        return {
            "walls": 0, "length_m": 0, "doors": 0, "windows": 0,
            "scale_source": "Error",
            "confidence": {"score": 0, "label": "Low", "factors": {}},
            "metrics": {},
            "rooms": {"room_count": 0, "total_floor_area_m2": 0, "areas": []},
            **validation_error,
        }

   
    photo_check = _is_likely_photo(img)

    img = _deskew_image(img)
    img_h, img_w = img.shape[:2]

   
    detected_door_sizes = []
    doors_count   = 0
    windows_count = 0

    if opening_model:
        try:

            results = opening_model(image_path, conf=0.08)
            for r in results:
                if r.boxes is None or len(r.boxes) == 0:
                    continue
                for box in r.boxes:
                    try:
                        cls_id = int(box.cls[0]) if len(box.cls) > 0 else 0
                        name   = opening_model.names.get(cls_id, "unknown").lower()
                        conf   = float(box.conf[0]) if len(box.conf) > 0 else 0.0
                        coords = box.xyxy[0] if len(box.xyxy) > 0 else None
                        if coords is None or len(coords) < 4:
                            continue
                        x1, y1, x2, y2 = float(coords[0]), float(coords[1]), float(coords[2]), float(coords[3])
                        side = min(x2 - x1, y2 - y1)
                        if "door" in name and conf >= 0.25:
                            detected_door_sizes.append(side)
                            doors_count += 1
                        elif "window" in name and conf >= 0.08:
                            windows_count += 1
                    except (IndexError, TypeError, ValueError):
                        continue
        except Exception as e:
            print(f"⚠️  Opening model inference failed: {e}")

    if windows_count == 0:
        try:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            mean_br = float(np.mean(gray))
            _, binary = cv2.threshold(
                gray,
                200 if mean_br > 128 else 50,
                255,
                cv2.THRESH_BINARY_INV if mean_br > 128 else cv2.THRESH_BINARY,
            )

            min_seg_px = max(10, img_w // 120)
            lines = cv2.HoughLinesP(
                binary, 1, np.pi / 180,
                threshold=12,
                minLineLength=min_seg_px,
                maxLineGap=4,
            )

            win_candidates = 0

            if lines is not None and len(lines) > 0:
                h_segs = []
                v_segs = []
                for ln in lines:
                    x1, y1, x2, y2 = ln[0]
                    angle = abs(math.degrees(math.atan2(y2 - y1, x2 - x1)))
                    length = math.hypot(x2 - x1, y2 - y1)
                    if length < min_seg_px:
                        continue
                    if angle < 20 or angle > 160:
                        h_segs.append((
                            (y1 + y2) / 2.0,
                            float(min(x1, x2)),
                            float(max(x1, x2)),
                            length,
                        ))
                    elif 70 < angle < 110:
                        v_segs.append((
                            (x1 + x2) / 2.0,
                            float(min(y1, y2)),
                            float(max(y1, y2)),
                            length,
                        ))

                cluster_gap_h = max(25, img_h // 35)
                cluster_gap_v = max(25, img_w // 35)
                min_win_px = img_w * 0.025
                max_win_px = img_w * 0.28

                h_segs.sort(key=lambda s: s[0])
                used_h = [False] * len(h_segs)
                for i in range(len(h_segs)):
                    if used_h[i]:
                        continue
                    yi, x1i, x2i, li = h_segs[i]
                    cluster = [i]
                    for j in range(i + 1, len(h_segs)):
                        if used_h[j]:
                            continue
                        yj, x1j, x2j, lj = h_segs[j]
                        if yj - yi > cluster_gap_h:
                            break
                        overlap = min(x2i, x2j) - max(x1i, x1j)
                        if overlap > 0.45 * min(li, lj) and abs(li - lj) < 0.6 * max(li, lj):
                            cluster.append(j)
                    if len(cluster) >= 2:
                        clen = max(h_segs[k][2] - h_segs[k][1] for k in cluster)
                        if min_win_px < clen < max_win_px:
                            for k in cluster:
                                used_h[k] = True
                            win_candidates += 1

                v_segs.sort(key=lambda s: s[0])
                used_v = [False] * len(v_segs)
                for i in range(len(v_segs)):
                    if used_v[i]:
                        continue
                    xi, y1i, y2i, li = v_segs[i]
                    cluster = [i]
                    for j in range(i + 1, len(v_segs)):
                        if used_v[j]:
                            continue
                        xj, y1j, y2j, lj = v_segs[j]
                        if xj - xi > cluster_gap_v:
                            break
                        overlap = min(y2i, y2j) - max(y1i, y1j)
                        if overlap > 0.45 * min(li, lj) and abs(li - lj) < 0.6 * max(li, lj):
                            cluster.append(j)
                    if len(cluster) >= 2:
                        clen = max(v_segs[k][2] - v_segs[k][1] for k in cluster)
                        if min_win_px < clen < max_win_px:
                            for k in cluster:
                                used_v[k] = True
                            win_candidates += 1

            if 1 <= win_candidates <= 40:
                windows_count = win_candidates
        except Exception as e:
            print(f"⚠️  OpenCV window fallback failed: {e}")

  
    if pixel_ratio and float(pixel_ratio) > 0:
        pr_initial = float(pixel_ratio)
    elif manual_width_m and float(manual_width_m) > 0.1:
        pr_initial = float(manual_width_m) / img_w
    elif detected_door_sizes:
        vals    = np.array(detected_door_sizes, dtype=np.float32)
        med     = float(np.median(vals))
        good    = vals[(vals > 0.6 * med) & (vals < 1.4 * med)]
        avg_px  = float(np.median(good)) if len(good) else med
        pr_initial = 0.84 / avg_px
    else:
        pr_initial = 15.0 / img_w

    
    raw_segments = _detect_walls_opencv(img, pr_initial)

   
    if pixel_ratio and float(pixel_ratio) > 0:
        pr           = float(pixel_ratio)
        scale_source = "Two-Point Calibration"
        scale_method = "calibration"
    elif manual_width_m and float(manual_width_m) > 0.1:
        pr           = float(manual_width_m) / img_w
        scale_source = f"Manual Input ({manual_width_m} m)"
        scale_method = "manual"
    elif detected_door_sizes:
        vals    = np.array(detected_door_sizes, dtype=np.float32)
        med     = float(np.median(vals))
        good    = vals[(vals > 0.6 * med) & (vals < 1.4 * med)]
        avg_px  = float(np.median(good)) if len(good) else med
        pr           = 0.84 / avg_px
        scale_source = "Auto-Scale (door reference 0.84 m)"
        scale_method = "yolo_door"
    else:
        pr           = 15.0 / img_w
        scale_source = "Default Assumption (15 m house width)"
        scale_method = "default"

    wall_thickness_px = max(10, int(0.20 / pr))
    merged = _merge_wall_edges(raw_segments, wall_thickness_px)

    cv_length_m = round(sum(s[4] for s in merged) * pr, 2)

    
    MIN_SEGMENTS = 5
    MIN_LENGTH_M = 3.0

    if len(merged) >= MIN_SEGMENTS and cv_length_m >= MIN_LENGTH_M:
        length_m   = cv_length_m
        wall_count = len(merged)
        method     = "AI Vision + Wall Detection"
    else:
        wall_boxes = []
        wall_count = 0
        if wall_model:
            try:
                results = wall_model(image_path, conf=0.35)
                for r in results:
                    if r.boxes is None or len(r.boxes) == 0:
                        continue
                    for box in r.boxes:
                        try:
                            coords = box.xyxy[0] if len(box.xyxy) > 0 else None
                            if coords is None or len(coords) < 4:
                                continue
                            x1, y1, x2, y2 = float(coords[0]), float(coords[1]), float(coords[2]), float(coords[3])
                            wall_boxes.append((x1, y1, x2, y2))
                            wall_count += 1
                        except (IndexError, TypeError, ValueError):
                            continue
            except Exception as e:
                print(f"⚠️  Wall model inference failed: {e}")

        if wall_boxes and not (pixel_ratio and float(pixel_ratio) > 0) and not (manual_width_m and float(manual_width_m) > 0.1):
            wall_min_x     = min(b[0] for b in wall_boxes)
            wall_max_x     = max(b[2] for b in wall_boxes)
            wall_extent_px = wall_max_x - wall_min_x
            if not detected_door_sizes and wall_extent_px > 0.3 * img_w:
                pr           = 12.0 / wall_extent_px
                scale_source = "Auto-Scale (wall extent ~12 m)"
                scale_method = "yolo_wall_extent"

        total_pixels = _yolo_skeleton_length(img, wall_boxes)
        length_m     = round(total_pixels * pr, 2)
        method       = "AI Vision (Fallback)"

   
    rooms = _detect_rooms(img, pr)

    
    confidence = _compute_confidence(
        scale_method=scale_method,
        wall_count=wall_count,
        raw_segment_count=len(raw_segments),
        merged_segment_count=len(merged),
        length_m=length_m,
        doors_count=doors_count,
        windows_count=windows_count,
    )

    result = {
        "walls":        wall_count,
        "length_m":     length_m,
        "doors":        doors_count,
        "windows":      windows_count,
        "scale_source": scale_source,
        "confidence":   confidence,
        "metrics": {
            "raw_segments":     len(raw_segments),
            "merged_segments":  len(merged),
            "scale_method":     scale_method,
            "pixel_ratio":      round(pr, 6),
            "analysis_method":  method,
            "image_size":       f"{img_w}×{img_h}",
        },
        "rooms": rooms,
    }

     
    warnings = []

    if photo_check["is_photo"]:
        warnings.append(f"This image may be a photograph rather than a blueprint ({photo_check['reason']}). Results may be less accurate.")

    
    hsv_check = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    mean_sat = float(np.mean(hsv_check[:, :, 1]))
    if mean_sat > 25 and not photo_check["is_photo"]:
        warnings.append("This appears to be a colored render, not a standard black & white construction blueprint. For best accuracy, use a proper B&W architectural drawing.")

    if warnings:
        result["warning"] = " | ".join(warnings)

    return result



analyze_with_yolo = analyze_with_hybrid
