import math
import re
import ezdxf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

INSUNITS_MAP = {
    1: (0.0254,  "inches"),
    2: (0.3048,  "feet"),
    4: (0.001,   "millimeters"),
    5: (0.01,    "centimeters"),
    6: (1.0,     "meters"),
    0: (None,    "unitless"),
}


MIN_LENGTH_M = 0.05  # 50 mm = 5 cm


def _units_to_m_factor(insunits: int):
    return INSUNITS_MAP.get(insunits, (None, "unknown"))

def _dist(a, b) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _compute_bbox_raw(msp) -> tuple:
   
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    count = 0
    for e in msp:
        t = e.dxftype()
        try:
            if t == "LINE":
                for pt in (e.dxf.start, e.dxf.end):
                    min_x = min(min_x, pt.x); max_x = max(max_x, pt.x)
                    min_y = min(min_y, pt.y); max_y = max(max_y, pt.y)
                    count += 1
            elif t == "LWPOLYLINE":
                for (x, y) in e.get_points("xy"):
                    min_x = min(min_x, x); max_x = max(max_x, x)
                    min_y = min(min_y, y); max_y = max(max_y, y)
                    count += 1
            elif t == "ARC":
                cx, cy, r = e.dxf.center.x, e.dxf.center.y, e.dxf.radius
                min_x = min(min_x, cx - r); max_x = max(max_x, cx + r)
                min_y = min(min_y, cy - r); max_y = max(max_y, cy + r)
                count += 1
        except Exception:
            pass
        if count >= 5000:
            break
    if min_x == float("inf"):
        return (0.0, 0.0, 1.0, 1.0)
    return (min_x, min_y, max_x, max_y)


def _auto_correct_unit_factor(declared_factor: float, declared_label: str,
   msp) -> tuple:
   
    bbox = _compute_bbox_raw(msp)
    w_raw = bbox[2] - bbox[0]
    h_raw = bbox[3] - bbox[1]
    max_dim_raw = max(w_raw, h_raw)

    MIN_M, MAX_M = 2.0, 80.0

    def plausible(f):
        dim_m = max_dim_raw * f
        return MIN_M <= dim_m <= MAX_M

    if plausible(declared_factor):
        return declared_factor, declared_label, False

    for factor, label in [
        (0.0254,  "inches (auto-detected)"),
        (0.001,   "mm (auto-detected)"),
        (0.01,    "cm (auto-detected)"),
        (0.3048,  "feet (auto-detected)"),
        (1.0,     "m (auto-detected)"),
    ]:
        if abs(factor - declared_factor) < 1e-9:
            continue
        if plausible(factor):
            return factor, label, True

    return declared_factor, declared_label, False





_REJECT = {
    "DIM","DIMS","TEXT","MTEXT","NOTE","ANNO","ANNOT","HATCH","GRID",
    "CENTER","AXIS","TITLE","BORDER","ELECT","PLUMB","MECH","HVAC",
    "SANIT","PLOT","VIEWPORT","DEFPOINTS",
    "FURN","FURNITURE","LVTRY","LAVATORY","BATH","FIXTURE","FITTING",
    "EQUIP","EQUIPMENT","SANITARY","KITCHEN","APPLIANCE","SYMBOL",
    "MOBIL","MOBILIA","COCINA","BANO","BAÑO","TECHO","CEILING","ROOF",
    "INSUL","INSULATION","PARKING","LANDSCAPE","TREE","PLANT","VEGETATION",
    "DOOR","WINDOW","OPENING","PUERTAS","PUERTA","VENTANA","FENETRE",
    "PORTA","FINESTRA","STAIR","ESCAL","ESCALERA","RAMP",
}


_KEEP = {
    "WALL","WALLS","FOOTPRINT","STEM","BEAM","SLAB","FOUND","FOUNDATION",
    "FOOTER","FOOTING","CONCRETE","STRUCT","A-WALL",
    
    "MURO","PARED","PAREDE","MURI","CIMENT","VIGA","PILAR","TABIQUE",
   
    "MURATURA","STRUTTURA",
    
    "MUR","CLOISON","PAROI",
   
    "LT1","LT2","LT3","HZ","CC1","CC2","XX","W1","W2","WL",
}


