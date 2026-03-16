"""
services/dxf_services.py
------------------------
DXF file parsing and preview rendering.
Doors and windows are counted directly from CAD layers.
"""
import math
import re
import ezdxf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt


# ── Unit conversion ───────────────────────────────────────────────────────────

INSUNITS_MAP = {
    1: (0.0254,  "inches"),
    2: (0.3048,  "feet"),
    4: (0.001,   "millimeters"),
    5: (0.01,    "centimeters"),
    6: (1.0,     "meters"),
    0: (None,    "unitless"),
}

# Minimum entity length in metres — applied AFTER unit conversion so the
# threshold is independent of the DXF file's native units.
MIN_LENGTH_M = 0.05  # 50 mm = 5 cm


def _units_to_m_factor(insunits: int):
    return INSUNITS_MAP.get(insunits, (None, "unknown"))

def _dist(a, b) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def _compute_bbox_raw(msp) -> tuple:
    """Return (min_x, min_y, max_x, max_y) bounding box in raw DXF units.

    Samples the first 5 000 coordinate points for speed.
    """
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
    """Verify declared unit gives a plausible building (3–500 m wide/tall).

    If the declared factor produces an implausibly tiny or huge building,
    try the common alternatives in order: inches → feet → cm → mm.

    Returns (factor, label, was_corrected).
    """
    bbox = _compute_bbox_raw(msp)
    w_raw = bbox[2] - bbox[0]
    h_raw = bbox[3] - bbox[1]
    max_dim_raw = max(w_raw, h_raw)

    MIN_M, MAX_M = 2.0, 500.0

    def plausible(f):
        dim_m = max_dim_raw * f
        return MIN_M <= dim_m <= MAX_M

    if plausible(declared_factor):
        return declared_factor, declared_label, False

    for factor, label in [
        (0.0254,  "inches (auto-detected)"),
        (0.3048,  "feet (auto-detected)"),
        (0.001,   "mm (auto-detected)"),
        (0.01,    "cm (auto-detected)"),
        (1.0,     "m (auto-detected)"),
    ]:
        if abs(factor - declared_factor) < 1e-9:
            continue
        if plausible(factor):
            return factor, label, True

    # Nothing gave a sensible size — keep declared
    return declared_factor, declared_label, False


# ── Layer keyword sets ────────────────────────────────────────────────────────

# Layers to always REJECT from wall calculation
_REJECT = {
    "DIM","DIMS","TEXT","MTEXT","NOTE","ANNO","ANNOT","HATCH","GRID",
    "CENTER","AXIS","TITLE","BORDER","ELECT","PLUMB","MECH","HVAC",
    "SANIT","PLOT","VIEWPORT","DEFPOINTS",
    # Fixture / fitting / furniture layers
    "FURN","FURNITURE","LVTRY","LAVATORY","BATH","FIXTURE","FITTING",
    "EQUIP","EQUIPMENT","SANITARY","KITCHEN","APPLIANCE","SYMBOL",
    "MOBIL","MOBILIA","COCINA","BANO","BAÑO","TECHO","CEILING","ROOF",
    "INSUL","INSULATION","PARKING","LANDSCAPE","TREE","PLANT","VEGETATION",
    # Opening layers — counted separately
    "DOOR","WINDOW","OPENING","PUERTAS","PUERTA","VENTANA","FENETRE",
    "PORTA","FINESTRA","STAIR","ESCAL","ESCALERA","RAMP",
}

# Layers to KEEP as walls
_KEEP = {
    "WALL","FOOTPRINT","STEM","BEAM","SLAB","FOUND","FOUNDATION",
    "FOOTER","FOOTING","CONCRETE","STRUCT","A-WALL",
    # Spanish / Portuguese
    "MURO","PARED","PAREDE","MURI","CIMENT","VIGA","PILAR","TABIQUE",
    # Italian
    "MURATURA","STRUTTURA",
    # French
    "MUR","CLOISON","PAROI",
    # Generic short layer names commonly used for walls in downloaded DXF files
    # LT = linetype wall, HZ = horizontal, CC = concrete core
    "LT1","LT2","LT3","HZ","CC1","CC2","XX","W1","W2","WL",
}

