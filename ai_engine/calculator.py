from __future__ import annotations
import math
from typing import Dict, Any

# Prices updated March 2026 from market data (ehardware.lk, wedabima.com, lankadeals.lk)
DEFAULT_PRICES = {
    "cement_bag":    {"generic": 1850.0, "lanwa": 1725.0, "ultratec": 1800.0, "tokyo_super": 1930.0, "sanstha": 2015.0},
    "sand_m3":       {"generic": 11000.0},
    "metal_m3":      {"generic": 9000.0,  "icc": 10500.0, "tokyo_super": 10000.0, "maga": 9500.0},
    "steel_kg":      {"generic": 310.0,   "lanwa": 300.0,  "melwa": 308.0,         "gtb": 305.0},
    "rubble_m3":     {"generic": 9500.0},
    "labour_day":    {"generic": 4000.0},
}

# Soil multipliers — applied to footing depth AND width
SOIL_MULTIPLIER = {
    "hard_rock":  {"depth": 0.80, "width": 1.00},
    "laterite":   {"depth": 0.90, "width": 1.00},
    "normal":     {"depth": 1.00, "width": 1.00},
    "sandy":      {"depth": 1.20, "width": 1.15},
    "soft_clay":  {"depth": 1.50, "width": 1.30},
}

SOIL_LABELS = {
    "hard_rock":  "Hard Rock",
    "laterite":   "Laterite / Hard Soil",
    "normal":     "Normal Soil (Loam)",
    "sandy":      "Sandy Soil",
    "soft_clay":  "Soft Clay / Fill",
}

# Per-material base wastage rates (CIDA practice)
MATERIAL_WASTAGE = {
    "cement": 0.03,   # 3%  — bags, minimal waste
    "sand":   0.12,   # 12% — loose material, spillage
    "metal":  0.10,   # 10% — aggregate, some over-ordering
    "steel":  0.05,   # 5%  — cutting waste, overlaps
}

# Standard opening widths (SLS 1225)
DOOR_WIDTH_M   = 0.90   # standard single door opening
WINDOW_WIDTH_M = 1.20   # standard window opening


def _f(x, default):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _lkr(x):
    return f"Rs. {x:,.2f}"


def _pick(price_map, key):
    return float(
        price_map.get(key) or
        price_map.get("generic") or
        list(price_map.values())[0]
    )