_DOOR_LAYERS = {
    "DOOR","DOORS","PUERTA","PUERTAS","PORTA","PORTE","TUR","KAPI",
    "OPENING","GLAZ","GARAGE",
}


_OPENING_TOKENS = {"OPENING", "GLAZ"}


_WINDOW_LAYERS = {
    "WINDOW","WINDOWS","VENTANA","VENTANAS","FENETRE","FENETRES",
    "FINESTRA","JANELA","PENCERE","GLAZ","WIND",
}





_TOKEN_RE = re.compile(r"[-_.\s$]+")


def _tokenize_layer(layer_name: str) -> set:
    """Return the set of upper-cased tokens in a layer name."""
    s = (layer_name or "").upper().strip()
    return set(t for t in _TOKEN_RE.split(s) if t)


def _tokens_match(tokens: set, keyword_set: set) -> bool:

    return bool(tokens & keyword_set)


def _base_layer(layer_name: str) -> str:
    
    s = (layer_name or "").upper()
    return s.split("$")[-1] if "$" in s else s


def _is_structural_layer(layer_name: str) -> bool:
    
    tokens = _tokenize_layer(layer_name)
    has_keep   = _tokens_match(tokens, _KEEP)
    has_reject = _tokens_match(tokens, _REJECT)
    
    if has_keep:
        return True
    if has_reject:
        return False
   
    if "A-WALL" in (layer_name or "").upper():
        return True
    return False


def _is_door_layer(layer_name: str) -> bool:
    tokens = _tokenize_layer(layer_name)
    return _tokens_match(tokens, _DOOR_LAYERS)


def _is_window_layer(layer_name: str) -> bool:
    tokens = _tokenize_layer(layer_name)
    return _tokens_match(tokens, _WINDOW_LAYERS)




def _bulge_segment_length(p1, p2, bulge: float) -> float:
    
    chord = _dist(p1, p2)
    if chord == 0:
        return 0.0
    if abs(bulge) < 1e-9:
        return chord
    angle = 4.0 * math.atan(abs(bulge))
    half_sin = math.sin(angle / 2.0)
    if abs(half_sin) < 1e-12:
        return chord
    radius = chord / (2.0 * half_sin)
    return abs(radius * angle)


def _entity_length(e) -> float:
    
    t = e.dxftype()

    if t == "LINE":
        return _dist((e.dxf.start.x, e.dxf.start.y),
                     (e.dxf.end.x,   e.dxf.end.y))

    if t == "LWPOLYLINE":
        
        pts_with_bulge = list(e.get_points("xyb"))  
        n = len(pts_with_bulge)
        if n < 2:
            return 0.0
        length = 0.0
        for i in range(n - 1):
            x1, y1, b = pts_with_bulge[i]
            x2, y2, _ = pts_with_bulge[i + 1]
            length += _bulge_segment_length((x1, y1), (x2, y2), b)
        if e.closed and n > 2:
            x1, y1, b = pts_with_bulge[-1]
            x2, y2, _ = pts_with_bulge[0]
            length += _bulge_segment_length((x1, y1), (x2, y2), b)
        return length

    if t == "POLYLINE":
        pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
        length = sum(_dist(pts[i], pts[i+1]) for i in range(len(pts)-1))
        if e.is_closed and len(pts) > 2:
            length += _dist(pts[-1], pts[0])
        return length

    if t == "ARC":
        r  = e.dxf.radius
        a1 = math.radians(e.dxf.start_angle)
        a2 = math.radians(e.dxf.end_angle)
        sweep = a2 - a1
       
        while sweep <= 0:
            sweep += 2 * math.pi
        return abs(r * sweep)

    if t == "SPLINE":
        try:
        
            flat_pts = list(e.flattening(0.1))
            if len(flat_pts) < 2:
                return 0.0
            return sum(
                _dist((flat_pts[i].x, flat_pts[i].y),
                      (flat_pts[i+1].x, flat_pts[i+1].y))
                for i in range(len(flat_pts) - 1)
            )
        except Exception:
            return 0.0

    return 0.0