# Door layer keywords  (exact token matching — no substrings)
# Note: "CASE" / "A-CASE" removed — these match cabinet casework (A-CASE-1 etc.)
# and produce false-positive door arcs.
# Multi-word names like "A-DOOR" tokenise to {"A","DOOR"}, so only the root
# keyword ("DOOR") is needed for matching.
_DOOR_LAYERS = {
    "DOOR","DOORS","PUERTA","PUERTAS","PORTA","PORTE","TUR","KAPI",
    "OPENING","GLAZ","GARAGE",
}

# Tokens present on "opening / glazing" layers where non-ARC entities
# (LWPOLYLINEs, LINE groups) represent window frames, not door geometry.
# Note: "A-OPENING" tokenises to {"A", "OPENING"} so only "OPENING" is needed.
_OPENING_TOKENS = {"OPENING", "GLAZ"}

# Window layer keywords  (exact token matching — compound names like "A-GLAZ"
# split to {"A","GLAZ"}, so the root token "GLAZ" is enough)
_WINDOW_LAYERS = {
    "WINDOW","WINDOWS","VENTANA","VENTANAS","FENETRE","FENETRES",
    "FINESTRA","JANELA","PENCERE","GLAZ","WIND",
}


# ── Token-based layer matching ───────────────────────────────────────────────

# Split on common DXF layer-name delimiters: hyphen, underscore, dot,
# whitespace, and the xref ``$`` separator.
_TOKEN_RE = re.compile(r"[-_.\s$]+")


def _tokenize_layer(layer_name: str) -> set:
    """Return the set of upper-cased tokens in a layer name."""
    s = (layer_name or "").upper().strip()
    return set(t for t in _TOKEN_RE.split(s) if t)


def _tokens_match(tokens: set, keyword_set: set) -> bool:
    """True if any token is exactly equal to a keyword in *keyword_set*.

    Uses exact token matching instead of substring matching so that e.g.
    the keyword ``CASE`` does not accidentally match layer ``STAIRCASE``
    (``STAIRCASE`` is a single token; it would need to be ``STAIR-CASE``
    for the ``CASE`` token to appear).
    """
    return bool(tokens & keyword_set)


def _base_layer(layer_name: str) -> str:
    """Strip xref prefix: xref-name$0$A-WALL -> A-WALL"""
    s = (layer_name or "").upper()
    return s.split("$")[-1] if "$" in s else s


def _is_structural_layer(layer_name: str) -> bool:
    """Decide whether *layer_name* is a structural (wall) layer.

    Token-based matching is used so that compound names like
    ``WALL-OPENING`` correctly match *both* KEEP and REJECT — in that
    case KEEP wins, because the layer explicitly carries wall geometry
    even though it also mentions an opening.
    """
    tokens = _tokenize_layer(layer_name)
    has_keep   = _tokens_match(tokens, _KEEP)
    has_reject = _tokens_match(tokens, _REJECT)
    # KEEP wins over REJECT for compound names (e.g. "WALL-OPENING")
    if has_keep:
        return True
    if has_reject:
        return False
    # Legacy special-case preserved for backward compat
    if "A-WALL" in (layer_name or "").upper():
        return True
    return False


def _is_door_layer(layer_name: str) -> bool:
    tokens = _tokenize_layer(layer_name)
    return _tokens_match(tokens, _DOOR_LAYERS)


def _is_window_layer(layer_name: str) -> bool:
    tokens = _tokenize_layer(layer_name)
    return _tokens_match(tokens, _WINDOW_LAYERS)


# ── Entity length ─────────────────────────────────────────────────────────────

def _bulge_segment_length(p1, p2, bulge: float) -> float:
    """Return the arc length of an LWPOLYLINE segment with a bulge value.

    A bulge of 0 is a straight chord.  Otherwise the arc angle is
    ``4 * atan(|bulge|)`` and the radius is derived from the chord.
    """
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
    """Return the linear length of a single DXF entity in raw DXF units."""
    t = e.dxftype()

    if t == "LINE":
        return _dist((e.dxf.start.x, e.dxf.start.y),
                     (e.dxf.end.x,   e.dxf.end.y))

    if t == "LWPOLYLINE":
        # Use bulge-aware segment lengths instead of straight-chord approx.
        pts_with_bulge = list(e.get_points("xyb"))  # (x, y, bulge)
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
        # Wrap so sweep is always positive (CCW)
        while sweep <= 0:
            sweep += 2 * math.pi
        return abs(r * sweep)

    if t == "SPLINE":
        try:
            # ezdxf flattening returns a list of Vec3 points that
            # approximate the spline as a polyline.
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


