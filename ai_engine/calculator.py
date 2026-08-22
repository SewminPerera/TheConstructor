from __future__ import annotations
import math
from typing import Dict, Any

DEFAULT_PRICES = {

    "cement_bag": {
        "generic":     2350.0,      
        "lanwa":       2250.0,      
        "ultratec":    2400.0,      
        "tokyo_super": 2500.0,      
        "sanstha":     2450.0,      
    },
    
    "sand_m3": {
        "generic": 22000.0,         
    },
   
    "metal_m3": {
        "generic":     18500.0,     
        "icc":         21000.0,     
        "tokyo_super": 20500.0,     
        "maga":        20000.0,     
    },
    
    "steel_kg": {
        "generic": 390.0,           
        "lanwa":   420.0,           
        "melwa":   415.0,           
        "gtb":     405.0,           
    },
    # Rubble stone (random rubble) per m³ — quarry supply
    "rubble_m3": {
        "generic": 8500.0,
    },
    # Skilled mason + helper daily rate (combined)
    "labour_day": {
        "generic": 4000.0,          
    },


   
    "brick_each": {
        "cement_block": 80.0,       
        "clay_brick":   35.0,       
    },
    # Plastering per m² (material + labour combined rate)
    "plaster_m2": {
        "generic": 650.0,           
    },
    # Painting per m² (two coats, material + labour)
    "paint_m2": {
        "emulsion":    280.0,      
        "weathercoat": 380.0,      
    },
    # Floor finish per m² (material + labour)
    "floor_m2": {
        "cement":  450.0,           
        "tile":   1800.0,          
    },
    # Roofing per m² (structure + covering + labour)
    "roof_m2": {
        "flat_slab":    4500.0,     
        "timber_tile":  3200.0,     
        "timber_sheet": 2200.0,     
    },
    # Precast concrete lintels per unit (standard 1.2m span)
    "lintel_each": {
        "generic": 4500.0,          
    },
}

# Soil multipliers  applied to footing depth AND width
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
    "cement": 0.03,   
    "sand":   0.12,   
    "metal":  0.10,   
    "steel":  0.05,   
}

# Standard opening dimensions (SLS 1225)
DOOR_WIDTH_M    = 0.90   
DOOR_HEIGHT_M   = 2.10   
WINDOW_WIDTH_M  = 1.20   
WINDOW_HEIGHT_M = 1.20   

# Masonry constants
BLOCKS_PER_M2 = {
    "cement_block": 12.5,   
    "clay_brick":   55.0,   
}

MORTAR_CEMENT_PER_M2 = {
    "cement_block": 0.25,   
    "clay_brick":   0.50,   
}

MORTAR_SAND_PER_M2 = {
    "cement_block": 0.015,  
    "clay_brick":   0.030,  
}

# Superstructure wastage rates
SUPER_WASTAGE = {
    "brick":   0.05,   
    "plaster": 0.10,   
    "paint":   0.08,   
    "floor":   0.05,   
    "roof":    0.05,   
}


def _f(x, default):
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _lkr(x):
    return f"Rs. {x:,.2f}"