def _block_wall_length(doc, block_name: str, sx: float = 1.0,
                       sy: float = 1.0, _visited: set | None = None) -> float:
    
    if _visited is None:
        _visited = set()
    if block_name in _visited:
        return 0.0
    _visited.add(block_name)

    try:
        block = doc.blocks.get(block_name)
    except Exception:
        return 0.0
    if block is None:
        return 0.0

    total = 0.0
    uniform_scale = math.sqrt(abs(sx * sy))  

    for e in block:
        t = e.dxftype()
        if t == "INSERT":
            
            inner_sx = sx * (e.dxf.xscale if hasattr(e.dxf, "xscale") else 1.0)
            inner_sy = sy * (e.dxf.yscale if hasattr(e.dxf, "yscale") else 1.0)
            total += _block_wall_length(doc, e.dxf.name, inner_sx, inner_sy,
                                        _visited)
        else:
            length = _entity_length(e)
            if length > 0:
                total += length * uniform_scale

    return total




def _cluster_door_arcs(arcs: list, radius_tol_frac: float = 0.15,
                       center_tol_factor: float = 2.0) -> int:
    
    if not arcs:
        return 0
    used = [False] * len(arcs)
    clusters = 0

    for i in range(len(arcs)):
        if used[i]:
            continue
        used[i] = True
        clusters += 1
        cx_i, cy_i, r_i = arcs[i]
        for j in range(i + 1, len(arcs)):
            if used[j]:
                continue
            cx_j, cy_j, r_j = arcs[j]
            mean_r = (r_i + r_j) / 2.0
            if mean_r == 0:
                continue
            
            if abs(r_i - r_j) / mean_r > radius_tol_frac:
                continue
            
            dist_centers = math.sqrt((cx_i - cx_j) ** 2 + (cy_i - cy_j) ** 2)
            if dist_centers <= center_tol_factor * mean_r:
                used[j] = True  
    return clusters



_FOOTER_LAYER_TOKENS = {"FOOTER", "FOOTING", "FOOTPRINT", "S-FOOTER",
                        "FNDN", "SLAB-OUTLINE"}


def _is_footer_layer(layer_name: str) -> bool:
    return _tokens_match(_tokenize_layer(layer_name), _FOOTER_LAYER_TOKENS)


def _collect_structural_lines(msp, unit_to_m: float, doc=None) -> list:
   
    segs = []

    def _collect(entities, tx=0.0, ty=0.0,
                 cos_r=1.0, sin_r=0.0, sx=1.0, sy=1.0, depth=0):
        if depth > 6:
            return
        for e in entities:
            t = e.dxftype()
            if t == "LINE":
                layer = e.dxf.layer if hasattr(e.dxf, "layer") else ""
                if not _is_structural_layer(layer) or _is_footer_layer(layer):
                    continue
                try:
                    
                    lx1 = e.dxf.start.x * sx
                    ly1 = e.dxf.start.y * sy
                    lx2 = e.dxf.end.x   * sx
                    ly2 = e.dxf.end.y   * sy
                    x1 = cos_r * lx1 - sin_r * ly1 + tx
                    y1 = sin_r * lx1 + cos_r * ly1 + ty
                    x2 = cos_r * lx2 - sin_r * ly2 + tx
                    y2 = sin_r * lx2 + cos_r * ly2 + ty
                except Exception:
                    continue
                length = _dist((x1, y1), (x2, y2))
                if length * unit_to_m >= MIN_LENGTH_M:
                    segs.append((x1, y1, x2, y2, length))

            elif t == "INSERT" and doc is not None:
                block_name = getattr(e.dxf, "name", None)
                if not block_name:
                    continue
                try:
                    block = doc.blocks.get(block_name)
                    if block is None:
                        continue
                    ins  = e.dxf.insert
                    rot  = math.radians(getattr(e.dxf, "rotation", 0.0) or 0.0)
                    isx  = getattr(e.dxf, "xscale", 1.0) or 1.0
                    isy  = getattr(e.dxf, "yscale", 1.0) or 1.0
                    ic   = math.cos(rot)
                    is_  = math.sin(rot)
                   
                    new_cos = cos_r * ic  - sin_r * is_
                    new_sin = sin_r * ic  + cos_r * is_
                    new_sx  = sx * isx
                    new_sy  = sy * isy
                    new_tx  = cos_r * ins.x * sx - sin_r * ins.y * sy + tx
                    new_ty  = sin_r * ins.x * sx + cos_r * ins.y * sy + ty
                    _collect(block, new_tx, new_ty, new_cos, new_sin,
                             new_sx, new_sy, depth + 1)
                except Exception:
                    pass

    _collect(msp)
    return segs