# ── Block traversal ──────────────────────────────────────────────────────────

def _block_wall_length(doc, block_name: str, sx: float = 1.0,
                       sy: float = 1.0, _visited: set | None = None) -> float:
    """Recursively sum wall-geometry lengths inside a block definition.

    *sx* / *sy* are cumulative X / Y scale factors from outer INSERT
    entities.  ``_visited`` guards against infinite recursion with
    circular block references.
    """
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
    uniform_scale = math.sqrt(abs(sx * sy))  # average scale for lengths

    for e in block:
        t = e.dxftype()
        if t == "INSERT":
            # Nested block — recurse with compounded scale
            inner_sx = sx * (e.dxf.xscale if hasattr(e.dxf, "xscale") else 1.0)
            inner_sy = sy * (e.dxf.yscale if hasattr(e.dxf, "yscale") else 1.0)
            total += _block_wall_length(doc, e.dxf.name, inner_sx, inner_sy,
                                        _visited)
        else:
            length = _entity_length(e)
            if length > 0:
                total += length * uniform_scale

    return total


# ── Door clustering ──────────────────────────────────────────────────────────

def _cluster_door_arcs(arcs: list, radius_tol_frac: float = 0.15,
                       center_tol_factor: float = 2.0) -> int:
    """Group nearby door ARCs that belong to the same door.

    Double-leaf doors (and sometimes single doors with trim arcs) produce
    two ARC entities at roughly the same centre and radius.  We cluster
    arcs whose centres are within ``center_tol_factor * radius`` of each
    other **and** whose radii are within *radius_tol_frac* of each other,
    counting each cluster as one door.

    Parameters
    ----------
    arcs : list of (cx, cy, radius) tuples
    radius_tol_frac : float
        Maximum relative difference in radius for two arcs to be
        considered part of the same door (default 15 %).
    center_tol_factor : float
        Centre-distance threshold expressed as a multiple of the mean
        radius of the two arcs (default 2.0).

    Returns
    -------
    int  – estimated number of doors.
    """
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
            # Check radius similarity
            if abs(r_i - r_j) / mean_r > radius_tol_frac:
                continue
            # Check centre proximity
            dist_centers = math.sqrt((cx_i - cx_j) ** 2 + (cy_i - cy_j) ** 2)
            if dist_centers <= center_tol_factor * mean_r:
                used[j] = True  # belongs to same door
    return clusters


# ── Wall segment collection & face-pair deduplication ────────────────────────

# Tier-2 layers: these trace the same geometry as wall layers but at
# foundation / slab level.  They are skipped when Tier-1 wall data exists.
_FOOTER_LAYER_TOKENS = {"FOOTER", "FOOTING", "FOOTPRINT", "S-FOOTER",
                        "FNDN", "SLAB-OUTLINE"}


def _is_footer_layer(layer_name: str) -> bool:
    return _tokens_match(_tokenize_layer(layer_name), _FOOTER_LAYER_TOKENS)


def _collect_structural_lines(msp, unit_to_m: float, doc=None) -> list:
    """Return (x1,y1,x2,y2,length_raw) for LINE entities on structural layers.

    Traverses INSERT block definitions so that walls stored inside reused
    blocks are captured with correct world-space coordinates.
    Transform composition handles translation, rotation, and non-uniform scale.

    Only segments that pass the MIN_LENGTH_M filter are returned.
    """
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
                    # Apply scale in block-local space, then rotate + translate
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
                    # Compose parent + INSERT transforms
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
    """Measure the actual wall face-pair distance from LINE segment data.

    Samples perpendicular distances between parallel segment pairs and finds
    the largest distance that occurs with significant frequency (≥10 % of the
    most-common small distance).  This handles walls that have two distinct
    thicknesses (e.g. interior 4-unit and exterior 6-unit face pairs).

    Returns *fallback* when there are too few segments to measure.
    """
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
            # Only collect small distances — true face pairs are thin walls
            if 0.5 < perp < min(25.0, fallback):
                distances.append(perp)

    if not distances:
        return fallback

    # Bin to nearest integer and find all "significant" small distances
    bins = Counter(round(d) for d in distances)
    small_bins = {k: v for k, v in bins.items() if 0 < k < 25}
    if not small_bins:
        return fallback

    max_count = max(small_bins.values())
    # Keep bins whose count is ≥ 20 % of the most-common bin.
    # True face-pair distances are very frequent (every wall contributes two
    # parallel lines); incidental parallelism is sparse by comparison.
    significant = [k for k, v in small_bins.items() if v >= max(max_count * 0.20, 3)]
    # Use the LARGEST significant distance as the wall thickness
    # (covers both thin interior walls and thicker exterior walls)
    detected = max(significant) if significant else max(small_bins, key=small_bins.get)
    return float(max(detected, 1))