def _pick(price_map, key):
    if not price_map:
        return 0.0
    val = price_map.get(key) or price_map.get("generic")
    if val is not None:
        return float(val)
    # Fallback to first available value
    values = list(price_map.values())
    return float(values[0]) if values else 0.0


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

    # Inputs 
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

    plinths_input = user_choices.get("plinths") or []
    extra_plinths = []
    if isinstance(plinths_input, list):
        for p in plinths_input:
            if not isinstance(p, dict):
                continue
            pl_len = max(_f(p.get("length_m"), 0.0), 0.0)
            pl_wid = max(_f(p.get("width_m"),  0.0), 0.0)
            pl_hgt = max(_f(p.get("height_m"), 0.0), 0.0)
            if pl_len > 0 and pl_wid > 0 and pl_hgt > 0:
                extra_plinths.append({
                    "length_m": round(pl_len, 3),
                    "width_m":  round(pl_wid, 3),
                    "height_m": round(pl_hgt, 3),
                    "volume_m3": round(pl_len * pl_wid * pl_hgt, 3),
                })
    extra_plinth_volume = sum(p["volume_m3"] for p in extra_plinths)
 
    opening_deduction_m = (door_count * DOOR_WIDTH_M) + (window_count * WINDOW_WIDTH_M)
    # Floor at 50% of original to prevent unreasonably small values
    effective_length_m = max(length_m - opening_deduction_m, length_m * 0.5)

    # Footing base dimensions (wall thickness → width + slab depth + trench depth)
    if thickness_in <= 5.0:
        base_fw, base_slab_depth, base_trench_depth = 0.45, 0.15, 0.60
    elif thickness_in <= 10.0:
        base_fw, base_slab_depth, base_trench_depth = 0.60, 0.15, 0.75
    else:
        base_fw, base_slab_depth, base_trench_depth = 0.75, 0.20, 0.90

    #Apply soil multiplier to BOTH width and depth 
    soil = SOIL_MULTIPLIER.get(soil_type, {"depth": 1.0, "width": 1.0})
    fw          = round(base_fw * soil["width"], 3)
    trench_depth = round(base_trench_depth * soil["depth"], 3)
    slab_depth   = base_slab_depth  

    #  Concrete volume (footing slab) 
    concrete_m3 = effective_length_m * fw * slab_depth

    # CIDA 1:2:4 mix ratios (dry volume method, factor 1.54) 
    CEMENT_PER_M3 = 6.5    
    SAND_PER_M3   = 0.44   
    METAL_PER_M3  = 0.88   
    STEEL_PER_M3  = 50.0   

    net_cement = concrete_m3 * CEMENT_PER_M3
    net_sand   = concrete_m3 * SAND_PER_M3
    net_metal  = concrete_m3 * METAL_PER_M3
    net_steel  = concrete_m3 * STEEL_PER_M3

    #  Per material wastage + user additional allowance
    user_waste = wastage_pct / 100.0
    cement_bags = net_cement * (1.0 + MATERIAL_WASTAGE["cement"] + user_waste)
    sand_m3     = net_sand   * (1.0 + MATERIAL_WASTAGE["sand"]   + user_waste)
    metal_m3    = net_metal  * (1.0 + MATERIAL_WASTAGE["metal"]  + user_waste)
    steel_kg    = net_steel  * (1.0 + MATERIAL_WASTAGE["steel"]  + user_waste)

    # Rubble masonry (foundation wall footing to plinth level)
    rubble_m3 = effective_length_m * fw * plinth_height + extra_plinth_volume

    # Unit rates 
    cu  = _pick(prices["cement_bag"], cement_brand)
    su  = _pick(prices["sand_m3"],    "generic")
    mu  = _pick(prices["metal_m3"],   metal_brand)
    stu = _pick(prices["steel_kg"],   steel_brand)
    ru  = _pick(prices["rubble_m3"],  "generic")
    lu  = _pick(prices["labour_day"], "generic")

    # Costs 
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
            "extra_plinths":         extra_plinths,
            "extra_plinth_count":    len(extra_plinths),
            "extra_plinth_volume_m3": round(extra_plinth_volume, 3),
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