def _detect_wall_thickness_raw(segments: list, fallback: float) -> float:

    if len(segments) < 4:
        return fallback

    from collections import Counter
    distances = []
    limit = min(len(segments), 300)
    for i in range(limit):
        x1i, y1i, x2i, y2i, _ = segments[i]
        ai  = math.atan2(y2i - y1i, x2i - x1i)
        nx  =  math.sin(ai)
        ny  = -math.cos(ai)
        mx_i = (x1i + x2i) / 2.0
        my_i = (y1i + y2i) / 2.0
        for j in range(i + 1, min(i + 25, limit)):
            x1j, y1j, x2j, y2j, _ = segments[j]
            aj = math.atan2(y2j - y1j, x2j - x1j)
            da = abs(ai - aj) % math.pi
            if min(da, math.pi - da) > math.radians(5):
                continue
            mx_j = (x1j + x2j) / 2.0
            my_j = (y1j + y2j) / 2.0
            perp = abs((mx_j - mx_i) * nx + (my_j - my_i) * ny)
           
            if 0.5 < perp < min(25.0, fallback):
                distances.append(perp)

    if not distances:
        return fallback

    
    bins = Counter(round(d) for d in distances)
    small_bins = {k: v for k, v in bins.items() if 0 < k < 25}
    if not small_bins:
        return fallback

    max_count = max(small_bins.values())
    
    significant = [k for k, v in small_bins.items() if v >= max(max_count * 0.20, 3)]
    
    detected = max(significant) if significant else max(small_bins, key=small_bins.get)
    return float(max(detected, 1))


def _merge_parallel_line_pairs(segments: list, wall_thickness_raw: float) -> list:

    if not segments or wall_thickness_raw <= 0:
        return segments

    used   = [False] * len(segments)
    merged = []

    for i in range(len(segments)):
        if used[i]:
            continue
        used[i] = True
        x1i, y1i, x2i, y2i, li = segments[i]
        best = segments[i]

        ai  = math.atan2(y2i - y1i, x2i - x1i)
        nx  =  math.sin(ai)
        ny  = -math.cos(ai)
        mx_i = (x1i + x2i) / 2.0
        my_i = (y1i + y2i) / 2.0

        for j in range(i + 1, len(segments)):
            if used[j]:
                continue
            x1j, y1j, x2j, y2j, lj = segments[j]
            aj = math.atan2(y2j - y1j, x2j - x1j)
            da = abs(ai - aj) % math.pi
            if min(da, math.pi - da) > math.radians(5):
                continue
            mx_j = (x1j + x2j) / 2.0
            my_j = (y1j + y2j) / 2.0
            perp = abs((mx_j - mx_i) * nx + (my_j - my_i) * ny)
            if perp <= wall_thickness_raw + 1:
                used[j] = True
                if lj > best[4]:
                    best = segments[j]

        merged.append(best)

    return merged