def _merge_parallel_line_pairs(segments: list, wall_thickness_raw: float) -> list:
    """Merge parallel LINE pairs (two wall faces) into one representative segment.

    Two segments are considered the same wall when:
    - Their angles differ by < 5°
    - Their perpendicular midpoint distance is ≤ wall_thickness_raw + 1

    Using detected_thickness + 1 (rather than × 1.5) gives a tight threshold
    that correctly merges face pairs without accidentally collapsing adjacent
    parallel walls into one.

    The longer segment of each pair is kept.
    """
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


# ── Opening counting ─────────────────────────────────────────────────────────

def _count_openings_from_layers(msp) -> dict:
    """
    Count doors and windows directly from DXF layer names.

    Doors:   ARC entities in door layers (clustered to handle double-leaf doors).
    Windows: INSERT or LWPOLYLINE groups in window layers, OR non-ARC entities
             on "opening / glazing" type layers (A-OPENING, A-GLAZ, …) which
             contain window frame lines even though those layers also hold door
             swing arcs.
    """
    door_arcs_data = []       # (cx, cy, radius) for clustering
    door_inserts   = set()
    window_inserts = set()
    window_lines   = 0
    opening_lines  = 0        # LINEs on OPENING-type layers (window frame lines)
    opening_polys  = 0        # LWPOLYLINEs on OPENING-type layers (window outlines)

    for e in msp:
        layer  = e.dxf.layer if hasattr(e.dxf, "layer") else ""
        t      = e.dxftype()
        tokens = _tokenize_layer(layer)

        # Check whether this layer is an "opening / glazing" type
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
                # Non-arc entities on an opening/glazing layer → window frames
                if t == "LWPOLYLINE":
                    opening_polys += 1
                elif t == "LINE":
                    opening_lines += 1

        # Only process window-layer entities that weren't already handled above
        # (avoids double-counting glazing layers that match both door & window)
        elif _is_window_layer(layer):
            if t == "INSERT":
                pos = (round(e.dxf.insert.x, 0), round(e.dxf.insert.y, 0))
                window_inserts.add(pos)
            elif t in ("LINE", "LWPOLYLINE"):
                window_lines += 1

    # ── Door count ──────────────────────────────────────────────────────────
    door_count = _cluster_door_arcs(door_arcs_data)
    doors = door_count if door_count > 0 else len(door_inserts)

    # ── Window count ─────────────────────────────────────────────────────────
    # Priority: dedicated window INSERTs → window-layer lines →
    #           opening-layer LWPOLYLINEs → opening-layer LINE groups
    #
    # Window frames in detailed DXF drawings use ~4 lines each (outer frame).
    # On A-OPENING layers, ~20 lines per window is common (frame + sill + reveal).
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

    return {"doors": doors, "windows": windows}


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_dxf(dxf_path: str) -> dict:
    doc      = ezdxf.readfile(dxf_path)
    msp      = doc.modelspace()
    insunits = int(doc.header.get("$INSUNITS", 0))
    unit_to_m, unit_label = _units_to_m_factor(insunits)

    assumed = False
    if unit_to_m is None:
        unit_to_m, unit_label, assumed = 0.001, "unitless assumed mm", True

    # ── Auto-correct unit factor ──────────────────────────────────────────────
    # Some DXF files declare $INSUNITS=4 (mm) but store coordinates in inches
    # or feet.  Detect the mismatch by checking the bounding-box size.
    unit_to_m, unit_label, auto_corrected = _auto_correct_unit_factor(
        unit_to_m, unit_label, msp
    )

    # ── Collect LINE segments first (needed to measure actual wall thickness) ──
    bbox = _compute_bbox_raw(msp)
    building_width_raw  = max(bbox[2] - bbox[0], bbox[3] - bbox[1])
    fallback_thickness  = building_width_raw * 0.02   # 2 % fallback if data too sparse

    line_segs = _collect_structural_lines(msp, unit_to_m, doc)

    # ── Detect actual wall face-pair thickness from data ──────────────────────
    # Replaces the fixed "2 % of building width" heuristic which over-merges
    # adjacent parallel walls that happen to be within ~26 units of each other.
    wall_thickness_raw = _detect_wall_thickness_raw(line_segs, fallback_thickness)

    # ── Face-merge LINE pairs → single centerline per wall ───────────────────
    tier1_line_raw = 0.0
    if line_segs:
        merged_lines   = _merge_parallel_line_pairs(line_segs, wall_thickness_raw)
        tier1_line_raw = sum(s[4] for s in merged_lines)

    # ── Collect non-LINE entities from structural layers ─────────────────────
    # LWPOLYLINEs / POLYLINEs / ARCs / SPLINEs are kept as-is (they are
    # usually already single-line representations or block inserts).
    #
    # Layer priority:
    #   • Skip FOOTER / FOOTPRINT layers when Tier-1 wall data was found — they
    #     duplicate the same geometry at foundation level.
    #   • Layer "0" is included only if it carries >5 m of geometry.
    total_raw       = tier1_line_raw   # start with face-merged LINE total
    entity_count    = len(line_segs)   # rough count (updated below)
    layer0_raw      = 0.0
    layer0_entities = 0
    has_tier1_line  = tier1_line_raw > 0.0

    for e in msp:
        layer  = e.dxf.layer if hasattr(e.dxf, "layer") else ""
        t      = e.dxftype()

        # Skip LINEs — already handled via face-merge above
        if t == "LINE":
            continue

        length = _entity_length(e)

        # ── INSERT on structural layers: recurse into block ──────────────────
        if t == "INSERT" and _is_structural_layer(layer):
            if has_tier1_line:
                continue  # LINE data already covers walls; skip block inserts
            block_sx = e.dxf.xscale if hasattr(e.dxf, "xscale") else 1.0
            block_sy = e.dxf.yscale if hasattr(e.dxf, "yscale") else 1.0
            blk_len  = _block_wall_length(doc, e.dxf.name, block_sx, block_sy)
            if blk_len > 0 and blk_len * unit_to_m >= MIN_LENGTH_M:
                total_raw    += blk_len
                entity_count += 1
            continue

        if length == 0:
            continue

        length_m = length * unit_to_m
        if length_m < MIN_LENGTH_M:
            continue

        if layer == "0":
            layer0_raw      += length
            layer0_entities += 1
        elif _is_structural_layer(layer):
            if has_tier1_line:
                # LINE segments already represent all walls (face-merged).
                # LWPOLYLINE / POLYLINE entities on structural layers are wall-
                # outline traces that duplicate the same geometry — skip them to
                # avoid counting the same walls 2–3 ×.
                continue
            total_raw    += length
            entity_count += 1

    # Include layer "0" if it has substantial geometry
    if layer0_raw * unit_to_m > 5.0:
        total_raw    += layer0_raw
        entity_count += layer0_entities

    # ── Fallback: no known wall layers found ─────────────────────────────────
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
            length_m = length * unit_to_m
            if length_m < MIN_LENGTH_M:
                continue
            total_raw    += length
            entity_count += 1

    # ── Count doors & windows from layers ────────────────────────────────────
    openings = _count_openings_from_layers(msp)

    scale_note = (
        f"DXF Accurate ($INSUNITS={insunits}, unit={unit_label})"
        + (" [ASSUMED]"        if assumed        else "")
        + (" [unit-corrected]" if auto_corrected  else "")
        + (" [fallback]"       if fallback_used   else "")
    )

    return {
        "walls":        entity_count,
        "length_m":     round(total_raw * unit_to_m, 2),
        "doors":        openings["doors"],
        "windows":      openings["windows"],
        "scale_source": scale_note,
        "units": {
            "insunits":   insunits,
            "unit_to_m":  unit_to_m,
            "unit_label": unit_label,
        },
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