def calculate_foundation_only(
    total_wall_length_m: float,
    user_choices: Dict[str, Any],
    prices: dict = None,
) -> Dict[str, Any]:

    if prices is None:
        try:
            from db.models import get_all_prices
            prices = get_all_prices()
        except Exception:
            prices = DEFAULT_PRICES

    # Ensure new price categories exist (backward compat with old DB data)
    for key, default in DEFAULT_PRICES.items():
        if key not in prices:
            prices[key] = default

    # ── Inputs ────────────────────────────────────────────────────────────────
    length_m       = max(_f(total_wall_length_m, 0.0), 0.0)
    thickness_in   = _f(user_choices.get("wall_thickness", 9),    9.0)
    cement_brand   = str(user_choices.get("cement_brand",         "generic"))
    metal_brand    = str(user_choices.get("metal_brand",          "generic"))
    steel_brand    = str(user_choices.get("steel_brand",          "generic"))
    soil_type      = str(user_choices.get("soil_type",            "normal"))
    wastage_pct    = max(_f(user_choices.get("wastage_pct", 10),  0.0), 0.0)
    door_count     = max(int(_f(user_choices.get("door_count", 0),   0)), 0)
    window_count   = max(int(_f(user_choices.get("window_count", 0), 0)), 0)
    plinth_height   = _f(user_choices.get("plinth_height_m", 0.45), 0.45)
    labour_days     = max(int(_f(user_choices.get("labour_days",    0), 0)), 0)
    labour_workers  = max(int(_f(user_choices.get("labour_workers", 1), 1)), 1)

    # ── Opening deduction ──────────────────────────────────────────────────────
    opening_deduction_m = (door_count * DOOR_WIDTH_M) + (window_count * WINDOW_WIDTH_M)
    # Floor at 50% of original to prevent unreasonably small values
    effective_length_m = max(length_m - opening_deduction_m, length_m * 0.5)

    # ── Footing base dimensions (wall thickness → width + slab depth + trench depth)
    if thickness_in <= 5.0:
        base_fw, base_slab_depth, base_trench_depth = 0.45, 0.15, 0.60
    elif thickness_in <= 10.0:
        base_fw, base_slab_depth, base_trench_depth = 0.60, 0.15, 0.75
    else:
        base_fw, base_slab_depth, base_trench_depth = 0.75, 0.20, 0.90

    # ── Apply soil multiplier to BOTH width and depth ──────────────────────────
    soil = SOIL_MULTIPLIER.get(soil_type, {"depth": 1.0, "width": 1.0})
    fw          = round(base_fw * soil["width"], 3)
    trench_depth = round(base_trench_depth * soil["depth"], 3)
    slab_depth   = base_slab_depth  # slab thickness doesn't change with soil

    # ── Concrete volume (footing slab) ─────────────────────────────────────────
    concrete_m3 = effective_length_m * fw * slab_depth

    # ── CIDA 1:2:4 mix ratios (dry volume method, factor 1.54) ────────────────
    CEMENT_PER_M3 = 6.5    # (1/7) x 1.54 / 0.0347 = 6.34 → 6.5 bags
    SAND_PER_M3   = 0.44   # (2/7) x 1.54
    METAL_PER_M3  = 0.88   # (4/7) x 1.54
    STEEL_PER_M3  = 50.0   # Residential strip footing: 40-60 kg/m3, midpoint

    net_cement = concrete_m3 * CEMENT_PER_M3
    net_sand   = concrete_m3 * SAND_PER_M3
    net_metal  = concrete_m3 * METAL_PER_M3
    net_steel  = concrete_m3 * STEEL_PER_M3

    # ── Per-material wastage + user additional allowance ───────────────────────
    user_waste = wastage_pct / 100.0
    cement_bags = net_cement * (1.0 + MATERIAL_WASTAGE["cement"] + user_waste)
    sand_m3     = net_sand   * (1.0 + MATERIAL_WASTAGE["sand"]   + user_waste)
    metal_m3    = net_metal  * (1.0 + MATERIAL_WASTAGE["metal"]  + user_waste)
    steel_kg    = net_steel  * (1.0 + MATERIAL_WASTAGE["steel"]  + user_waste)

    # ── Rubble masonry (foundation wall: footing to plinth level) ──────────────
    rubble_m3 = effective_length_m * fw * plinth_height

    # ── Unit rates ─────────────────────────────────────────────────────────────
    cu  = _pick(prices["cement_bag"], cement_brand)
    su  = _pick(prices["sand_m3"],    "generic")
    mu  = _pick(prices["metal_m3"],   metal_brand)
    stu = _pick(prices["steel_kg"],   steel_brand)
    ru  = _pick(prices["rubble_m3"],  "generic")
    lu  = _pick(prices["labour_day"], "generic")

    # ── Costs ──────────────────────────────────────────────────────────────────
    cc  = cement_bags * cu
    sc  = sand_m3     * su
    mc  = metal_m3    * mu
    stc = steel_kg    * stu
    rc  = rubble_m3   * ru
    lc  = labour_days * labour_workers * lu

    materials_subtotal = cc + sc + mc + stc + rc
    labour_subtotal    = lc
    grand_total        = materials_subtotal + labour_subtotal

    return {
        "schema_version": 2,
        "scope": "foundation_complete",
        "assumptions": {
            "foundation_type":       "strip_footing",
            "soil_type":             soil_type,
            "soil_label":            SOIL_LABELS.get(soil_type, soil_type),
            "soil_depth_multiplier": soil["depth"],
            "soil_width_multiplier": soil["width"],
            "footing_width_m":       fw,
            "footing_depth_m":       trench_depth,
            "slab_depth_m":          slab_depth,
            "trench_depth_m":        trench_depth,
            "plinth_height_m":       plinth_height,
            "wastage_pct":           wastage_pct,
            "cement_bags_per_m3":    CEMENT_PER_M3,
            "sand_m3_per_m3":        SAND_PER_M3,
            "metal_m3_per_m3":       METAL_PER_M3,
            "steel_kg_per_m3":       STEEL_PER_M3,
            "cement_brand":          cement_brand,
            "metal_brand":           metal_brand,
            "steel_brand":           steel_brand,
            "wall_thickness_in":     thickness_in,
            "door_count":            door_count,
            "window_count":          window_count,
            "opening_deduction_m":   round(opening_deduction_m, 2),
            "effective_wall_length_m": round(effective_length_m, 2),
        },
        "quantities": {
            "wall_length_m":     round(length_m, 2),
            "concrete_m3":       round(concrete_m3, 3),
            "cement_bags":       round(cement_bags, 2),
            "sand_m3":           round(sand_m3, 2),
            "metal_m3":          round(metal_m3, 2),
            "steel_kg":          round(steel_kg, 2),
            "rubble_m3":         round(rubble_m3, 2),
            "labour_days":       labour_days,
            "labour_workers":    labour_workers,
            # Net quantities (before wastage) for reference
            "net_cement_bags":   round(net_cement, 2),
            "net_sand_m3":       round(net_sand, 2),
            "net_metal_m3":      round(net_metal, 2),
            "net_steel_kg":      round(net_steel, 2),
        },
        "unit_rates_lkr": {
            "cement_bag":  cu,
            "sand_m3":     su,
            "metal_m3":    mu,
            "steel_kg":    stu,
            "rubble_m3":   ru,
            "labour_day":  lu,
        },
        "costs_lkr": {
            "cement":             _lkr(cc),
            "sand":               _lkr(sc),
            "metal":              _lkr(mc),
            "steel":              _lkr(stc),
            "rubble_masonry":     _lkr(rc),
            "labour":             _lkr(lc),
            "MATERIALS_SUBTOTAL": _lkr(materials_subtotal),
            "LABOUR_SUBTOTAL":    _lkr(labour_subtotal),
            "GRAND_TOTAL":        _lkr(grand_total),
        },
    }