def calculate_full_estimate(
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

    for key, default in DEFAULT_PRICES.items():
        if key not in prices:
            prices[key] = default

    #Run foundation calculation first 
    foundation = calculate_foundation_only(total_wall_length_m, user_choices, prices)

    #Extract superstructure inputs (all optional with defaults) 
    wall_height_m    = max(_f(user_choices.get("wall_height_m", 3.0), 3.0), 0.0)
    number_of_floors = max(int(_f(user_choices.get("number_of_floors", 1), 1)), 1)
    floor_area_m2    = max(_f(user_choices.get("floor_area_m2", 0), 0.0), 0.0)
    roof_type        = str(user_choices.get("roof_type",    "none"))
    brick_type       = str(user_choices.get("brick_type",   "cement_block"))
    plaster_type     = str(user_choices.get("plaster_type", "both"))
    paint_type       = str(user_choices.get("paint_type",   "emulsion"))
    floor_finish     = str(user_choices.get("floor_finish", "cement"))

    user_waste       = max(_f(user_choices.get("wastage_pct", 10), 0.0), 0.0) / 100.0
    door_count       = max(int(_f(user_choices.get("door_count", 0), 0)), 0)
    window_count     = max(int(_f(user_choices.get("window_count", 0), 0)), 0)

    effective_length_m = foundation["assumptions"]["effective_wall_length_m"]

    floor_load_factor = 1.0 + 0.15 * (number_of_floors - 1)

    # Check if superstructure is requested 
    has_superstructure = wall_height_m > 0

    #  1. Wall masonry (plinth to roof level, per floor) 
    gross_wall_area   = effective_length_m * wall_height_m * number_of_floors
    opening_area      = ((door_count * DOOR_WIDTH_M * DOOR_HEIGHT_M) +
                         (window_count * WINDOW_WIDTH_M * WINDOW_HEIGHT_M)) * number_of_floors
    net_wall_area     = max(gross_wall_area - opening_area, gross_wall_area * 0.3)

    blocks_per_m2     = BLOCKS_PER_M2.get(brick_type, 12.5)
    net_block_count   = net_wall_area * blocks_per_m2
    block_count       = net_block_count * (1.0 + SUPER_WASTAGE["brick"] + user_waste)

    # Mortar for masonry
    masonry_cement    = net_wall_area * MORTAR_CEMENT_PER_M2.get(brick_type, 0.25)
    masonry_sand      = net_wall_area * MORTAR_SAND_PER_M2.get(brick_type, 0.015)

    bu  = _pick(prices["brick_each"], brick_type)
    masonry_block_cost  = block_count * bu
    masonry_cement_cost = masonry_cement * _pick(prices["cement_bag"], str(user_choices.get("cement_brand", "generic")))
    masonry_sand_cost   = masonry_sand * _pick(prices["sand_m3"], "generic")
    masonry_cost        = masonry_block_cost + masonry_cement_cost + masonry_sand_cost

    #  2. Lintels (one per opening per floor) 
    lintel_count = (door_count + window_count) * number_of_floors
    liu          = _pick(prices["lintel_each"], "generic")
    lintel_cost  = lintel_count * liu

    #  3. Plastering 
    if plaster_type == "none":
        plaster_area = 0.0
    elif plaster_type == "internal":
        plaster_area = net_wall_area   # internal face only
    elif plaster_type == "external":
        plaster_area = net_wall_area   # external face only
    else:  # "both"
        plaster_area = net_wall_area * 2  # both faces

    net_plaster_area = plaster_area
    plaster_area_w   = plaster_area * (1.0 + SUPER_WASTAGE["plaster"] + user_waste)
    plu              = _pick(prices["plaster_m2"], "generic")
    plaster_cost     = plaster_area_w * plu

    #  4. Flooring 
    if floor_area_m2 > 0:
        total_floor_area = floor_area_m2 * number_of_floors
    else:
        total_floor_area = 0.0

    floor_area_w = total_floor_area * (1.0 + SUPER_WASTAGE["floor"] + user_waste)
    flu          = _pick(prices["floor_m2"], floor_finish)
    floor_cost   = floor_area_w * flu

    #  5. Roofing 
    if roof_type != "none" and floor_area_m2 > 0:
        roof_area   = floor_area_m2 * 1.1  # 10% extra for overhang/pitch
        roof_area_w = roof_area * (1.0 + SUPER_WASTAGE["roof"] + user_waste)
        rou         = _pick(prices["roof_m2"], roof_type)
        roof_cost   = roof_area_w * rou
    else:
        roof_area = 0.0
        roof_area_w = 0.0
        rou = 0.0
        roof_cost = 0.0

    # 6. Painting 
    if paint_type != "none" and plaster_area > 0:
        paint_area   = plaster_area  # same area as plastered
        paint_area_w = paint_area * (1.0 + SUPER_WASTAGE["paint"] + user_waste)
        pau          = _pick(prices["paint_m2"], paint_type)
        paint_cost   = paint_area_w * pau
    else:
        paint_area = 0.0
        paint_area_w = 0.0
        pau = 0.0
        paint_cost = 0.0

    # Superstructure subtotal 
    super_subtotal = (masonry_cost + lintel_cost + plaster_cost +
                      floor_cost + roof_cost + paint_cost)


    def _parse_lkr(s):
        try:
            return float(str(s).replace("Rs. ", "").replace(",", ""))
        except (TypeError, ValueError):
            return 0.0

    fnd_materials = _parse_lkr(foundation["costs_lkr"]["MATERIALS_SUBTOTAL"])
    fnd_labour    = _parse_lkr(foundation["costs_lkr"]["LABOUR_SUBTOTAL"])

    total_materials = fnd_materials + super_subtotal
    total_labour    = fnd_labour
    grand_total     = total_materials + total_labour

    # Build response 
    result = {
        "schema_version": 3,
        "scope": "full_estimate" if has_superstructure else "foundation_complete",

        # Foundation section (preserved from original calculator)
        "foundation": {
            "assumptions": foundation["assumptions"],
            "quantities":  foundation["quantities"],
            "costs_lkr":   foundation["costs_lkr"],
        },

        # Superstructure section
        "superstructure": {
            "wall_masonry": {
                "gross_wall_area_m2": round(gross_wall_area, 2),
                "opening_area_m2":   round(opening_area, 2),
                "net_wall_area_m2":  round(net_wall_area, 2),
                "block_count":       round(block_count, 0),
                "net_block_count":   round(net_block_count, 0),
                "masonry_cement_bags": round(masonry_cement, 2),
                "masonry_sand_m3":   round(masonry_sand, 3),
                "cost_lkr":          _lkr(masonry_cost),
            },
            "lintels": {
                "count":    lintel_count,
                "cost_lkr": _lkr(lintel_cost),
            },
            "plastering": {
                "area_m2":     round(net_plaster_area, 2),
                "area_w_m2":   round(plaster_area_w, 2),
                "cost_lkr":    _lkr(plaster_cost),
            },
            "flooring": {
                "area_m2":     round(total_floor_area, 2),
                "area_w_m2":   round(floor_area_w, 2),
                "cost_lkr":    _lkr(floor_cost),
            },
            "roofing": {
                "area_m2":     round(roof_area, 2),
                "area_w_m2":   round(roof_area_w, 2),
                "cost_lkr":    _lkr(roof_cost),
            },
            "painting": {
                "area_m2":     round(paint_area, 2),
                "area_w_m2":   round(paint_area_w, 2),
                "cost_lkr":    _lkr(paint_cost),
            },
        },

        # Merged assumptions
        "assumptions": {
            **foundation["assumptions"],
            "wall_height_m":     wall_height_m,
            "number_of_floors":  number_of_floors,
            "floor_area_m2":     floor_area_m2,
            "roof_type":         roof_type,
            "brick_type":        brick_type,
            "plaster_type":      plaster_type,
            "paint_type":        paint_type,
            "floor_finish":      floor_finish,
            "floor_load_factor": round(floor_load_factor, 2),
        },

        # Merged quantities
        "quantities": {
            **foundation["quantities"],
            "block_count":        round(block_count, 0),
            "lintel_count":       lintel_count,
            "plaster_area_m2":    round(net_plaster_area, 2),
            "floor_area_m2":      round(total_floor_area, 2),
            "roof_area_m2":       round(roof_area, 2),
            "paint_area_m2":      round(paint_area, 2),
        },

        # Merged unit rates
        "unit_rates_lkr": {
            **foundation["unit_rates_lkr"],
            "brick_each":   bu,
            "plaster_m2":   plu,
            "paint_m2":     pau,
            "floor_m2":     flu,
            "roof_m2":      rou,
            "lintel_each":  liu,
        },

        # Merged costs
        "costs_lkr": {
            "cement":             foundation["costs_lkr"]["cement"],
            "sand":               foundation["costs_lkr"]["sand"],
            "metal":              foundation["costs_lkr"]["metal"],
            "steel":              foundation["costs_lkr"]["steel"],
            "rubble_masonry":     foundation["costs_lkr"]["rubble_masonry"],
            "FOUNDATION_SUBTOTAL": foundation["costs_lkr"]["MATERIALS_SUBTOTAL"],
            "wall_masonry":       _lkr(masonry_cost),
            "lintels":            _lkr(lintel_cost),
            "plastering":         _lkr(plaster_cost),
            "flooring":           _lkr(floor_cost),
            "roofing":            _lkr(roof_cost),
            "painting":           _lkr(paint_cost),
            "SUPERSTRUCTURE_SUBTOTAL": _lkr(super_subtotal),
            "labour":             foundation["costs_lkr"]["labour"],
            "MATERIALS_SUBTOTAL": _lkr(total_materials),
            "LABOUR_SUBTOTAL":    _lkr(fnd_labour),
            "GRAND_TOTAL":        _lkr(grand_total),
        },
    }

    return result