def _count_openings_from_layers(msp) -> dict:

    door_arcs_data = []
    door_inserts   = set()
    window_inserts = set()
    window_lines   = 0
    opening_lines  = 0
    opening_polys  = 0

    # Geometry based fallback accumulators (used when everything is on one layer)
    geom_door_arcs  = []
    geom_win_polys  = []

    for e in msp:
        layer  = e.dxf.layer if hasattr(e.dxf, "layer") else ""
        t      = e.dxftype()
        tokens = _tokenize_layer(layer)

        is_opening_type = _tokens_match(tokens, _OPENING_TOKENS)

        if _is_door_layer(layer):
            if t == "ARC":
                cx = e.dxf.center.x
                cy = e.dxf.center.y
                r  = e.dxf.radius
                door_arcs_data.append((cx, cy, r))
            elif t == "INSERT":
                pos = (round(e.dxf.insert.x, 0), round(e.dxf.insert.y, 0))
                door_inserts.add(pos)
            elif is_opening_type:
                if t == "LWPOLYLINE":
                    opening_polys += 1
                elif t == "LINE":
                    opening_lines += 1

        elif _is_window_layer(layer):
            if t == "INSERT":
                pos = (round(e.dxf.insert.x, 0), round(e.dxf.insert.y, 0))
                window_inserts.add(pos)
            elif t in ("LINE", "LWPOLYLINE"):
                window_lines += 1

        else:
            # Geometry based detection for files where everything is on one layer
            # Door swing arcs: sweep between 60 and 100 degrees, radius > 5 raw units
            if t == "ARC":
                try:
                    r  = e.dxf.radius
                    a1 = e.dxf.start_angle
                    a2 = e.dxf.end_angle
                    sweep = a2 - a1
                    while sweep <= 0:
                        sweep += 360
                    if r > 5 and 55 <= sweep <= 105:
                        cx = e.dxf.center.x
                        cy = e.dxf.center.y
                        geom_door_arcs.append((cx, cy, r))
                except Exception:
                    pass

            # Window rectangles: closed LWPOLYLINE with 4 to 6 points, aspect ratio
            # between 2:1 and 8:1 (windows are wide and shallow)
            elif t == "LWPOLYLINE":
                try:
                    pts = list(e.get_points("xy"))
                    n = len(pts)
                    if n < 4:
                        continue
                    xs = [p[0] for p in pts]
                    ys = [p[1] for p in pts]
                    w  = max(xs) - min(xs)
                    h  = max(ys) - min(ys)
                    if w <= 0 or h <= 0:
                        continue
                    aspect = max(w, h) / min(w, h)
                    size   = max(w, h)
                    # Typical window: elongated rectangle, not too tiny, not huge
                    if 1.5 <= aspect <= 10 and size > 3:
                        geom_win_polys.append((round(min(xs), 0), round(min(ys), 0)))
                except Exception:
                    pass

    # Layer based door count (preferred)
    door_count = _cluster_door_arcs(door_arcs_data)
    doors = door_count if door_count > 0 else len(door_inserts)

    # If layer based detection found nothing, use geometry based arcs
    if doors == 0 and geom_door_arcs:
        doors = _cluster_door_arcs(geom_door_arcs)

    # Layer based window count (preferred)
    if window_inserts:
        windows = len(window_inserts)
    elif window_lines > 0:
        windows = max(0, window_lines // 4)
    elif opening_polys > 0:
        windows = opening_polys
    elif opening_lines > 0:
        windows = max(0, opening_lines // 20)
    else:
        windows = 0

    # If layer based detection found nothing, use geometry based polylines
    if windows == 0 and geom_win_polys:
        # Deduplicate by proximity
        unique_wins = []
        for pos in geom_win_polys:
            is_dup = False
            for ex in unique_wins:
                if abs(pos[0] - ex[0]) < 5 and abs(pos[1] - ex[1]) < 5:
                    is_dup = True
                    break
            if not is_dup:
                unique_wins.append(pos)
        windows = len(unique_wins)

    return {"doors": doors, "windows": windows}



def _detect_rooms_from_segments(segments: list, unit_to_m: float, bbox: tuple) -> dict:

    import cv2 as _cv2
    import numpy as _np

    bx0, by0, bx1, by1 = bbox
    w_raw = bx1 - bx0
    h_raw = by1 - by0
    if w_raw <= 0 or h_raw <= 0:
        return {"room_count": 0, "total_floor_area_m2": 0, "areas": []}

   
    scale = 1000.0 / max(w_raw, h_raw)
    bw = int(w_raw * scale) + 20
    bh = int(h_raw * scale) + 20
    canvas = _np.zeros((bh, bw), dtype=_np.uint8)

    for (x1, y1, x2, y2, _) in segments:
        px1 = int((x1 - bx0) * scale) + 10
        py1 = int((by1 - y1) * scale) + 10  # flip Y
        px2 = int((x2 - bx0) * scale) + 10
        py2 = int((by1 - y2) * scale) + 10
        _cv2.line(canvas, (px1, py1), (px2, py2), 255, 2)

  
    kernel = _cv2.getStructuringElement(_cv2.MORPH_RECT, (11, 11))
    closed = _cv2.morphologyEx(canvas, _cv2.MORPH_CLOSE, kernel, iterations=3)

    inverted = _cv2.bitwise_not(closed)
    contours, _ = _cv2.findContours(inverted, _cv2.RETR_TREE, _cv2.CHAIN_APPROX_SIMPLE)

    px_to_m = 1.0 / scale * unit_to_m
    m2_per_px2 = px_to_m * px_to_m
    total_area_m2 = bw * bh * m2_per_px2

    rooms = []
    for cnt in contours:
        area_px = _cv2.contourArea(cnt)
        area_m2 = area_px * m2_per_px2
        if area_m2 < 2.0 or area_m2 > 500.0:
            continue
        if area_m2 > total_area_m2 * 0.8:
            continue
        hull = _cv2.convexHull(cnt)
        hull_area = _cv2.contourArea(hull)
        if hull_area > 0 and area_px / hull_area < 0.3:
            continue
        rooms.append(round(area_m2, 2))

    rooms.sort(reverse=True)
    return {
        "room_count": len(rooms),
        "total_floor_area_m2": round(sum(rooms), 2),
        "areas": rooms,
    }


# Public API 

def analyze_dxf(dxf_path: str) -> dict:
    doc      = ezdxf.readfile(dxf_path)
    msp      = doc.modelspace()
    insunits = int(doc.header.get("$INSUNITS", 0))
    unit_to_m, unit_label = _units_to_m_factor(insunits)

    assumed = False
    if unit_to_m is None:
        unit_to_m, unit_label, assumed = 0.001, "unitless assumed mm", True

    unit_to_m, unit_label, auto_corrected = _auto_correct_unit_factor(
        unit_to_m, unit_label, msp
    )

    
    bbox = _compute_bbox_raw(msp)
    building_width_raw  = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
    fallback_thickness  = building_width_raw * 0.02   # 2 % fallback if data too sparse

    line_segs = _collect_structural_lines(msp, unit_to_m, doc)

 
    wall_thickness_raw = _detect_wall_thickness_raw(line_segs, fallback_thickness)

   
    tier1_line_raw = 0.0
    if line_segs:
        merged_lines   = _merge_parallel_line_pairs(line_segs, wall_thickness_raw)
        tier1_line_raw = sum(s[4] for s in merged_lines)


    total_raw       = tier1_line_raw
    entity_count    = len(line_segs)
    layer0_raw      = 0.0
    layer0_entities = 0
    # Only trust LINE segments as the complete wall dataset if we have enough
    # of them. A handful of LINE entities (door details, a single long wall)
    # should not suppress the much larger LWPOLYLINE wall data.
    has_tier1_line  = len(merged_lines) >= 5 and (tier1_line_raw * unit_to_m) > 20.0

    for e in msp:
        layer  = e.dxf.layer if hasattr(e.dxf, "layer") else ""
        t      = e.dxftype()

        # Skip LINEs — already handled via face-merge above
        if t == "LINE":
            continue

        length = _entity_length(e)

       
        if t == "INSERT" and _is_structural_layer(layer):
            if has_tier1_line:
                continue  
            block_sx = e.dxf.xscale if hasattr(e.dxf, "xscale") else 1.0
            block_sy = e.dxf.yscale if hasattr(e.dxf, "yscale") else 1.0
            blk_len  = _block_wall_length(doc, e.dxf.name, block_sx, block_sy)
            if blk_len > 0 and blk_len * unit_to_m >= MIN_LENGTH_M:
                total_raw    += blk_len
                entity_count += 1
            continue

        if length == 0:
            continue

        # For closed LWPOLYLINE rectangles (wall sections drawn with thickness),
        # use only the longer dimension instead of the full perimeter.
        # Also skip the building outline (the single largest closed rectangle).
        if t == "LWPOLYLINE":
            try:
                pts = list(e.get_points("xy"))
                n   = len(pts)
                if n >= 4:
                    xs  = [p[0] for p in pts]
                    ys  = [p[1] for p in pts]
                    w   = max(xs) - min(xs)
                    h   = max(ys) - min(ys)
                    if w > 0 and h > 0:
                        aspect = max(w, h) / min(w, h)
                        # Skip the building outline: very large rectangle
                        # whose longer side is > 60% of the overall building width
                        if max(w, h) > building_width_raw * 0.60:
                            continue
                        # Wall section drawn as a thin closed rectangle:
                        # aspect > 3 means it is much longer than wide.
                        # Use only the longer side as the wall length.
                        if aspect > 3:
                            length = max(w, h)
            except Exception:
                pass

        length_m = length * unit_to_m
        if length_m < MIN_LENGTH_M:
            continue

        if layer == "0":
            layer0_raw      += length
            layer0_entities += 1
        elif _is_structural_layer(layer):
            if has_tier1_line:
                continue
            total_raw    += length
            entity_count += 1

  
    if layer0_raw * unit_to_m > 5.0:
        total_raw    += layer0_raw
        entity_count += layer0_entities

    
    fallback_used = False
    if entity_count == 0 and tier1_line_raw == 0.0:
        fallback_used = True
        for e in msp:
            layer  = (e.dxf.layer if hasattr(e.dxf, "layer") else "").upper()
            tokens = _tokenize_layer(layer)
            if _tokens_match(tokens, _REJECT):
                continue
            length = _entity_length(e)
            if length <= 0:
                continue
            # Apply same aspect ratio fix for LWPOLYLINE in fallback
            if e.dxftype() == "LWPOLYLINE":
                try:
                    pts = list(e.get_points("xy"))
                    if len(pts) >= 4:
                        xs = [p[0] for p in pts]
                        ys = [p[1] for p in pts]
                        w  = max(xs) - min(xs)
                        h  = max(ys) - min(ys)
                        if w > 0 and h > 0:
                            if max(w, h) > building_width_raw * 0.60:
                                continue
                            aspect = max(w, h) / min(w, h)
                            if aspect > 3:
                                length = max(w, h)
                except Exception:
                    pass
            length_m = length * unit_to_m
            if length_m < MIN_LENGTH_M:
                continue
            total_raw    += length
            entity_count += 1

    
    openings = _count_openings_from_layers(msp)

    scale_note = (
        f"DXF Accurate ($INSUNITS={insunits}, unit={unit_label})"
        + (" [ASSUMED]"        if assumed        else "")
        + (" [unit-corrected]" if auto_corrected  else "")
        + (" [fallback]"       if fallback_used   else "")
    )

    length_m = round(total_raw * unit_to_m, 2)

  
    conf_score = 70
    if not assumed and not auto_corrected:
        conf_score += 15  # correct units declared
    if not fallback_used:
        conf_score += 10  # found proper wall layers
    if openings["doors"] >= 1:
        conf_score += 3
    if openings["windows"] >= 1:
        conf_score += 2
    conf_score = min(100, conf_score)

    if conf_score >= 75:
        conf_label = "High"
    elif conf_score >= 55:
        conf_label = "Good"
    elif conf_score >= 35:
        conf_label = "Medium"
    else:
        conf_label = "Low"

    # Room detection (from wall segments)
    rooms = {"room_count": 0, "total_floor_area_m2": 0, "areas": []}
    if line_segs and unit_to_m > 0:
        rooms = _detect_rooms_from_segments(line_segs, unit_to_m, bbox)

    return {
        "walls":        entity_count,
        "length_m":     length_m,
        "doors":        openings["doors"],
        "windows":      openings["windows"],
        "scale_source": scale_note,
        "units": {
            "insunits":   insunits,
            "unit_to_m":  unit_to_m,
            "unit_label": unit_label,
        },
        "confidence": {
            "score": conf_score,
            "label": conf_label,
            "factors": {
                "units_declared": not assumed,
                "units_corrected": auto_corrected,
                "fallback_used": fallback_used,
                "entity_count": entity_count,
            },
        },
        "metrics": {
            "raw_segments":    len(line_segs),
            "merged_segments": len(merged_lines) if line_segs else 0,
            "scale_method":    "dxf",
            "unit_to_m":       unit_to_m,
            "analysis_method": "DXF Layer Analysis",
        },
        "rooms": rooms,
    }


def render_dxf_preview(dxf_path: str, out_png_path: str, max_entities: int = 20000):
    doc     = ezdxf.readfile(dxf_path)
    msp     = doc.modelspace()
    fig     = plt.figure(figsize=(10, 7), dpi=150)
    ax      = fig.add_subplot(111)
    ax.set_aspect("equal", adjustable="box")
    ax.axis("off")
    plotted = 0

    for e in msp:
        if plotted >= max_entities:
            break
        layer = e.dxf.layer if hasattr(e.dxf, "layer") else ""
        if any(x in (layer or "").upper() for x in ["DIM","TEXT","MTEXT","NOTE","HATCH"]):
            continue

        t = e.dxftype()
        if t == "LINE":
            ax.plot([e.dxf.start.x, e.dxf.end.x],
                    [e.dxf.start.y, e.dxf.end.y], linewidth=0.6, color="#334155")
            plotted += 1
        elif t == "LWPOLYLINE":
            pts = e.get_points("xy")
            ax.plot([p[0] for p in pts], [p[1] for p in pts],
                    linewidth=0.6, color="#334155")
            if e.closed and len(pts) > 2:
                ax.plot([pts[-1][0], pts[0][0]], [pts[-1][1], pts[0][1]],
                        linewidth=0.6, color="#334155")
            plotted += 1
        elif t == "POLYLINE":
            pts = [(v.dxf.location.x, v.dxf.location.y) for v in e.vertices]
            if len(pts) > 1:
                ax.plot([p[0] for p in pts], [p[1] for p in pts],
                        linewidth=0.6, color="#334155")
                if e.is_closed and len(pts) > 2:
                    ax.plot([pts[-1][0], pts[0][0]], [pts[-1][1], pts[0][1]],
                            linewidth=0.6, color="#334155")
                plotted += 1
        elif t == "ARC":
            cx, cy = e.dxf.center.x, e.dxf.center.y
            r      = e.dxf.radius
            a1     = math.radians(e.dxf.start_angle)
            a2     = math.radians(e.dxf.end_angle)
            if a2 < a1: a2 += 2 * math.pi
            angles = [a1 + (a2 - a1) * i / 30 for i in range(31)]
            xs = [cx + r * math.cos(a) for a in angles]
            ys = [cy + r * math.sin(a) for a in angles]
            ax.plot(xs, ys, linewidth=0.6, color="#334155")
            plotted += 1

    ax.relim()
    ax.autoscale_view()
    plt.tight_layout(pad=0)
    fig.savefig(out_png_path, bbox_inches="tight", pad_inches=0.02)
    plt.close(fig)
